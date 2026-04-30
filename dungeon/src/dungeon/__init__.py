"""Dungeon — Python library scaffold for ai-tpk."""

__all__ = ["greet", "build_graph", "Agent", "GreetAgent"]

__version__ = "0.0.1"


def greet(name: str) -> str:
    """Return a friendly greeting."""
    return f"Hello, {name}!"


from dungeon.agent import Agent, GreetAgent  # noqa: E402
from dungeon.graph import build_graph  # noqa: E402
