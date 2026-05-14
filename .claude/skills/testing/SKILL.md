---
name: testing
description: Testing strategies, test implementation, and quality assurance. Use when writing tests, reviewing test coverage, debugging test failures, or establishing testing practices.
---

# Testing Skill

## When to Use

- Writing unit, integration, or end-to-end tests
- Debugging failing tests or flaky tests
- Reviewing test coverage reports
- Establishing testing conventions for a project
- Writing test plans or QA strategies
- Implementing mocking/stubbing for dependencies
- Setting up CI/CD test pipelines

## Guidelines

1. **Test Pyramid**:
   - Write many small, fast unit tests.
   - Write fewer integration tests that verify component interactions.
   - Write minimal E2E tests that cover critical user journeys.
   - Avoid the "ice cream cone" anti-pattern (too many E2E, too few unit).

2. **Unit Tests**:
   - Test one behavior per test case.
   - Use descriptive test names that explain the expected behavior.
   - Follow AAA: Arrange, Act, Assert.
   - Mock external dependencies (APIs, databases, file system).

3. **Integration Tests**:
   - Test the interaction between components.
   - Use test databases or in-memory equivalents.
   - Verify request/response contracts for APIs.

4. **E2E Tests**:
   - Cover critical user paths (login → checkout → payment).
   - Avoid testing implementation details.
   - Use stable selectors (data-testid > id > class > XPath).
   - Keep tests independent; reset state between tests.

5. **Mocking**:
   - Mock at the boundary (HTTP requests, database connections).
   - Don't mock what you don't own unless necessary.
   - Prefer fake implementations over mocks when possible.

6. **Flaky Tests**:
   - Eliminate time-based assumptions (use explicit waits, not `setTimeout`).
   - Isolate tests; no shared mutable state.
   - Use deterministic data and fixed seeds for randomness.

7. **Coverage**:
   - Aim for meaningful coverage, not 100% line coverage.
   - Focus on covering business logic and edge cases.
   - Treat uncovered code as a risk to document, not always a bug.

## Test Naming Conventions

```
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should expected behavior', () => {
      // test code
    });
  });
});
```

## Tech Stack Defaults

- **Unit**: Vitest, Jest, Pytest, Go test.
- **Integration**: Supertest, React Testing Library, Django test client.
- **E2E**: Playwright, Cypress.
- **Mocking**: MSW (API mocking), Sinon, unittest.mock.
