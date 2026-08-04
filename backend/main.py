"""EA JSON Explorer — FastAPI entrypoint."""
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import orjson

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"[EA Explorer] .env cargado desde {env_path}")
    else:
        print(f"[EA Explorer] No se encontró .env en {env_path}")
except ImportError:
    pass

from parser.ea_parser import EAParser
from parser.xml_loader import xml_to_dict
from graph.model import ProjectGraph
from ai.summarizer import Summarizer
from auth.google import router as google_router

app = FastAPI(
    title="EA JSON Explorer",
    description="Explorador y analizador IA de proyectos Enterprise Architect",
    version="0.4.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(google_router)

_graph: ProjectGraph | None = None
_summarizer: Summarizer = Summarizer()


def _is_xml(raw: bytes) -> bool:
    """Detecta si el contenido es XML real mirando el primer byte significativo."""
    sniff = raw.lstrip(b' \t\r\n\xef\xbb\xbf\xff\xfe\xfe\xff')
    return sniff[:1] == b'<'


@app.post("/api/ingest", summary="Carga y parsea el JSON o XML de EA")
async def ingest(file: UploadFile = File(...)):
    global _graph, _summarizer

    raw = await file.read()

    # Detecta por CONTENIDO, no por extensión (cubre archivos .xml con JSON dentro)
    if _is_xml(raw):
        try:
            data = xml_to_dict(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"XML inválido: {e}")
    else:
        try:
            data = orjson.loads(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"JSON inválido: {e}")

    try:
        parser = EAParser(data)
        _graph = parser.build_graph()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error al parsear el proyecto: {e}")

    _summarizer = Summarizer()

    return {
        "packages":   len(_graph.packages),
        "blocks":     len(_graph.blocks),
        "connectors": len(_graph.connectors),
        "ports":      len(_graph.ports),
    }


@app.get("/api/packages")
def list_packages():
    _require_graph()
    return [p.to_dict() for p in _graph.packages.values()]


@app.get("/api/blocks")
def list_blocks():
    _require_graph()
    return [b.to_dict() for b in _graph.blocks.values()]


@app.get("/api/blocks/{block_id}")
def get_block(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    return block.to_dict_full(_graph)


@app.get("/api/blocks/{block_id}/summary")
async def block_summary(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    summary = await _summarizer.summarize_block(block, _graph)
    if "error" in summary:
        raise HTTPException(status_code=503, detail=summary["error"])
    return summary


@app.get("/api/blocks/{block_id}/image-prompt")
async def block_image_prompt(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    prompt = await _summarizer.generate_image_prompt(block, _graph)
    return {"prompt": prompt}


@app.get("/api/blocks/{block_id}/image")
async def block_image(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    result = await _summarizer.generate_image(block, _graph)
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return result


@app.post("/api/ask")
async def ask(body: dict):
    _require_graph()
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía")
    if not _summarizer.client:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY no configurada.")
    answer = await _summarizer.answer_question(question, _graph)
    return {"answer": answer}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "project_loaded": _graph is not None,
        "ai_ready": _summarizer.client is not None,
        "packages": len(_graph.packages) if _graph else 0,
        "blocks":   len(_graph.blocks)   if _graph else 0,
    }


def _require_graph():
    if _graph is None:
        raise HTTPException(status_code=400, detail="No hay proyecto cargado. Usa /api/ingest primero.")
