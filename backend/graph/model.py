"""Modelo interno del grafo de un proyecto EA.

Entidades: Package, Block, Port, Part, Connector, ProjectGraph.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import networkx as nx


@dataclass
class Package:
    id: str
    name: str
    parent_id: Optional[str] = None
    documentation: str = ""
    children_ids: list[str] = field(default_factory=list)
    block_ids: list[str] = field(default_factory=list)
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "parent_id": self.parent_id,
            "documentation": self.documentation,
            "children_count": len(self.children_ids),
            "block_count": len(self.block_ids),
        }


@dataclass
class Block:
    id: str
    name: str
    package_id: Optional[str] = None
    stereotype: str = "block"
    documentation: str = ""
    port_ids: list[str] = field(default_factory=list)
    part_ids: list[str] = field(default_factory=list)
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "package_id": self.package_id,
            "stereotype": self.stereotype,
            "documentation": self.documentation,
            "port_count": len(self.port_ids),
            "part_count": len(self.part_ids),
        }

    def to_dict_full(self, graph: "ProjectGraph") -> dict:
        d = self.to_dict()
        d["ports"] = [
            graph.ports[pid].to_dict()
            for pid in self.port_ids
            if pid in graph.ports
        ]
        d["parts"] = [
            graph.parts[pid].to_dict()
            for pid in self.part_ids
            if pid in graph.parts
        ]
        d["connected_to"] = [
            {"block_id": nid, "block_name": graph.blocks[nid].name}
            for nid in graph.nx_graph.neighbors(self.id)
            if nid in graph.blocks
        ]
        return d


@dataclass
class Port:
    id: str
    name: str
    owner_id: Optional[str] = None
    direction: Optional[str] = None
    documentation: str = ""
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "owner_id": self.owner_id,
            "direction": self.direction,
            "documentation": self.documentation,
        }


@dataclass
class Part:
    id: str
    name: str
    owner_id: Optional[str] = None
    type_id: Optional[str] = None
    reuses_id: Optional[str] = None
    documentation: str = ""
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "owner_id": self.owner_id,
            "type_id": self.type_id,
            "reuses_id": self.reuses_id,
            "documentation": self.documentation,
        }


@dataclass
class Connector:
    id: str
    name: str
    source_id: Optional[str] = None
    target_id: Optional[str] = None
    connector_type: str = ""
    label: str = ""
    raw: dict = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "connector_type": self.connector_type,
            "label": self.label,
        }


class ProjectGraph:
    """Grafo completo del proyecto EA con índices por ID."""

    def __init__(self):
        self.packages: dict[str, Package] = {}
        self.blocks: dict[str, Block] = {}
        self.ports: dict[str, Port] = {}
        self.parts: dict[str, Part] = {}
        self.connectors: dict[str, Connector] = {}
        self.nx_graph: nx.DiGraph = nx.DiGraph()

    # ------------------------------------------------------------------
    # Adición de entidades
    # ------------------------------------------------------------------

    def add_package(self, p: Package):
        self.packages[p.id] = p

    def add_block(self, b: Block):
        self.blocks[b.id] = b
        self.nx_graph.add_node(b.id, type="block", name=b.name)

    def add_port(self, p: Port):
        self.ports[p.id] = p

    def add_part(self, p: Part):
        self.parts[p.id] = p

    def add_connector(self, c: Connector):
        self.connectors[c.id] = c
        if c.source_id and c.target_id:
            self.nx_graph.add_edge(
                c.source_id, c.target_id,
                connector_type=c.connector_type,
                label=c.label,
            )

    # ------------------------------------------------------------------
    # Resolución de relaciones
    # ------------------------------------------------------------------

    def resolve_relationships(self):
        """Asigna puertos y partes a sus bloques propietarios."""
        for port in self.ports.values():
            if port.owner_id and port.owner_id in self.blocks:
                self.blocks[port.owner_id].port_ids.append(port.id)

        for part in self.parts.values():
            if part.owner_id and part.owner_id in self.blocks:
                self.blocks[part.owner_id].part_ids.append(part.id)

        for package in self.packages.values():
            if package.parent_id and package.parent_id in self.packages:
                self.packages[package.parent_id].children_ids.append(package.id)

        for block in self.blocks.values():
            if block.package_id and block.package_id in self.packages:
                self.packages[block.package_id].block_ids.append(block.id)

    # ------------------------------------------------------------------
    # Contexto para IA
    # ------------------------------------------------------------------

    def build_block_context(self, block: Block) -> str:
        """Construye un texto de contexto enriquecido para un bloque."""
        lines = []
        lines.append(f"# Bloque: {block.name}")
        lines.append(f"Estereotipo: {block.stereotype}")
        if block.documentation:
            lines.append(f"Documentación: {block.documentation}")

        # Package
        if block.package_id and block.package_id in self.packages:
            pkg = self.packages[block.package_id]
            lines.append(f"Paquete: {pkg.name}")

        # Puertos
        if block.port_ids:
            lines.append("\nPuertos:")
            for pid in block.port_ids:
                if pid in self.ports:
                    p = self.ports[pid]
                    dir_str = f" [{p.direction}]" if p.direction else ""
                    lines.append(f"  - {p.name}{dir_str}: {p.documentation}")

        # Partes
        if block.part_ids:
            lines.append("\nPartes internas:")
            for pid in block.part_ids:
                if pid in self.parts:
                    pt = self.parts[pid]
                    type_name = ""
                    if pt.type_id and pt.type_id in self.blocks:
                        type_name = f" : {self.blocks[pt.type_id].name}"
                    lines.append(f"  - {pt.name}{type_name}: {pt.documentation}")

        # Conexiones
        neighbors = list(self.nx_graph.neighbors(block.id))
        if neighbors:
            lines.append("\nConectado a:")
            for nid in neighbors:
                nname = self.blocks.get(nid, {}).name if nid in self.blocks else nid
                edge = self.nx_graph.edges.get((block.id, nid), {})
                label = edge.get("label", "")
                conn_type = edge.get("connector_type", "")
                lines.append(f"  - {nname} [{conn_type}] {label}")

        return "\n".join(lines)

    def build_project_summary(self) -> str:
        """Resumen de alto nivel del proyecto completo."""
        return (
            f"Proyecto con {len(self.packages)} paquetes, "
            f"{len(self.blocks)} bloques, "
            f"{len(self.ports)} puertos, "
            f"{len(self.parts)} partes y "
            f"{len(self.connectors)} conectores."
        )
