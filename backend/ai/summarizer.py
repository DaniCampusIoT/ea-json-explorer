"""Módulo IA: genera resúmenes, fichas y prompts visuales usando OpenAI o Groq."""
from __future__ import annotations
import os
import re
from difflib import SequenceMatcher
from openai import AsyncOpenAI
from graph.model import Block, ProjectGraph

AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()

if AI_PROVIDER == "groq":
    MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
else:
    MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# Modelos que NO aceptan el parámetro temperature (sólo admiten el valor por defecto).
# Incluye la familia GPT-5.x y los modelos de razonamiento o-series.
_NO_TEMPERATURE_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _supports_temperature(model: str) -> bool:
    return not model.lower().startswith(_NO_TEMPERATURE_PREFIXES)


def _chat_kwargs(temperature: float) -> dict:
    """Devuelve kwargs extra para chat.completions.create según el modelo activo."""
    if _supports_temperature(MODEL):
        return {"temperature": temperature}
    return {}


SYSTEM_PROMPT = """Eres un experto en arquitectura de sistemas embebidos y SysML.
Analiza la información estructural de un proyecto Enterprise Architect y responde en español.

NORMAS DE FORMATO — sé siempre fiel a estas reglas:
- Usa Markdown con encabezados (## y ###), negritas, listas y tablas cuando añadan claridad.
- Los nombres de bloques, puertos e interfaces escríbelos en `backticks`.
- En tablas: columnas alineadas, sin celdas vacías, máximo 4 columnas.
- Respuestas técnicas, directas y concisas: sin introducciones ni despedidas genéricas.
- Para fichas de bloque, usa SIEMPRE esta estructura:

## 🧱 [Nombre del bloque]

### Función principal
(1-2 frases)

### Contenido estructural
| Parte / Puerto | Tipo | Descripción |
|---|---|---|
| ... | ... | ... |

### Dependencias y conexiones
(lista con `bloque_origen` → `bloque_destino`)

### ⚠️ Alertas
(documentación incompleta, dependencias no resueltas, TODOs)
"""


# ---------------------------------------------------------------------------
# Physical connector map (regex -> description)
# ---------------------------------------------------------------------------
_PORT_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r'850[Vv]', re.I),
     "high-voltage screw terminal block (850V, orange, 3-pin)"),
    (re.compile(r'DC.?BUS|DCBUS', re.I),
     "DC bus screw terminal (24V, blue, 2-pin)"),
    (re.compile(r'PowerInLAN|PowerIn.*LAN|LAN.*Power', re.I),
     "PoE RJ45 jack with integrated magnetics"),
    (re.compile(r'PowerIn|Power.?In|PWR.?IN', re.I),
     "screw terminal block power input (green, 2-pin)"),
    (re.compile(r'PowerOut|Power.?Out|PWR.?OUT', re.I),
     "screw terminal block power output (green, 2-pin)"),
    (re.compile(r'PWR|VCC|VIN|VOUT|HV|High.?Volt', re.I),
     "screw terminal power connector (2-pin)"),
    (re.compile(r'ANT.?MPU5|MPU5', re.I),
     "RP-SMA female connector for MPU5 MIMO antenna (silver, panel-mount)"),
    (re.compile(r'ANT.?5G|5G', re.I),
     "SMA female 5G cellular stub antenna (black, 80mm)"),
    (re.compile(r'ANT.?GPS|GPS', re.I),
     "SMA female GPS stub antenna (black, 50mm)"),
    (re.compile(r'ANT.?RFID|RFID', re.I),
     "SMA female RFID stub antenna (grey, 40mm)"),
    (re.compile(r'ANT.?Telemetry|Telemetry', re.I),
     "SMA female telemetry whip antenna (white, 60mm)"),
    (re.compile(r'ANT|Antenna', re.I),
     "SMA female stub antenna"),
    (re.compile(r'CAN.?FD', re.I),
     "DB9 male connector (CAN FD bus)"),
    (re.compile(r'CAN', re.I),
     "DB9 male connector (CAN bus)"),
    (re.compile(r'SPI|RS.?422|RS.?485', re.I),
     "2.54 mm pin header (6-pin, SPI/RS422)"),
    (re.compile(r'UART|SERIAL', re.I),
     "2.54 mm pin header (4-pin, UART)"),
    (re.compile(r'I2C|TWI', re.I),
     "2.54 mm pin header (4-pin, I2C)"),
    (re.compile(r'USB', re.I),
     "USB-C female receptacle"),
    (re.compile(r'PCI', re.I),
     "PCIe edge connector"),
    (re.compile(r'ETH|Ethernet|RJ45|LAN', re.I),
     "RJ45 shielded Ethernet jack"),
    (re.compile(r'Light|LED', re.I),
     "JST-PH 4-pin white connector (LED lighting)"),
    (re.compile(r'Brush|BWS', re.I),
     "Molex MicroFit 2-pin connector (brush state)"),
    (re.compile(r'Harness', re.I),
     "automotive wiring harness multi-pin connector (black, 12-pin)"),
    (re.compile(r'JB[LR]|Junction', re.I),
     "sealed junction box connector (IP67, 8-pin)"),
]

_DEFAULT_CONNECTOR = "generic 2.54 mm header connector (2-pin)"


# ---------------------------------------------------------------------------
# Port / Part extraction from graph
# ---------------------------------------------------------------------------

def _ports_from_graph(block: Block, graph: ProjectGraph) -> list[str]:
    names: list[str] = []
    for pid in block.port_ids:
        port = graph.ports.get(pid)
        if port and port.name:
            names.append(port.name.strip())
    return list(dict.fromkeys(names))


def _parts_from_graph(block: Block, graph: ProjectGraph) -> list[str]:
    names: list[str] = []
    for pid in block.part_ids:
        part = graph.parts.get(pid)
        if part and part.name:
            names.append(part.name.strip())
    return list(dict.fromkeys(names))


def _fuzzy_match(candidate: str, valid: list[str], threshold: float = 0.75) -> str | None:
    best, best_score = None, 0.0
    c_lower = candidate.lower()
    for v in valid:
        score = SequenceMatcher(None, c_lower, v.lower()).ratio()
        if score > best_score:
            best, best_score = v, score
    return best if best_score >= threshold else None


def _validate_llm_ports(llm_ports: list[str], real_ports: list[str]) -> list[str]:
    validated: list[str] = []
    used: set[str] = set()
    for candidate in llm_ports:
        real = _fuzzy_match(candidate, real_ports)
        if real and real not in used:
            validated.append(real)
            used.add(real)
    for rp in real_ports:
        if rp not in used:
            validated.append(rp)
    return validated


def _map_port_to_physical(name: str) -> str:
    for pattern, description in _PORT_MAP:
        if pattern.search(name):
            return description
    return _DEFAULT_CONNECTOR


# ---------------------------------------------------------------------------
# Prompt builder (image)
# ---------------------------------------------------------------------------

def _build_image_prompt(block_name: str, ports: list[str], part_names: list[str]) -> str:
    connector_lines = "\n".join(
        f'  - {p}: rendered as a {_map_port_to_physical(p)}, '
        f'silkscreen label "{p}" printed on the PCB soldermask beside it'
        for p in ports
    ) or "  - (no named ports)"

    parts_str = ", ".join(part_names[:12]) if part_names else "(no sub-parts)"

    prompt = (
        f"Ultra-detailed photorealistic 3D render of an embedded electronics PCB module named '{block_name}'. "
        f"Dark matte green PCB (#0d1117), dramatic 3/4 isometric angle, cinematic lighting. "
        f"Glowing teal (#00e5cc) PCB trace lines. Cool-white SMD passives across the board. "
        f"Central IC packages representing: {parts_str}. "
        f"Physical connectors mounted on PCB edges:\n{connector_lines}\n"
        f"Each label is silkscreen-printed ON the PCB soldermask right next to each connector — "
        f"small clean white sans-serif text, NOT floating in air, NOT callout bubbles. "
        f"Antennas protrude vertically from board edge. "
        f"Ray-traced reflections on chip surfaces. Soft blue ambient light. Sharp shadows. "
        f"No schematic symbols. No block diagrams. No external overlays. 8K product render."
    )
    return prompt[:1100]


# ---------------------------------------------------------------------------
# Summarizer
# ---------------------------------------------------------------------------

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
            self.client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def _get_validated_ports(
        self, block: Block, graph: ProjectGraph, context: str
    ) -> list[str]:
        real_ports = _ports_from_graph(block, graph)
        if real_ports:
            return real_ports
        if not self.client:
            return real_ports
        try:
            response = await self.client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": (
                        "You are a precise technical extractor. "
                        "Given a SysML block context, list ONLY the port and interface names "
                        "exactly as they appear in the text. "
                        "Output one name per line. No explanations."
                    )},
                    {"role": "user", "content": f"Block context:\n{context}\n\nList all port names:"},
                ],
                **_chat_kwargs(0.0),
            )
            raw = response.choices[0].message.content
            llm_ports = [ln.strip().lstrip("-•* ") for ln in raw.splitlines() if ln.strip()]
            context_names = [
                ln.strip().lstrip("- ").split(":")[0].strip()
                for ln in context.splitlines() if ln.strip().startswith("-")
            ]
            return _validate_llm_ports(llm_ports, context_names)
        except Exception:
            return real_ports

    async def summarize_block(self, block: Block, graph: ProjectGraph) -> dict:
        context = graph.build_block_context(block)
        project_ctx = graph.build_project_summary()
        if not self.client:
            return {"error": f"Proveedor IA no configurado: {AI_PROVIDER}", "context": context}

        prompt = (
            f"**Proyecto:** {project_ctx}\n\n"
            f"{context}\n\n"
            "Genera la ficha completa del bloque según la estructura del system prompt.\n"
            "Usa Markdown. Incluye tabla de partes/puertos si hay datos. "
            "Termina con la sección de Alertas aunque esté vacía."
        )
        response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            **_chat_kwargs(0.3),
        )
        return {
            "block_id":    block.id,
            "block_name":  block.name,
            "summary":     response.choices[0].message.content,
            "context_used": context,
        }

    async def generate_image_prompt(self, block: Block, graph: ProjectGraph) -> str:
        context = graph.build_block_context(block)
        ports = await self._get_validated_ports(block, graph, context)
        part_names = _parts_from_graph(block, graph)
        return _build_image_prompt(block.name, ports, part_names)

    async def generate_image(self, block: Block, graph: ProjectGraph) -> dict:
        """Genera imagen con gpt-image-1 quality=high."""
        if AI_PROVIDER != "openai":
            return {"error": "La generación de imágenes requiere AI_PROVIDER=openai"}
        if not self.client:
            return {"error": "OPENAI_API_KEY no configurada"}

        context = graph.build_block_context(block)
        ports = await self._get_validated_ports(block, graph, context)
        part_names = _parts_from_graph(block, graph)
        image_prompt = _build_image_prompt(block.name, ports, part_names)

        image_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        image_response = await image_client.images.generate(
            model="gpt-image-1",
            prompt=image_prompt,
            size="1024x1024",
            quality="high",
            n=1,
        )
        img_data = image_response.data[0]
        image_src = (
            f"data:image/png;base64,{img_data.b64_json}"
            if getattr(img_data, "b64_json", None)
            else (img_data.url or "")
        )
        return {
            "block_id":    block.id,
            "block_name":  block.name,
            "image_url":   image_src,
            "prompt_used": image_prompt,
        }

    async def answer_question(self, question: str, graph: ProjectGraph) -> str:
        project_ctx = graph.build_project_summary()
        top_blocks = list(graph.blocks.values())[:20]
        blocks_ctx = "\n---\n".join(graph.build_block_context(b) for b in top_blocks)
        if not self.client:
            return f"Proveedor IA no configurado: {AI_PROVIDER}"

        prompt = (
            f"**Proyecto:** {project_ctx}\n\n"
            f"**Bloques principales:**\n{blocks_ctx}\n\n"
            f"**Pregunta:** {question}\n\n"
            "Responde en Markdown. Usa tablas o listas cuando mejoren la claridad. "
            "Si la respuesta involucra múltiples bloques, créa una tabla comparativa."
        )
        response = await self.client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            **_chat_kwargs(0.4),
        )
        return response.choices[0].message.content
