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

## Project Layout

```text
dungeon/
  src/
    dungeon/
      __init__.py   # package entry point
  tests/
    test_smoke.py   # smoke test
  pyproject.toml    # all tool configuration
  uv.lock           # committed lockfile
  .python-version   # pins interpreter to 3.12
```
