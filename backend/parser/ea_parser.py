"""Parser del JSON exportado por Enterprise Architect (formato XMI con prefijos _xmi:*).

Este parser recorre recursivamente la jerarquía real del export de EA:
  XMI -> Model -> packagedElement (array) -> nestedClassifier / ownedAttribute / qualifier / ownedConnector

Claves reconocidas:
  _xmi:type  -> tipo del elemento (uml:Package, uml:Class, uml:Port, uml:Property, uml:Connector, ...)
  _xmi:id    -> identificador único
  _name      -> nombre del elemento
  _xmi:idref -> referencia a otro elemento (en type.{_xmi:idref})
"""
from __future__ import annotations
from typing import Any

from graph.model import ProjectGraph, Package, Block, Port, Part, Connector


# Tipos de EA que mapean a nuestras entidades
_PACKAGE_TYPES   = {"uml:package", "uml:model"}
_BLOCK_TYPES     = {"uml:class", "uml:component"}
_PORT_TYPES      = {"uml:port"}
_PART_TYPES      = {"uml:property"}
_CONNECTOR_TYPES = {"uml:connector", "uml:association", "uml:dependency",
                    "uml:informationflow", "uml:realization", "uml:usage"}


def _get(el: dict, *keys) -> str:
    """Lee la primera clave que exista en el dict, devuelve '' si ninguna."""
    for k in keys:
        v = el.get(k)
        if v and isinstance(v, str):
            return v
    return ""


class EAParser:
    def __init__(self, data: dict | list):
        self.data = data
        self._id_parent: dict[str, str] = {}  # id -> parent_id

    def build_graph(self) -> ProjectGraph:
        graph = ProjectGraph()
        root = self._find_root(self.data)
        self._walk(root, parent_id=None, graph=graph)
        graph.resolve_relationships()
        return graph

    # ------------------------------------------------------------------ #
    # Encuentra el nodo raíz del modelo
    # ------------------------------------------------------------------ #

    def _find_root(self, data: Any) -> Any:
        """Navega hasta el primer nodo con contenido real."""
        if isinstance(data, list):
            return data
        if not isinstance(data, dict):
            return {}
        # Estructura: { "XMI": { "Model": { "packagedElement": ... } } }
        for key in ("XMI", "xmi:XMI"):
            if key in data:
                return self._find_root(data[key])
        for key in ("Model", "uml:Model"):
            if key in data:
                return self._find_root(data[key])
        return data

    # ------------------------------------------------------------------ #
    # Recorrido recursivo
    # ------------------------------------------------------------------ #

    def _walk(self, node: Any, parent_id: str | None, graph: ProjectGraph) -> None:
        """Recorre recursivamente el nodo y registra entidades en el grafo."""
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

        # --- Package ---
        if xmi_type in _PACKAGE_TYPES:
            doc = _get(node, "_documentation", "documentation", "_notes", "notes")
            graph.add_package(Package(
                id=xmi_id, name=name, parent_id=parent_id or "",
                documentation=doc, raw=node,
            ))
            self._recurse_children(node, xmi_id, graph)

        # --- Block (uml:Class / uml:Component) ---
        elif xmi_type in _BLOCK_TYPES:
            doc = _get(node, "_documentation", "documentation", "_notes", "notes")
            stereotype = _get(node, "_stereotype", "stereotype")
            graph.add_block(Block(
                id=xmi_id, name=name, package_id=parent_id or "",
                stereotype=stereotype or "block",
                documentation=doc, raw=node,
            ))
            self._recurse_children(node, xmi_id, graph)

        # --- Port ---
        elif xmi_type in _PORT_TYPES:
            doc = _get(node, "_documentation", "documentation")
            graph.add_port(Port(
                id=xmi_id, name=name, owner_id=parent_id or "",
                direction=_get(node, "_direction", "direction"),
                documentation=doc, raw=node,
            ))

        # --- Part (uml:Property que NO es puerto) ---
        elif xmi_type in _PART_TYPES:
            aggregation = _get(node, "_aggregation", "aggregation")
            # Resolvemos el tipo referenciado
            type_ref = ""
            type_node = node.get("type") or node.get("_type")
            if isinstance(type_node, dict):
                type_ref = _get(type_node, "_xmi:idref", "xmi:idref")
            else:
                type_ref = _get(node, "_propertyType", "propertyType")

            graph.add_part(Part(
                id=xmi_id, name=name, owner_id=parent_id or "",
                type_id=type_ref,
                reuses_id=_get(node, "_reusesProperty", "reusesProperty"),
                documentation=_get(node, "_documentation", "documentation"),
                raw=node,
            ))
            # Los ports pueden estar en qualifier[] dentro de un ownedAttribute
            qualifiers = node.get("qualifier") or []
            if isinstance(qualifiers, dict):
                qualifiers = [qualifiers]
            for q in qualifiers:
                self._walk(q, parent_id, graph)  # parent = owner del part

        # --- Connector ---
        elif xmi_type in _CONNECTOR_TYPES:
            # source/target pueden venir de atributos directos o de extremos
            src = _get(node, "_supplier", "_source", "supplier", "source")
            tgt = _get(node, "_client",   "_target", "client",   "target")
            if not src and isinstance(node.get("end"), list):
                ends = node["end"]
                src = _get(ends[0], "_role", "role") if len(ends) > 0 else ""
                tgt = _get(ends[1], "_role", "role") if len(ends) > 1 else ""
            graph.add_connector(Connector(
                id=xmi_id, name=name,
                source_id=src, target_id=tgt,
                connector_type=xmi_type,
                label=_get(node, "_label", "label"),
                raw=node,
            ))

        # --- Nodo desconocido pero con hijos: seguir explorando ---
        else:
            self._recurse_children(node, parent_id, graph)

    def _recurse_children(self, node: dict, parent_id: str | None, graph: ProjectGraph) -> None:
        """Recorre todas las claves hijo conocidas de un nodo."""
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
