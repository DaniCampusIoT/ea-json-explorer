"""xml_loader.py — Convierte un archivo XMI/XML de EA a dict compatible con EAParser.

Usa xml.etree.ElementTree (stdlib, sin dependencias extra).
Convierte atributos XML en claves con prefijo '_' y elementos hijos
como listas, replicando la misma estructura que produce el JSON de EA.
"""
from __future__ import annotations
import xml.etree.ElementTree as ET
import re


def _strip_ns(tag: str) -> str:
    """Elimina el namespace de una etiqueta: {http://...}Class -> Class."""
    return re.sub(r'\{[^}]+\}', '', tag)


def _attrib_key(name: str) -> str:
    """Convierte 'xmi:type' -> '_xmi:type' para que EAParser lo reconozca."""
    return f"_{name}"


def _elem_to_dict(elem: ET.Element) -> dict:
    """Convierte un elemento XML en un dict con la misma forma que el JSON de EA."""
    result: dict = {}

    # Atributos del elemento -> claves con '_'
    for k, v in elem.attrib.items():
        result[_attrib_key(k)] = v

    # Hijos
    children: dict[str, list] = {}
    for child in elem:
        tag = _strip_ns(child.tag)
        d = _elem_to_dict(child)
        children.setdefault(tag, []).append(d)

    for tag, items in children.items():
        result[tag] = items if len(items) > 1 else items[0]

    # Texto (si existe y no hay hijos)
    text = (elem.text or "").strip()
    if text and not children:
        result["_text"] = text

    return result


def xml_to_dict(content: bytes) -> dict:
    """
    Parsea un archivo XMI/XML y devuelve un dict compatible con EAParser.

    Estructura de salida:
      {
        "XMI": {
          "Model": { ... },
          "packagedElement": [ ... ],
          ...
        }
      }
    """
    root = ET.fromstring(content)
    tag  = _strip_ns(root.tag)   # p.ej. "XMI"
    return {tag: _elem_to_dict(root)}
