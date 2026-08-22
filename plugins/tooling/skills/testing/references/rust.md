# Rust Testing

Idiomatic unit testing for Rust projects using the built-in test framework. The universal principles in `rules/test-structure.md` and `rules/test-quality.md` still apply (behaviour over implementation, edge cases, one concept per test) — this reference covers the Rust-specific expression of them.

## Runner

Rust has one canonical runner: the built-in `cargo test`, which compiles and runs functions marked `#[test]`. No runner detection is needed. The standard-library assertion macros (`assert!`, `assert_eq!`, `assert_ne!`) cover most needs — reach for a helper crate only if the project already depends on one.

## File Naming and Location

- **Unit tests** live in the same file as the code under test, inside a `#[cfg(test)]` module so they compile only under `cargo test` and can reach private items:

```rust
pub fn format_price(amount: f64) -> String {
    format!("${amount:.2}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_standard_price() {
        assert_eq!(format_price(9.99), "$9.99");
    }
}
```

- **Integration tests** live in the top-level `tests/` directory (e.g. `tests/api.rs`); each file is a separate crate that can use only the **public** API, which is the idiomatic way to test the crate's external surface.

## Table-Driven Tests

The equivalent of pytest's `parametrize` — one test, a slice of cases, asserting per case:

```rust
#[test]
fn formats_prices() {
    let cases = [
        ("standard price", 9.99, "$9.99"),
        ("zero", 0.0, "$0.00"),
        ("large number", 1_000_000.0, "$1000000.00"),
    ];

    for (name, amount, want) in cases {
        assert_eq!(format_price(amount), want, "case: {name}");
    }
}
```

The message argument to `assert_eq!` reports which case failed. For fully independent cases that each report separately, prefer one `#[test]` function per behaviour.

## Errors and Failure Reporting

- Return `Result<(), E>` from a test and use `?` to fail on an unexpected error, or assert on the error explicitly.
- Match against expected error **variants** (`matches!`, or compare typed errors) rather than error strings.
- Use `#[should_panic(expected = "...")]` only for APIs whose contract is to panic.

```rust
#[test]
fn rejects_negative_amount() {
    let err = format_price(-1.0).unwrap_err();
    assert!(matches!(err, PriceError::Negative));
}
```

## Setup and Fixtures

Rust has no built-in fixture system — use plain helper functions that construct the value under test. Keep helpers inside the `#[cfg(test)]` module.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn new_user_service() -> UserService {
        UserService::new(InMemoryDb::default())
    }

    #[test]
    fn display_name_uses_stored_name() {
        let svc = new_user_service();
        assert_eq!(svc.display_name("1"), "Alice");
    }
}
```

## Mocking

Rust favours small traits over mocking frameworks. Define a trait for the dependency, then pass a hand-written fake in the test — the Rust form of the universal "don't mock what you don't own" rule.

```rust
trait UserClient {
    fn get_user(&self, id: &str) -> Option<User>;
}

struct FakeClient {
    user: User,
}

impl UserClient for FakeClient {
    fn get_user(&self, _id: &str) -> Option<User> {
        Some(self.user.clone())
    }
}
```

## Running Tests

```bash
cargo test                 # run all unit + integration + doc tests
cargo test --lib           # unit tests only
cargo test format          # run tests whose name matches "format"
cargo test -- --nocapture  # show println! output from tests
cargo test --doc           # run doctests in /// examples
```

Doctests (`cargo test` runs the ```` ```rust ```` examples in `///` doc comments) keep documentation honest — prefer them for small, illustrative API examples. As with every ecosystem, cover behaviour and edge cases rather than chasing a coverage number.
