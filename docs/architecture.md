# Arquitectura del sistema

## Visión general

```
[JSON de EA] → [Parser] → [ProjectGraph] → [API FastAPI] → [Frontend React]
                                  ↓
                           [Summarizer IA]
                           (OpenAI GPT-4o)
```

## Flujo de datos

1. **Ingest**: el usuario sube el JSON exportado de Enterprise Architect.
2. **Parser** (`ea_parser.py`): normaliza el JSON a entidades tipadas (Package, Block, Port, Part, Connector).
3. **ProjectGraph** (`model.py`): construye el grafo dirigido con `networkx` y resuelve relaciones.
4. **API** (`main.py`): expone endpoints REST para explorar y consultar el grafo.
5. **Summarizer** (`summarizer.py`): recibe un bloque + su contexto del grafo y llama a OpenAI para generar resúmenes, fichas y prompts visuales.
6. **Frontend** (React + Vite): cuatro vistas — Ingest, Explorer, Summary, AIPanel.

## Entidades del modelo interno

| Entidad | Atributos clave | Relaciones |
|---------|----------------|------------|
| Package | id, name, parent_id, documentation | contiene Blocks y sub-Packages |
| Block | id, name, package_id, stereotype, documentation | tiene Ports, Parts; conectado a otros Blocks |
| Port | id, name, owner_id, direction | pertenece a un Block |
| Part | id, name, owner_id, type_id, reuses_id | pertenece a un Block; referencia un Block como tipo |
| Connector | id, source_id, target_id, connector_type | enlaza dos nodos del grafo |

## Decisiones de diseño

- **Dos pasadas de parsing**: primero se crean nodos, luego conectores. Así evitamos referencias a nodos no existentes.
- **Contexto enriquecido para IA**: no se manda el JSON crudo a la IA sino un texto estructurado del bloque + vecinos. Esto reduce tokens, mejora coherencia y hace las respuestas más trazables.
- **Sin base de datos en v1**: el grafo vive en memoria. En producción se puede persistir en Neo4j o PostgreSQL + pgvector para RAG más potente.
- **Prompts separados por intención**: resumen estructural, contextual, funcional y prompt visual son llamadas distintas. Permite cachear y controlar costes.

## Próximos pasos

- [ ] Soporte para múltiples archivos / proyectos
- [ ] Exportar fichas a PDF o Markdown
- [ ] Vista de grafo visual (D3.js o Cytoscape.js)
- [ ] RAG con embeddings para consultas más precisas
- [ ] Generación de imágenes via DALL-E integrado
- [ ] Detección automática de inconsistencias en el modelo
