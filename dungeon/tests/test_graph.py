import pytest

from dungeon.graph import build_graph, graph


def test_build_graph_invokes_and_populates_state() -> None:
    g = build_graph()
    result = g.invoke({"name": "World"})
    assert result == {"name": "World", "greeting": "Hello, World!", "shout": "HELLO, WORLD!"}


def test_module_level_graph_constant_is_invokable() -> None:
    assert graph.invoke({"name": "Alice"})["shout"] == "HELLO, ALICE!"


def test_build_graph_raises_on_missing_name() -> None:
    g = build_graph()
    with pytest.raises(KeyError):
        g.invoke({})
