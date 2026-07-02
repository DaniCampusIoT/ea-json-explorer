"""Parser del JSON exportado por Enterprise Architect.

El export de EA mezcla packages, umlClass (blocks), umlPort, umlPart
y Connector en una estructura plana dentro de 'elements'.
Este módulo normaliza eso a entidades bien tipadas.
"""
from __future__ import annotations
from typing import Any

from graph.model import (
    ProjectGraph, Package, Block, Port, Part, Connector
)


class EAParser:
    def __init__(self, data: dict | list):
        # El export puede ser un dict raíz o una lista de elementos
        self.data = data

    def build_graph(self) -> ProjectGraph:
        graph = ProjectGraph()
        elements = self._extract_elements(self.data)

        # Primera pasada: crear nodos
        for el in elements:
            etype = (el.get("type") or "").lower()
            if etype == "package":
                graph.add_package(self._parse_package(el))
            elif etype in ("umlclass", "class") and self._is_block(el):
                graph.add_block(self._parse_block(el))
            elif etype == "umlport":
                graph.add_port(self._parse_port(el))
            elif etype == "umlpart":
                graph.add_part(self._parse_part(el))

        # Segunda pasada: conectores (necesitan que los nodos existan)
        for el in elements:
            etype = (el.get("type") or "").lower()
            if etype == "connector":
                graph.add_connector(self._parse_connector(el))

        graph.resolve_relationships()
        return graph

    # ------------------------------------------------------------------
    # Extracción de elementos
    # ------------------------------------------------------------------

    def _extract_elements(self, data: Any) -> list[dict]:
        """Aplana la estructura del JSON de EA en una lista de elementos."""
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Formatos comunes: {"elements": [...]}, {"model": {"elements": [...]}}
            for key in ("elements", "model", "packagedElement", "ownedElement"):
                if key in data:
                    return self._extract_elements(data[key])
            # Si el dict tiene "xmi:type" es un elemento directo
            if any(k for k in data if ":" in k or k == "type"):
                return [data]
        return []

    # ------------------------------------------------------------------
    # Parsers por tipo
    # ------------------------------------------------------------------

    def _is_block(self, el: dict) -> bool:
        stereotype = (el.get("stereotype") or "").lower()
        return stereotype == "block" or "block" in str(el.get("stereotypes", "")).lower()

    def _parse_package(self, el: dict) -> Package:
        return Package(
            id=el.get("id") or el.get("xmi:id") or el.get("_id", ""),
            name=el.get("name") or el.get("packagename", ""),
            parent_id=el.get("owner") or el.get("parent") or el.get("package"),
            documentation=el.get("documentation") or el.get("notes", ""),
            raw=el,
        )

    def _parse_block(self, el: dict) -> Block:
        return Block(
            id=el.get("id") or el.get("xmi:id") or el.get("_id", ""),
            name=el.get("name", ""),
            package_id=el.get("package") or el.get("owner"),
            stereotype=el.get("stereotype", "block"),
            documentation=el.get("documentation") or el.get("notes", ""),
            raw=el,
        )

    def _parse_port(self, el: dict) -> Port:
        return Port(
            id=el.get("id") or el.get("xmi:id", ""),
            name=el.get("name", ""),
            owner_id=el.get("owner") or el.get("parent"),
            direction=el.get("direction") or el.get("tpe"),
            documentation=el.get("documentation", ""),
            raw=el,
        )

    def _parse_part(self, el: dict) -> Part:
        return Part(
            id=el.get("id") or el.get("xmi:id", ""),
            name=el.get("name", ""),
            owner_id=el.get("owner") or el.get("parent"),
            type_id=el.get("propertyType") or el.get("type"),
            reuses_id=el.get("reusesProperty"),
            documentation=el.get("documentation", ""),
            raw=el,
        )

    def _parse_connector(self, el: dict) -> Connector:
        return Connector(
            id=el.get("id") or el.get("xmi:id", ""),
            name=el.get("name", ""),
            source_id=el.get("source") or el.get("start") or el.get("from"),
            target_id=el.get("target") or el.get("end") or el.get("to"),
            connector_type=el.get("type") or el.get("subtype", ""),
            label=el.get("label") or el.get("notes", ""),
            raw=el,
        )
