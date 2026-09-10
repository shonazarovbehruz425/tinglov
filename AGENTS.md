# Multi-Agent Collaboration Protocol & Architecture Rules

## 1. System Roles & Boundaries
- **tech-lead-architect**: Owns system design, DB schemas (Prisma), interface specifications, and task roadmaps. Does not write low-level implementation.
- **core-developer**: Implements server logic, DB migrations, Fastify/Node endpoints, and state machines without placeholders or stubs.
- **ui-mobile-engineer**: Implements Flutter / UI views, responsive states (Bloc/Riverpod), and connects backend APIs with optimistic updates.
- **qa-code-auditor**: Reviews every file change for race conditions, OWASP vulnerabilities, memory leaks, and writes automated tests (Vitest/Jest).

## 2. Engineering Standards
- **Zero Incomplete Code**: No placeholder functions, no `// TODO: implement later`, and no omitted edge cases.
- **Type Safety**: Enforce strict TypeScript / Dart schemas. Use runtime validation (Zod/TypeBox) at every system boundary.
- **Error Handling**: Every asynchronous operation and network call must have explicit domain-level error handlers and clean rollbacks.
- **Atomic Changes**: Modify one module or service at a time to prevent breaking dependency chains.