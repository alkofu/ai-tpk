import importlib

import pytest

from dungeon.agent import Agent, GreetAgent


def test_greet_agent_respond_returns_shouted_greeting() -> None:
    agent = GreetAgent()
    assert agent.respond("World") == "HELLO, WORLD!"


def test_greet_agent_dynamic_loading_via_importlib() -> None:
    module = importlib.import_module("dungeon.agent")
    cls = getattr(module, "GreetAgent")  # noqa: B009
    obj = cls()
    assert isinstance(obj, Agent)
    assert obj.respond("Alice") == "HELLO, ALICE!"


def test_agent_abstract_class_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        Agent()  # type: ignore[abstract]
