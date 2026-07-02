"""EA JSON Explorer — FastAPI entrypoint."""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import orjson

from parser.ea_parser import EAParser
from graph.model import ProjectGraph
from ai.summarizer import Summarizer

app = FastAPI(
    title="EA JSON Explorer",
    description="Explorador y analizador IA de proyectos Enterprise Architect",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado en memoria (en producción usar BD)
_graph: ProjectGraph | None = None
_summarizer: Summarizer = Summarizer()


@app.post("/api/ingest", summary="Carga y parsea el JSON de EA")
async def ingest(file: UploadFile = File(...)):
    """Recibe el JSON exportado de Enterprise Architect y construye el grafo interno."""
    global _graph
    try:
        raw = await file.read()
        data = orjson.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {e}")

    parser = EAParser(data)
    _graph = parser.build_graph()
    return {
        "packages": len(_graph.packages),
        "blocks": len(_graph.blocks),
        "connectors": len(_graph.connectors),
        "ports": len(_graph.ports),
    }


@app.get("/api/packages", summary="Lista de paquetes raíz")
def list_packages():
    _require_graph()
    return [p.to_dict() for p in _graph.packages.values()]


@app.get("/api/blocks/{block_id}", summary="Ficha de un bloque")
def get_block(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    return block.to_dict_full(_graph)


@app.get("/api/blocks/{block_id}/summary", summary="Resumen IA de un bloque")
async def block_summary(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    summary = await _summarizer.summarize_block(block, _graph)
    return summary


@app.get("/api/blocks/{block_id}/image-prompt", summary="Prompt visual para generar imagen del bloque")
async def block_image_prompt(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    prompt = await _summarizer.generate_image_prompt(block, _graph)
    return {"prompt": prompt}


@app.post("/api/ask", summary="Consulta libre IA sobre el proyecto")
async def ask(body: dict):
    _require_graph()
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía")
    answer = await _summarizer.answer_question(question, _graph)
    return {"answer": answer}


def _require_graph():
    if _graph is None:
        raise HTTPException(status_code=400, detail="No hay proyecto cargado. Usa /api/ingest primero.")
