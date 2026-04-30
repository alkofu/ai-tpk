"""LangGraph pipeline: START -> greet -> shout -> END.

``greet_node`` calls :func:`dungeon.greet` via a function-local import to
avoid a circular-import cycle (``dungeon.__init__`` re-exports
``build_graph`` from this module).
"""

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph


class GraphState(TypedDict, total=False):
    """State shared across all nodes in the graph."""

    name: str
    greeting: str
    shout: str


def greet_node(state: GraphState) -> GraphState:
    """Produce a greeting from *state['name']*."""
    from dungeon import greet

    return {"greeting": greet(state["name"])}


def shout_node(state: GraphState) -> GraphState:
    """Upper-case the greeting produced by *greet_node*."""
    return {"shout": state["greeting"].upper()}


def build_graph() -> CompiledStateGraph[GraphState, None, GraphState, GraphState]:
    """Build and compile the greet→shout LangGraph pipeline."""
    graph_builder: StateGraph[GraphState] = StateGraph(GraphState)
    graph_builder.add_node("greet", greet_node)
    graph_builder.add_node("shout", shout_node)
    graph_builder.add_edge(START, "greet")
    graph_builder.add_edge("greet", "shout")
    graph_builder.add_edge("shout", END)
    return graph_builder.compile()


graph = build_graph()
