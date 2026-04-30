"""Agent ABC and concrete GreetAgent for the dungeon library.

This module defines the :class:`Agent` abstract base class, which establishes
the contract that all dungeon agents must satisfy: a single ``respond`` method
that accepts a name string and returns a response string.

:class:`GreetAgent` is the concrete implementation backed by the
``greet→shout`` LangGraph pipeline defined in :mod:`dungeon.graph`.  It
satisfies the dynamic-loading pattern: callers may discover and instantiate
agents at runtime via :mod:`importlib` without needing a direct import of
this module.
"""

from abc import ABC, abstractmethod

from langgraph.graph.state import CompiledStateGraph

from dungeon.graph import GraphState, build_graph


class Agent(ABC):
    """Abstract base class for dungeon agents."""

    @abstractmethod
    def respond(self, name: str) -> str:
        """Return a response string for the given *name*."""


class GreetAgent(Agent):
    """Concrete Agent backed by the greet→shout LangGraph pipeline."""

    def __init__(self) -> None:
        self._graph: CompiledStateGraph[GraphState, None, GraphState, GraphState] = build_graph()

    def respond(self, name: str) -> str:
        result = self._graph.invoke({"name": name})
        return str(result["shout"])
