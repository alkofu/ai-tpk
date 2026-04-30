# dungeon

Python library scaffold for the `ai-tpk` repository.

## Overview

`dungeon/` is an isolated Python sub-project that lives alongside the existing TypeScript
toolchain. It uses the `src/` layout: package code lives under `src/dungeon/` and tests live
under `tests/`.

## Toolchain

| Tool | Role |
|------|------|
| `uv` | Dependency resolver, virtual-environment manager, and script runner |
| `hatchling` | Build backend |
| `ruff` | Linter and formatter |
| `pytest` | Test runner |
| `mypy` | Static type checker |

## Prerequisites

This project requires [uv](https://docs.astral.sh/uv/getting-started/installation/). Install it with:

```sh
brew install uv        # macOS (Homebrew)
# or
curl -LsSf https://astral.sh/uv/install.sh | sh  # all platforms
```

## Quick Start

Install dependencies and create the virtual environment:

```sh
uv sync --locked
```

## Common Commands

Run the linter:

```sh
uv run ruff check .
```

Check formatting:

```sh
uv run ruff format --check .
```

Run tests:

```sh
uv run pytest
```

Run the type checker:

```sh
uv run mypy src
```

## LangGraph

`dungeon` ships a small LangGraph pipeline that demonstrates the `START → greet → shout → END`
pattern. Use `build_graph` to obtain a compiled graph and invoke it with a `name` key:

```python
from dungeon import build_graph

g = build_graph()
result = g.invoke({"name": "World"})
# result == {"name": "World", "greeting": "Hello, World!", "shout": "HELLO, WORLD!"}
print(result["shout"])  # HELLO, WORLD!
```

A module-level `graph` constant (pre-compiled at import time) is also available:

```python
from dungeon.graph import graph

print(graph.invoke({"name": "Alice"})["shout"])  # HELLO, ALICE!
```

## Project Layout

```text
dungeon/
  src/
    dungeon/
      __init__.py   # package entry point; re-exports greet and build_graph
      graph.py      # LangGraph pipeline (greet -> shout)
  tests/
    test_smoke.py   # smoke test
    test_graph.py   # LangGraph pipeline tests
  pyproject.toml    # all tool configuration
  uv.lock           # committed lockfile
  .python-version   # pins interpreter to 3.12
```
