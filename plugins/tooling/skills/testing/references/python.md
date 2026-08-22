# Python Testing

Idiomatic unit testing for Python projects. The universal principles in `rules/test-structure.md` and `rules/test-quality.md` still apply (AAA, behaviour over implementation, edge cases) — this reference covers the Python-specific expression of them.

## Runner Detection

Identify the runner before writing tests:

1. **pytest** — `pytest` in `pyproject.toml`/`requirements*.txt`, a `[tool.pytest.ini_options]` block, `pytest.ini`/`tox.ini`, or existing `test_*.py` files using bare `assert`. This is the default and preferred runner.
2. **unittest** (stdlib) — test classes subclassing `unittest.TestCase` with `self.assert*` methods and no pytest present. Match this style only if the project already uses it.

Match the project's existing runner; do not introduce pytest into a unittest-only codebase (or vice versa) without being asked.

## File Naming and Location

- Test files: `test_<module>.py` (pytest/unittest default) — match the project's existing pattern.
- Location: a top-level `tests/` directory is the common Python convention; colocated `test_*.py` next to source is also fine. Follow what the project already does.
- Test functions: `def test_<behaviour>():` — the name describes the expected behaviour.

## pytest Patterns

### Plain asserts

pytest rewrites `assert` to give rich failure output — use bare `assert`, not helper methods.

```python
def test_returns_sum_of_two_numbers():
    # Arrange
    a, b = 2, 3
    # Act
    result = add(a, b)
    # Assert
    assert result == 5
```

### Parametrize instead of loops

Cover multiple cases without duplicating the test body:

```python
import pytest

@pytest.mark.parametrize("amount, expected", [
    (9.99, "$9.99"),
    (0, "$0.00"),
    (1_000_000, "$1,000,000.00"),
])
def test_format_price(amount, expected):
    assert format_price(amount) == expected
```

### Expecting exceptions

```python
import pytest

def test_rejects_negative_amount():
    with pytest.raises(ValueError, match="must be non-negative"):
        format_price(-1)
```

### Fixtures for setup/teardown

Prefer fixtures over `setUp`/`tearDown`; yield for teardown. Keep fixtures small and composable.

```python
import pytest

@pytest.fixture
def user_service():
    service = UserService(db=InMemoryDB())
    yield service
    service.close()

def test_creates_user_with_valid_input(user_service):
    user = user_service.create(name="Alice")
    assert user.name == "Alice"
    assert user.id is not None
```

### Mocking

Use `unittest.mock` (via `pytest`'s `monkeypatch` or `mocker` from `pytest-mock`). Follow the universal "don't mock what you don't own" rule — wrap third-party clients behind your own interface and mock the wrapper.

```python
def test_fetches_user(mocker):
    fake_client = mocker.Mock()
    fake_client.get_user.return_value = {"id": "1", "name": "Alice"}
    service = UserService(client=fake_client)

    assert service.display_name("1") == "Alice"
```

## unittest Patterns (when the project uses it)

```python
import unittest

class FormatPriceTests(unittest.TestCase):
    def test_formats_standard_price(self):
        self.assertEqual(format_price(9.99), "$9.99")

    def test_raises_for_negative(self):
        with self.assertRaises(ValueError):
            format_price(-1)
```

## Running Tests

```bash
pytest                     # run all tests
pytest tests/test_foo.py   # run one file
pytest -k "format_price"   # run tests matching an expression
pytest -q                  # quiet output
python -m unittest         # unittest projects
```

## Coverage

`pytest-cov` is the standard: `pytest --cov=<package> --cov-report=term-missing`. Do not chase 100% — cover behaviour and edge cases per the universal quality rule.
