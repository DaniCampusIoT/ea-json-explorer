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


# Encodings que EA suele usar segun version y plataforma
_EA_ENCODINGS = ["utf-8", "windows-1252", "latin-1", "iso-8859-1"]


def _extract_declared_encoding(content: bytes) -> str | None:
    """Lee el encoding declarado en <?xml ... encoding="..."?> si existe."""
    m = re.search(rb'encoding=["\']([^"\']+)["\']', content[:200])
    if m:
        return m.group(1).decode("ascii", errors="ignore").lower()
    return None


def _decode_content(content: bytes) -> str:
    """
    Decodifica el contenido de bytes a str usando el siguiente orden:
    1. BOM UTF-16 LE/BE
    2. BOM UTF-8
    3. Encoding declarado en <?xml ...?>
    4. Prueba con utf-8, windows-1252, latin-1 en ese orden
    """
    # 1. BOM UTF-16
    if content[:2] in (b'\xff\xfe', b'\xfe\xff'):
        return content.decode('utf-16')

    # 2. BOM UTF-8 — eliminar y tratar como utf-8
    if content[:3] == b'\xef\xbb\xbf':
        return content[3:].decode('utf-8')

    # 3. Encoding declarado en la cabecera XML
    declared = _extract_declared_encoding(content)
    if declared:
        # EA exporta a veces como "windows-1252" o "iso-8859-1"
        enc = declared.replace("iso-8859-1", "windows-1252")  # superset mas seguro
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            pass  # fallthrough a deteccion automatica

    # 4. Prueba secuencial de encodings tipicos
    for enc in _EA_ENCODINGS:
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue

    # Ultimo recurso: reemplazar caracteres invalidos
    return content.decode("latin-1", errors="replace")


def xml_to_dict(content: bytes) -> dict:
    # Decodificar con el encoding correcto a str Unicode
    text = _decode_content(content)

    # Re-codificar a UTF-8 con declaracion XML normalizada
    text = re.sub(
        r'(<\?xml[^?]*?)encoding=["\'][^"\']*["\']',
        r'\1encoding="utf-8"',
        text,
        count=1,
    )
    # Si no habia declaracion, anadir una
    if not text.lstrip().startswith('<?xml'):
        text = '<?xml version="1.0" encoding="utf-8"?>\n' + text

    content_utf8 = text.encode('utf-8')

    try:
        root = ET.fromstring(content_utf8)
    except ET.ParseError as e:
        raise ValueError(f"XML inválido: {e}") from e

    tag = _strip_ns(root.tag)
    return {tag: _elem_to_dict(root)}
