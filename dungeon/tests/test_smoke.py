from dungeon import greet


def test_greet_returns_expected_string() -> None:
    assert greet("World") == "Hello, World!"
