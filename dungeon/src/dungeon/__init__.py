"""Dungeon — Python library scaffold for ai-tpk."""

__all__ = ["greet", "build_graph"]

__version__ = "0.0.1"


def greet(name: str) -> str:
    """Return a friendly greeting."""
    return f"Hello, {name}!"


from dungeon.graph import build_graph  # noqa: E402
