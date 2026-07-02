"""Módulo IA: genera resúmenes, fichas y prompts visuales usando OpenAI."""
from __future__ import annotations
import os
from openai import AsyncOpenAI
from graph.model import Block, ProjectGraph

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
SYSTEM_PROMPT = """Eres un experto en arquitectura de sistemas y SysML.
Analiza la información estructural de un proyecto Enterprise Architect y 
responde en español de forma clara, técnica y concisa.
Cuando se te pida un resumen de bloque, incluye siempre:
1. Función principal del bloque.
2. Relación con otros bloques (dependencias).
3. Puntos críticos o huecos de documentación.
Cuando se te pida un prompt visual, genera una descripción detallada 
para un generador de imágenes (DALL-E / Midjourney style)."""


class Summarizer:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def summarize_block(self, block: Block, graph: ProjectGraph) -> dict:
        context = graph.build_block_context(block)
        project_ctx = graph.build_project_summary()
        if not self.client:
            return {"error": "OPENAI_API_KEY no configurada", "context": context}

        prompt = (
            f"Contexto del proyecto: {project_ctx}\n\n"
            f"{context}\n\n"
            "Genera una ficha con:\n"
            "- Resumen estructural (qué contiene)\n"
            "- Resumen contextual (dependencias, impacto)\n"
            "- Resumen funcional (para qué sirve)\n"
            "- Alertas: huecos de documentación o dependencias no resueltas"
        )
        response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        return {
            "block_id": block.id,
            "block_name": block.name,
            "summary": response.choices[0].message.content,
            "context_used": context,
        }

    async def generate_image_prompt(self, block: Block, graph: ProjectGraph) -> str:
        context = graph.build_block_context(block)
        if not self.client:
            return f"Diagrama técnico del bloque '{block.name}' con sus subcomponentes y conexiones."

        prompt = (
            f"{context}\n\n"
            "Genera un prompt detallado en inglés para crear una imagen técnica de este bloque. "
            "El prompt debe describir: estilo visual (diagrama técnico / isométrico industrial), "
            "elementos principales, relaciones visibles, paleta de colores sugerida y nivel de detalle."
        )
        response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
        )
        return response.choices[0].message.content

    async def answer_question(self, question: str, graph: ProjectGraph) -> str:
        project_ctx = graph.build_project_summary()
        # Contexto de todos los bloques (top 20 por nombre para no saturar el contexto)
        top_blocks = list(graph.blocks.values())[:20]
        blocks_ctx = "\n---\n".join(
            graph.build_block_context(b) for b in top_blocks
        )
        if not self.client:
            return "OPENAI_API_KEY no configurada."

        prompt = (
            f"Proyecto: {project_ctx}\n\n"
            f"Bloques principales:\n{blocks_ctx}\n\n"
            f"Pregunta: {question}"
        )
        response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content
