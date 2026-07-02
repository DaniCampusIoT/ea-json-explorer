# EA JSON Explorer

Explorador y analizador IA de proyectos **Enterprise Architect** exportados en JSON.

## ¿Qué hace?

Transforma el export JSON de EA en un grafo navegable de paquetes, bloques, puertos y conectores. Sobre ese grafo genera:

- **Fichas estructurales** por bloque (qué contiene, qué puertos tiene)
- **Resúmenes contextuales** (dependencias, impacto en otros subsistemas)
- **Prompts visuales** listos para generar imágenes
- **Panel IA** para consultas libres sobre el modelo

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.11 + FastAPI |
| Parsing | `orjson` + modelo propio |
| Grafo | `networkx` |
| IA | OpenAI API (GPT-4o) via RAG |
| Frontend | React 18 + Vite |

## Estructura

```
ea-json-explorer/
├── backend/
│   ├── main.py              # FastAPI entrypoint
│   ├── parser/
│   │   └── ea_parser.py     # Parsing del JSON de EA
│   ├── graph/
│   │   └── model.py         # Modelo: Package, Block, Port, Connector
│   ├── ai/
│   │   └── summarizer.py    # Resúmenes IA y prompts visuales
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       └── views/
│           ├── Ingest.jsx   # Carga del JSON
│           ├── Explorer.jsx # Árbol de paquetes/bloques
│           ├── Summary.jsx  # Fichas por bloque
│           └── AIPanel.jsx  # Consultas IA
└── docs/
    └── architecture.md
```

## Inicio rápido

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno

Crea un archivo `backend/.env`:
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

## Licencia

MIT
