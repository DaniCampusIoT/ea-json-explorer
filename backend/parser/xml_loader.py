"""xml_loader.py — Convierte un archivo XMI/XML de EA a dict compatible con EAParser."""
from __future__ import annotations
import xml.etree.ElementTree as ET
import re


def _strip_ns(tag: str) -> str:
    return re.sub(r'\{[^}]+\}', '', tag)


def _attrib_key(name: str) -> str:
    return f"_{name}"


def _elem_to_dict(elem: ET.Element) -> dict:
    result: dict = {}
    for k, v in elem.attrib.items():
        result[_attrib_key(k)] = v
    children: dict[str, list] = {}
    for child in elem:
        tag = _strip_ns(child.tag)
        d = _elem_to_dict(child)
        children.setdefault(tag, []).append(d)
    for tag, items in children.items():
        result[tag] = items if len(items) > 1 else items[0]
    text = (elem.text or "").strip()
    if text and not children:
        result["_text"] = text
    return result


def _clean(content: bytes) -> bytes:
    """Elimina BOM UTF-8/UTF-16 y normaliza la declaracion de encoding a UTF-8."""
    # BOM UTF-16 LE/BE
    if content[:2] in (b'\xff\xfe', b'\xfe\xff'):
        content = content.decode('utf-16').encode('utf-8')
    # BOM UTF-8
    if content[:3] == b'\xef\xbb\xbf':
        content = content[3:]
    # Normaliza encoding="xxx" -> encoding="utf-8" en la declaracion XML
    content = re.sub(
        rb'(<\?xml[^?]*?)encoding=["\'][^"\']*["\']',
        rb'\1encoding="utf-8"',
        content,
        count=1,
    )
    return content


def xml_to_dict(content: bytes) -> dict:
    content = _clean(content)
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        # Intento de rescate con latin-1
        try:
            root = ET.fromstring(content.decode('latin-1').encode('utf-8'))
        except Exception:
            raise ValueError(f"XML inválido: {e}") from e
    tag = _strip_ns(root.tag)
    return {tag: _elem_to_dict(root)}
