---
name: backend
description: Backend development, API design, database modeling, and server-side architecture. Use when building or modifying APIs, services, data models, or infrastructure logic.
---

# Backend Skill

## When to Use

- Designing or implementing RESTful/GraphQL/gRPC APIs
- Modeling database schemas (SQL or NoSQL)
- Writing business logic or service-layer code
- Implementing authentication and authorization
- Designing microservices or monolithic architectures
- Optimizing database queries or API performance
- Handling background jobs, queues, or scheduled tasks
- Working with DevOps, deployment, or infrastructure code

## Guidelines

1. **API Design**:
   - Follow RESTful conventions unless there's a reason to deviate.
   - Use consistent naming (kebab-case for URLs, camelCase for JSON).
   - Version APIs explicitly (e.g., `/v1/users`).
   - Return appropriate HTTP status codes and standardized error responses.

2. **Database**:
   - Normalize until you have a reason to denormalize.
   - Index columns used in WHERE, JOIN, and ORDER BY clauses.
   - Use transactions for multi-step operations that must be atomic.
   - Write migrations that are backwards-compatible when possible.

3. **Security**:
   - Validate and sanitize all user inputs.
   - Use parameterized queries to prevent SQL injection.
   - Implement proper authentication (JWT, OAuth, sessions) and authorization (RBAC, ABAC).
   - Never log sensitive data (passwords, tokens, PII).

4. **Performance**:
   - Add caching (Redis, in-memory) for frequently accessed data.
   - Use pagination for list endpoints.
   - Optimize N+1 queries with eager loading or JOINs.
   - Profile slow queries and add indexes accordingly.

5. **Error Handling**:
   - Use structured logging with correlation IDs.
   - Return meaningful error messages to clients (without leaking internals).
   - Implement graceful degradation for external service failures.

6. **Testing**:
   - Write unit tests for business logic.
   - Write integration tests for API endpoints.
   - Test database migrations in a staging environment.

## Tech Stack Defaults

- **Runtime**: Node.js (Express/Nest.js/Fastify), Python (Django/FastAPI), Go, or as specified.
- **Database**: PostgreSQL for relational, Redis for caching, MongoDB for document store.
- **Queue**: Bull/BullMQ, Celery, or AWS SQS.
- **Testing**: Vitest/Jest, Pytest, or Go testing.
