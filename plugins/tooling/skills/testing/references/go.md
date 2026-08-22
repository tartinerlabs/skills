# Go Testing

Idiomatic unit testing for Go projects using the standard `testing` package. The universal principles in `rules/test-structure.md` and `rules/test-quality.md` still apply (behaviour over implementation, edge cases, one concept per test) — this reference covers the Go-specific expression of them.

## Runner

Go has one canonical runner: the built-in `go test`, driven by the stdlib `testing` package. No runner detection is needed. `testify` (`github.com/stretchr/testify`) is a common assertion/mock helper — use it only if the project already depends on it; otherwise use plain stdlib.

## File Naming and Location

- Test files: `<source>_test.go`, colocated in the **same package and directory** as the code under test (e.g. `price.go` → `price_test.go`).
- Test functions: `func TestXxx(t *testing.T)` — the name after `Test` describes the unit or behaviour.
- Use an external test package (`package foo_test`) when you want to test only the exported API.

## Table-Driven Tests

The idiomatic Go pattern — one test, a slice of cases, a subtest per case. This is the Go equivalent of pytest's `parametrize`.

```go
func TestFormatPrice(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		want   string
	}{
		{"standard price", 9.99, "$9.99"},
		{"zero", 0, "$0.00"},
		{"large number", 1_000_000, "$1,000,000.00"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatPrice(tt.amount)
			if got != tt.want {
				t.Errorf("FormatPrice(%v) = %q, want %q", tt.amount, got, tt.want)
			}
		})
	}
}
```

`t.Run` creates a named subtest (the analogue of a `describe`/`it` block) — failures report which case failed, and cases run independently.

## Errors and Failure Reporting

- Use `t.Errorf` to report a failure and continue; `t.Fatalf` to stop the test immediately (e.g. after an unrecoverable setup error).
- Compare against expected error values or use `errors.Is`/`errors.As` rather than matching error strings.

```go
func TestRejectsNegativeAmount(t *testing.T) {
	_, err := FormatPrice(-1)
	if !errors.Is(err, ErrNegativeAmount) {
		t.Fatalf("expected ErrNegativeAmount, got %v", err)
	}
}
```

## Setup and Teardown

Use helpers and `t.Cleanup` (preferred over manual `defer` for shared teardown). Mark helpers with `t.Helper()` so failures point at the caller.

```go
func newUserService(t *testing.T) *UserService {
	t.Helper()
	svc := NewUserService(newInMemoryDB())
	t.Cleanup(func() { svc.Close() })
	return svc
}
```

## Mocking

Go favours small interfaces over mocking frameworks. Define an interface for the dependency, then pass a hand-written fake in the test — the Go form of the universal "don't mock what you don't own" rule.

```go
type userClient interface {
	GetUser(id string) (*User, error)
}

type fakeClient struct{ user *User }

func (f fakeClient) GetUser(id string) (*User, error) { return f.user, nil }

func TestDisplayName(t *testing.T) {
	svc := &UserService{client: fakeClient{user: &User{Name: "Alice"}}}
	if got := svc.DisplayName("1"); got != "Alice" {
		t.Errorf("DisplayName = %q, want %q", got, "Alice")
	}
}
```

## Running Tests

```bash
go test ./...              # run all tests in the module
go test ./pkg/price        # run one package
go test -run TestFormat    # run tests matching a regexp
go test -race ./...        # run with the race detector
go test -cover ./...       # report coverage
```

Run with `-race` in CI for concurrent code. As with every ecosystem, cover behaviour and edge cases rather than chasing a coverage number.
