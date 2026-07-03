"""EA JSON Explorer — FastAPI entrypoint."""
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import orjson

# Carga .env si existe (útil en desarrollo local)
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"[EA Explorer] .env cargado desde {env_path}")
    else:
        print(f"[EA Explorer] No se encontró .env en {env_path} — usa variables de entorno del sistema.")
except ImportError:
    print("[EA Explorer] python-dotenv no instalado. Usa variables de entorno del sistema.")

from parser.ea_parser import EAParser
from graph.model import ProjectGraph
from ai.summarizer import Summarizer

app = FastAPI(
    title="EA JSON Explorer",
    description="Explorador y analizador IA de proyectos Enterprise Architect",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado en memoria
_graph: ProjectGraph | None = None
_summarizer: Summarizer = Summarizer()


@app.post("/api/ingest", summary="Carga y parsea el JSON de EA")
async def ingest(file: UploadFile = File(...)):
    global _graph, _summarizer
    try:
        raw = await file.read()
        data = orjson.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {e}")

    try:
        parser = EAParser(data)
        _graph = parser.build_graph()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error al parsear el proyecto: {e}")

    # Re-crear summarizer para recoger la API key si se acaba de configurar
    _summarizer = Summarizer()

    return {
        "packages":   len(_graph.packages),
        "blocks":     len(_graph.blocks),
        "connectors": len(_graph.connectors),
        "ports":      len(_graph.ports),
    }


@app.get("/api/packages", summary="Lista de paquetes")
def list_packages():
    _require_graph()
    return [p.to_dict() for p in _graph.packages.values()]


@app.get("/api/blocks", summary="Lista de todos los bloques")
def list_blocks():
    _require_graph()
    return [b.to_dict() for b in _graph.blocks.values()]


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
    if "error" in summary:
        raise HTTPException(status_code=503, detail=summary["error"])
    return summary


@app.get("/api/blocks/{block_id}/image-prompt", summary="Prompt visual")
async def block_image_prompt(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    prompt = await _summarizer.generate_image_prompt(block, _graph)
    return {"prompt": prompt}

@app.get("/api/blocks/{block_id}/image", summary="Genera imagen DALL-E del bloque")
async def block_image(block_id: str):
    _require_graph()
    block = _graph.blocks.get(block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    result = await _summarizer.generate_image(block, _graph)
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return result

@app.post("/api/ask", summary="Consulta libre IA")
async def ask(body: dict):
    _require_graph()
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía")
    if not _summarizer.client:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY no configurada. Crea el archivo backend/.env con tu clave.")
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
