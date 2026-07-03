"""Módulo IA: genera resúmenes, fichas y prompts visuales usando OpenAI o Groq."""
from __future__ import annotations
import os
import re
from openai import AsyncOpenAI
from graph.model import Block, ProjectGraph

AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()

if AI_PROVIDER == "groq":
    MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
else:
    MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

SYSTEM_PROMPT = """Eres un experto en arquitectura de sistemas y SysML.
Analiza la información estructural de un proyecto Enterprise Architect y 
responde en español de forma clara, técnica y concisa.
Cuando se te pida un resumen de bloque, incluye siempre:
1. Función principal del bloque.
2. Relación con otros bloques (dependencias).
3. Puntos críticos o huecos de documentación.
Cuando se te pida un prompt visual, genera una descripción detallada 
para un generador de imágenes."""


# ---------------------------------------------------------------------------
# Port → physical connector mapping
# ---------------------------------------------------------------------------
_PORT_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r'850[Vv]|HV|High.?Volt|Power.?In|Power.?Out|PWR', re.I),
     "high-voltage screw terminal block (orange, 3-pin)"),
    (re.compile(r'CAN.?FD|CAN', re.I),
     "DB9 male connector (CAN bus)"),
    (re.compile(r'SPI|RS.?422|RS.?485|UART|SERIAL', re.I),
     "2.54 mm pin header (6-pin)"),
    (re.compile(r'USB', re.I),
     "USB-C female receptacle"),
    (re.compile(r'PCI', re.I),
     "PCIe edge connector"),
    (re.compile(r'ANT.?GPS|GPS', re.I),
     "SMA female GPS stub antenna (black, 50mm)"),
    (re.compile(r'ANT.?RFID|RFID', re.I),
     "SMA female RFID stub antenna (grey, 40mm)"),
    (re.compile(r'ANT.?Telemetry|Telemetry', re.I),
     "SMA female telemetry whip antenna (white, 60mm)"),
    (re.compile(r'ANT|Antenna', re.I),
     "SMA female stub antenna"),
    (re.compile(r'Light|LED', re.I),
     "JST-PH 4-pin white connector"),
    (re.compile(r'Brush|BWS', re.I),
     "Molex MicroFit 2-pin connector"),
    (re.compile(r'Harness', re.I),
     "automotive wiring harness multi-pin connector (black, 12-pin)"),
    (re.compile(r'JB[LR]|Junction', re.I),
     "sealed junction box connector (IP67, 8-pin)"),
    (re.compile(r'ETH|Ethernet|RJ45', re.I),
     "RJ45 shielded Ethernet jack"),
    (re.compile(r'I2C|TWI', re.I),
     "2.54 mm pin header (4-pin)"),
]


def _map_ports_to_physical(port_names: list[str]) -> list[dict]:
    """Return list of {name, physical} for each port."""
    result = []
    for name in port_names:
        physical = "generic 2.54 mm header connector"
        for pattern, description in _PORT_MAP:
            if pattern.search(name):
                physical = description
                break
        result.append({"name": name, "physical": physical})
    return result


def _extract_ports(context: str) -> list[str]:
    """Heuristic extraction of port names from the block context string."""
    ports: list[str] = []
    for line in context.splitlines():
        line = line.strip()
        if line.startswith("- ") and any(kw in line.lower() for kw in
                                         ["port", "puerto", "interface", "ant", "can",
                                          "spi", "usb", "pci", "gps", "rfid",
                                          "power", "light", "brush", "harness",
                                          "850", "jb", "eth"]):
            name = line.lstrip("- ").split(":")[0].strip()
            if name:
                ports.append(name)
    return ports


def _build_image_prompt(block_name: str, ports_physical: list[dict],
                        part_names: list[str]) -> str:
    """Compose the final image generation prompt."""

    connector_lines = "\n".join(
        f'  - {p["name"]}: rendered as a {p["physical"]}, '
        f'with white silkscreen label "{p["name"]}" printed on the PCB surface beside it'
        for p in ports_physical
    ) or "  - (no named ports)"

    parts_str = ", ".join(part_names[:12]) if part_names else "(no sub-parts)"

    prompt = (
        f"Ultra-detailed photorealistic 3D render of an embedded electronics PCB module named '{block_name}'. "
        f"Dark matte green PCB (#0d1117) viewed at a dramatic 3/4 isometric angle with cinematic lighting. "
        f"Glowing teal (#00e5cc) PCB trace lines visible on the board surface. "
        f"Cool-white SMD components (resistors, capacitors, inductors) scattered across the board. "
        f"Central area populated by these sub-modules as physical IC packages: {parts_str}. "
        f"Along the PCB edges, the following physical connectors are mounted:\n"
        f"{connector_lines}\n"
        f"Each connector label is silkscreen-printed directly onto the PCB soldermask in small, clean, "
        f"white sans-serif text right beside the connector body — NOT floating in air, NOT as a callout, "
        f"ONLY as PCB silkscreen text. "
        f"Antennas protrude vertically from the board edge. "
        f"Ray-traced reflections on chip surfaces. Soft blue ambient light. Sharp cast shadows. "
        f"No schematic symbols. No block diagrams. No speech bubbles. No external text overlays. "
        f"8K photorealistic product render quality."
    )
    return prompt[:1000]


class Summarizer:
    def __init__(self):
        if AI_PROVIDER == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
            ) if api_key else None
        else:
            api_key = os.getenv("OPENAI_API_KEY")
            self.client = AsyncOpenAI(
                api_key=api_key,
            ) if api_key else None

    async def summarize_block(self, block: Block, graph: ProjectGraph) -> dict:
        context = graph.build_block_context(block)
        project_ctx = graph.build_project_summary()
        if not self.client:
            return {"error": f"Proveedor IA no configurado: {AI_PROVIDER}", "context": context}

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
        ports = _extract_ports(context)
        ports_physical = _map_ports_to_physical(ports)
        part_names = [p.name for p in getattr(block, "parts", [])]
        return _build_image_prompt(block.name, ports_physical, part_names)

    async def generate_image(self, block: Block, graph: ProjectGraph) -> dict:
        """Genera imagen con gpt-image-1 quality=high. Devuelve data URI base64."""

        if AI_PROVIDER != "openai":
            return {"error": "La generación de imágenes requiere AI_PROVIDER=openai"}
        if not self.client:
            return {"error": "OPENAI_API_KEY no configurada"}

        context = graph.build_block_context(block)

        # Extraer puertos y partes del contexto
        ports = _extract_ports(context)
        if not ports:
            # Fallback: pedirle al LLM que extraiga los puertos
            extract_response = await self.client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "Extract port/interface names only. Return one name per line, no explanations."},
                    {"role": "user", "content": f"Block context:\n{context}\n\nList all port and interface names:"},
                ],
                temperature=0.0,
            )
            raw = extract_response.choices[0].message.content
            ports = [ln.strip().lstrip("-• ") for ln in raw.splitlines() if ln.strip()]

        ports_physical = _map_ports_to_physical(ports)
        part_names = [p.name for p in getattr(block, "parts", [])]
        image_prompt = _build_image_prompt(block.name, ports_physical, part_names)

        # gpt-image-1 genera la imagen en base64, calidad high
        image_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        image_response = await image_client.images.generate(
            model="gpt-image-1",
            prompt=image_prompt,
            size="1024x1024",
            quality="high",
            n=1,
        )

        img_data = image_response.data[0]
        if getattr(img_data, "b64_json", None):
            image_src = f"data:image/png;base64,{img_data.b64_json}"
        else:
            image_src = img_data.url or ""

        return {
            "block_id": block.id,
            "block_name": block.name,
            "image_url": image_src,
            "prompt_used": image_prompt,
        }

    async def answer_question(self, question: str, graph: ProjectGraph) -> str:
        project_ctx = graph.build_project_summary()
        top_blocks = list(graph.blocks.values())[:20]
        blocks_ctx = "\n---\n".join(
            graph.build_block_context(b) for b in top_blocks
        )
        if not self.client:
            return f"Proveedor IA no configurado: {AI_PROVIDER}"

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
