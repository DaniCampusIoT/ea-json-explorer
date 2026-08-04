"""Parser del JSON exportado por Enterprise Architect.

Soporta dos formatos:
  1. Formato XMI clásico (claves _xmi:type, _name, packagedElement, ...)
  2. Formato compacto ART  (raiz {elements:[...]}, claves t/n/p/st/attrs/conns/ports)
"""
from __future__ import annotations
from typing import Any
import re

from graph.model import ProjectGraph, Package, Block, Port, Part, Connector


# ---------------------------------------------------------------------------
# Helpers comunes
# ---------------------------------------------------------------------------

def _get(el: dict, *keys) -> str:
    for k in keys:
        v = el.get(k)
        if v and isinstance(v, str):
            return v
    return ""


def _strip_html(text: str) -> str:
    """Elimina etiquetas HTML básicas de los campos doc."""
    return re.sub(r'<[^>]+>', '', text or '').strip()


# ---------------------------------------------------------------------------
# Formato compacto ART:  { "elements": [ {id, t, n, p, st, doc, attrs, conns} ] }
# ---------------------------------------------------------------------------

class _ArtParser:
    """Parsea el formato compacto propio del proyecto ART."""

    def build_graph(self, data: dict) -> ProjectGraph:
        graph = ProjectGraph()
        elements: list[dict] = data.get("elements", [])

        # --- Primera pasada: crear entidades ---
        for el in elements:
            self._process_element(el, graph)

        # --- Segunda pasada: ports embebidos en attrs ---
        for el in elements:
            self._process_attrs(el, graph)

        # --- Tercera pasada: conectores ---
        for el in elements:
            self._process_conns(el, graph)

        graph.resolve_relationships()
        return graph

    def _process_element(self, el: dict, graph: ProjectGraph) -> None:
        eid  = str(el.get("id", ""))
        etype = el.get("t", "")
        name = el.get("n") or ""
        parent = str(el.get("p", "") or "")
        doc  = _strip_html(el.get("doc", "") or "")
        st   = el.get("st") or []
        stereotype = st[0] if st else "block"

        if etype == "Package":
            graph.add_package(Package(
                id=eid, name=name, parent_id=parent,
                documentation=doc, raw=el,
            ))
        elif etype in ("Class", "Component"):
            graph.add_block(Block(
                id=eid, name=name, package_id=parent,
                stereotype=stereotype,
                documentation=doc, raw=el,
            ))
        # Dependency se procesa como conector en _process_conns

    def _process_attrs(self, el: dict, graph: ProjectGraph) -> None:
        """Procesa attrs (partes compuestas) y sus ports embebidos."""
        owner_id = str(el.get("id", ""))
        for attr in (el.get("attrs") or []):
            aid   = str(attr.get("id", ""))
            aname = attr.get("n") or ""
            atype = str(attr.get("type", "") or "")
            agg   = attr.get("agg", "")

            graph.add_part(Part(
                id=aid, name=aname, owner_id=owner_id,
                type_id=atype,
                reuses_id="",
                documentation="",
                raw=attr,
            ))

            # Ports dentro del attr
            for port in (attr.get("ports") or []):
                pid   = str(port.get("id", ""))
                pname = port.get("n") or ""
                graph.add_port(Port(
                    id=pid, name=pname, owner_id=aid,
                    direction="",
                    documentation="",
                    raw=port,
                ))

    def _process_conns(self, el: dict, graph: ProjectGraph) -> None:
        """Procesa conns (conexiones físicas) y Dependencies."""
        eid = str(el.get("id", ""))

        # conns embebidas en un Class/Package
        for conn in (el.get("conns") or []):
            cid  = str(conn.get("id", ""))
            ends = conn.get("ends") or []
            src  = str(ends[0]) if len(ends) > 0 else ""
            tgt  = str(ends[1]) if len(ends) > 1 else ""
            sts  = conn.get("st") or []
            graph.add_connector(Connector(
                id=cid, name="",
                source_id=src, target_id=tgt,
                connector_type=sts[0] if sts else "connector",
                label="",
                raw=conn,
            ))

        # Dependency a nivel de elemento (t=="Dependency")
        if el.get("t") == "Dependency":
            graph.add_connector(Connector(
                id=eid, name=el.get("n") or "",
                source_id=str(el.get("client",   "") or ""),
                target_id=str(el.get("supplier", "") or ""),
                connector_type="dependency",
                label="",
                raw=el,
            ))


# ---------------------------------------------------------------------------
# Formato XMI clásico
# ---------------------------------------------------------------------------

_PACKAGE_TYPES   = {"uml:package", "uml:model"}
_BLOCK_TYPES     = {"uml:class", "uml:component"}
_PORT_TYPES      = {"uml:port"}
_PART_TYPES      = {"uml:property"}
_CONNECTOR_TYPES = {"uml:connector", "uml:association", "uml:dependency",
                    "uml:informationflow", "uml:realization", "uml:usage"}


class _XmiParser:
    def __init__(self, data: Any):
        self.data = data
        self._id_parent: dict[str, str] = {}

    def build_graph(self) -> ProjectGraph:
        graph = ProjectGraph()
        root = self._find_root(self.data)
        self._walk(root, parent_id=None, graph=graph)
        graph.resolve_relationships()
        return graph

    def _find_root(self, data: Any) -> Any:
        if isinstance(data, list):
            return data
        if not isinstance(data, dict):
            return {}
        for key in ("XMI", "xmi:XMI"):
            if key in data:
                return self._find_root(data[key])
        for key in ("Model", "uml:Model"):
            if key in data:
                return self._find_root(data[key])
        return data

    def _walk(self, node: Any, parent_id: str | None, graph: ProjectGraph) -> None:
        if isinstance(node, list):
            for item in node:
                self._walk(item, parent_id, graph)
            return
        if not isinstance(node, dict):
            return

        xmi_type = _get(node, "_xmi:type", "xmi:type", "_type").lower()
        xmi_id   = _get(node, "_xmi:id",   "xmi:id",   "_id")
        name     = _get(node, "_name",      "name")

        if xmi_id:
            self._id_parent[xmi_id] = parent_id or ""

        if xmi_type in _PACKAGE_TYPES:
            doc = _get(node, "_documentation", "documentation", "_notes", "notes")
            graph.add_package(Package(id=xmi_id, name=name, parent_id=parent_id or "",
                                      documentation=doc, raw=node))
            self._recurse_children(node, xmi_id, graph)

        elif xmi_type in _BLOCK_TYPES:
            doc = _get(node, "_documentation", "documentation", "_notes", "notes")
            stereotype = _get(node, "_stereotype", "stereotype")
            graph.add_block(Block(id=xmi_id, name=name, package_id=parent_id or "",
                                  stereotype=stereotype or "block",
                                  documentation=doc, raw=node))
            self._recurse_children(node, xmi_id, graph)

        elif xmi_type in _PORT_TYPES:
            graph.add_port(Port(id=xmi_id, name=name, owner_id=parent_id or "",
                                direction=_get(node, "_direction", "direction"),
                                documentation=_get(node, "_documentation", "documentation"),
                                raw=node))

        elif xmi_type in _PART_TYPES:
            aggregation = _get(node, "_aggregation", "aggregation")
            type_ref = ""
            type_node = node.get("type") or node.get("_type")
            if isinstance(type_node, dict):
                type_ref = _get(type_node, "_xmi:idref", "xmi:idref")
            else:
                type_ref = _get(node, "_propertyType", "propertyType")
            graph.add_part(Part(id=xmi_id, name=name, owner_id=parent_id or "",
                                type_id=type_ref,
                                reuses_id=_get(node, "_reusesProperty", "reusesProperty"),
                                documentation=_get(node, "_documentation", "documentation"),
                                raw=node))
            qualifiers = node.get("qualifier") or []
            if isinstance(qualifiers, dict):
                qualifiers = [qualifiers]
            for q in qualifiers:
                self._walk(q, parent_id, graph)

        elif xmi_type in _CONNECTOR_TYPES:
            src = _get(node, "_supplier", "_source", "supplier", "source")
            tgt = _get(node, "_client",   "_target", "client",   "target")
            if not src and isinstance(node.get("end"), list):
                ends = node["end"]
                src = _get(ends[0], "_role", "role") if len(ends) > 0 else ""
                tgt = _get(ends[1], "_role", "role") if len(ends) > 1 else ""
            graph.add_connector(Connector(id=xmi_id, name=name,
                                          source_id=src, target_id=tgt,
                                          connector_type=xmi_type,
                                          label=_get(node, "_label", "label"),
                                          raw=node))
        else:
            self._recurse_children(node, parent_id, graph)

    def _recurse_children(self, node: dict, parent_id: str | None, graph: ProjectGraph) -> None:
        child_keys = [
            "packagedElement", "nestedClassifier",
            "ownedAttribute",  "ownedConnector",
            "ownedOperation",  "ownedElement",
            "ownedBehavior",   "interfaceRealization",
        ]
        for key in child_keys:
            child = node.get(key)
            if child is None:
                continue
            if isinstance(child, list):
                for item in child:
                    self._walk(item, parent_id, graph)
            elif isinstance(child, dict):
                self._walk(child, parent_id, graph)


# ---------------------------------------------------------------------------
# Façade pública
# ---------------------------------------------------------------------------

class EAParser:
    """Detecta el formato automáticamente y delega al parser correcto."""

    def __init__(self, data: dict | list):
        self.data = data

    def build_graph(self) -> ProjectGraph:
        if isinstance(self.data, dict) and "elements" in self.data:
            return _ArtParser().build_graph(self.data)
        return _XmiParser(self.data).build_graph()
