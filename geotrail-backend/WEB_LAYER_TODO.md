# Web / Controller Layer — Skill Alignment TODO

Change-plan to align controllers with the new `.claude` Spring Boot skills
(layered-architecture, problem-details-rfc9457, hateoas, openapi-first).

> **Decision assumed:** keep the `ApiResponse<T>` envelope everywhere (least churn).
> Revisit if switching errors to RFC-9457 `ProblemDetail`.
> **HATEOAS / OpenAPI-first:** intentionally skipped — no controller uses them today.

---

## Phase 0 — Cross-cutting (do first; unblocks the rest)

- [ ] `common/exception/GlobalExceptionHandler.java` — make it `extends ResponseEntityExceptionHandler`.
  - Override base-class hooks so Spring's built-in MVC exceptions return the `ApiResponse`
    envelope: malformed JSON (`HttpMessageNotReadableException`), missing param
    (`MissingServletRequestParameterException`), type mismatch on `Instant`/`LocalDate`
    (`MethodArgumentTypeMismatchException`).
  - Replace the standalone `@ExceptionHandler(MethodArgumentNotValidException.class)` with the
    base-class `handleMethodArgumentNotValid` override.
  - _Skill: problem-details-rfc9457 ("extend ResponseEntityExceptionHandler" gotcha)._

## Phase 1 — Remove dead / broken endpoints (safe, no decisions)

- [ ] `imports/controller/ImportController.java` — delete `/{id}/test` (lines ~90–100): `GET`
      taking a `MultipartFile`, ignores the job it creates, re-fetches by id. Debug cruft.
- [ ] `stats/controller/StatsController.java` — delete `/scheduler/{id}` (lines ~74–78):
      `@PathVariable User userId` is a wrong binding, fires a global scheduler ignoring the path
      var, returns raw `"Success"`.
- [ ] `stats/controller/StatsController.java` — delete commented-out line in `getDashboard`.

## Phase 2 — Layered-architecture fixes (logic out of the web layer)

- [ ] `tracking/controller/OwnTracksController.java` — extract `authenticateBasic` (Base64 decode +
      password match) into a Spring Security mechanism (`OncePerRequestFilter` or
      `AuthenticationProvider` scoped to `/owntracks`). Controller receives an authenticated `User`
      principal and only calls `trackingService.processOwnTracksPayload`.
  - Keep the bare `ResponseEntity.ok([])` response (OwnTracks wire protocol); add a comment marking
    it an intentional envelope exception.
  - _Skill: layered-architecture (no auth/business logic in controllers)._
- [ ] `imports/controller/ImportController.java` — move file validation (empty check, `.json`
      extension) into `ImportService` (or bean validation); throw a domain exception mapped to 400
      by the handler. Stop returning `ApiResponse.error` inline.
- [ ] `imports/controller/ImportController.java` — move `toDto(...)` to a static factory
      `ImportJobDto.from(ImportJob)`; update `getJob`, `listJobs`, `retry` call sites.
- [ ] `imports/controller/ImportController.java` — change `/{id}/retry` from `@GetMapping` to
      `@PostMapping` (it mutates state); drop the unused `job` local.

## Phase 3 — Envelope & validation consistency

- [ ] `location/controller/LocationController.java` — `getDistinctActivityOfUser` returns raw
      `List<String>`; wrap in `ApiResponse.success(...)`.
- [ ] `location/controller/LocationController.java` — `/paginated` returns `Page<Response>`; replace
      with a stable `PageResponse<Response>` DTO (`content`, `page`, `size`, `totalElements`,
      `totalPages`).
- [ ] `rag/web/TimelineRagController.java` — add `@Valid` to `@RequestBody QueryRequest` and
      `NarrativeRequest` (constraints currently never fire).
- [ ] `rag/web/TimelineRagController.java` — wrap `query`/`narrative`/`embed` responses in
      `ApiResponse` to match the app-wide envelope (or consciously exempt + document).
- [ ] `rag/web/TimelineRagController.java` — swap manual constructor for `@RequiredArgsConstructor`.

## Phase 4 — Optional / low priority

- [ ] `export/controller/ExportController.java` — raw `String` download bodies are correct (not
      envelope candidates). Optionally add `produces = "application/geo+json"` / `application/gpx+xml`.
- [ ] API versioning — skill uses `/api/v1/...`; project uses `/api/{resource}`. Breaking,
      frontend-coordinated — defer unless wanted now.
- [ ] HATEOAS — skipped by design. Revisit only if frontend wants hypermedia discovery.
- [ ] `mcp` module (`GeoTrailMcpTools`, `McpServerConfig`) — review against the `mcp-server` skill
      (separate pass).

## No changes needed (reference style)

- `auth/AuthController` — compliant.
- `timeline/TimelineController` — compliant.
- `places/PlaceController` — compliant.
