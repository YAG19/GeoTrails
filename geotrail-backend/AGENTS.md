# AGENTS: How to be productive in this codebase

Purpose: quick, actionable orientation for an automated coding agent (or developer) to begin working here.

1) Quick checklist
- Java runtime: Java 21 (uses virtual threads). See `src/main/resources/application.yml` (spring.threads.virtual.enabled).
- Build: `mvn -DskipTests package`
- Run (dev): `mvn spring-boot:run` or `java -jar target/<artifact>.jar` (context-path `/api`, default port 8080)
- DB migrations: Flyway migrations live in `src/main/resources/db/migration` and are applied at startup.

2) Big-picture architecture
- Spring Boot monolith organized by feature packages under `com.geotrail` (e.g. `auth`, `rag`, `imports`, `location`, `places`, `trips`).
- Pattern: controllers are intentionally thin; business logic lives in `service` packages and persistence in `repository` packages. Example: `rag/web/TimelineRagController.java` delegates to `rag/service/*`.
- Runtime: background jobs use virtual threads (`config/AsyncConfig.java`) and many long-running tasks (e.g. RAG embedding) are started async and return 202.
- Persistence: PostgreSQL is the primary DB. Flyway manages schema (`resources/db/migration`). Some features require Postgres extensions (pgvector). See migration `V11__add_timeline_embeddings.sql`.

3) Important integration points & external dependencies
- Postgres (with pgvector for embeddings). Docker postgres helpers are under `docker/postgres/` (init SQL lives there).
- MinIO for file storage; configuration in `application.yml` and `config/MinioConfig.java`.
- Redis for caching — note a custom Jackson ObjectMapper and polymorphic typing: `config/RedisConfig.java` (uses `@class` property and custom per-cache TTLs).
- RAG / LLM: pluggable providers. See `application.yml` keys under `geotrail.rag` — `llm-provider` vs `embedding-provider` are separate. Embedding models write to provider-specific pgvector tables.
  - Local LM Studio is supported by default (no API key). Gemini and Anthropic are configurable; keys live in env vars like `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`.

4) Security and API surface
- Context path: `/api` (so controllers map under `/api/<...>`). See `application.yml` server.servlet.context-path.
- JWT auth + filter: `auth/filter/JwtAuthFilter` and `config/SecurityConfig.java`. Public endpoints include `/auth/**`, `/api-docs/**`, `/actuator/**`, `/ws/**` and `POST /owntracks`.
- Most controllers expect an authenticated `@AuthenticationPrincipal User user`; use that pattern in new endpoints.

5) RAG-specific notes agents must know
- Separate table per embedding provider — switching `embedding-provider` in `application.yml` requires re-running `POST /api/rag/embed` to populate vectors for the new provider.
- Embedding is started via `POST /api/rag/embed` and runs in background (returns 202). The controller is `rag/web/TimelineRagController.java` and embedding logic lives in `rag/service`.
- Embeddings require pgvector (see `V11__add_timeline_embeddings.sql`). If migrations fail, ensure the Postgres image includes the `vector` extension.

6) Conventions & patterns to follow
- Packaging: group by feature, not by technical layer. Add new controllers under `..feature..controller` or `..feature..web`, services under `..service`, dtos under `..dto`, entities under `..entity` and repos under `..repository`.
- Controllers are thin (validation + security checks) — heavy logic belongs in services. Example: `TimelineRagController` delegates to `TimelineQueryService`/`TimelineEmbeddingService`.
- Async/background work: use `@Async` on service methods (virtual threads executor is configured as `taskExecutor`). Long-running client calls should respect provider rate limits; providers expose `minIntervalMillis()` in `rag/embedding/EmbeddingProvider.java`.
- Caching: use Spring `@Cacheable` and named caches aligned with `RedisConfig` (examples: `dailyStats`, `dashboardSummary`, `userPlaces` TTLs configured).
- DTOs often use Java records in controllers (see `TimelineRagController` inner records) — follow that concise style where appropriate.

7) Developer workflows & useful commands (PowerShell examples)
- Build & run:
  ```powershell
  mvn -DskipTests package
  mvn spring-boot:run
  # or
  java -jar target\*.jar
  ```
- Run tests:
  ```powershell
  mvn test
  mvn -Dtest=com.geotrail.rag.** test    # run RAG tests only
  ```
- Start a temporary Postgres with pgvector (example):
  ```powershell
  docker run -p 5432:5432 --name geotrail-db -e POSTGRES_USER=geotrail -e POSTGRES_PASSWORD=geotrail_dev -e POSTGRES_DB=geotrail ghcr.io/ankane/pgvector:postgres14
  ```
  (The project ships `docker/postgres` with an init folder if you prefer building a tailored image.)

8) Troubleshooting hotspots
- Migration failures: if Flyway fails at `V11__add_timeline_embeddings.sql`, it's almost always because the Postgres image lacks the `vector` extension.
- Auth failures: ensure the `Authorization: Bearer <token>` header is provided; many endpoints use `@AuthenticationPrincipal User` and will 401 without a valid JWT.
- RAG questions returning empty: check that the configured `embedding-provider` has populated vectors (run `POST /api/rag/embed`) and that `geotrail.rag.min-similarity` in `application.yml` isn't too high.

9) Where to look first (quick map)
- App entry: `com.geotrail.GeoTrailApplication`.
- Global config: `src/main/resources/application.yml`.
- Security: `config/SecurityConfig.java`, `auth/filter/JwtAuthFilter`.
- Async & threading: `config/AsyncConfig.java`.
- RAG surface: `rag/web/TimelineRagController.java`, `rag/service/*`, `rag/embedding/*`.
- DB migrations: `src/main/resources/db/migration`.

10) When adding code
- Keep controllers thin; add service methods and unit tests under the corresponding `service` package.
- Add Flyway migrations for any schema changes (place them in `resources/db/migration` and follow the V<number>__desc.sql naming).

References in repo: `application.yml`, `config/SecurityConfig.java`, `config/RedisConfig.java`, `config/AsyncConfig.java`, `rag/web/TimelineRagController.java`, `src/main/resources/db/migration/V11__add_timeline_embeddings.sql`.

