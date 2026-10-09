# Initial audit — 2026-09-29

Inspected all source, route, controller, service, model, middleware, utility, seed/export, test, environment, deployment and documentation files before implementation. No Git repository or installed dependencies were present. No project AGENTS.md was found.

| Area | Initial status | Evidence / required correction |
| --- | --- | --- |
| Express / Mongoose / architecture | PASS (static) | Existing layered structure worth preserving; runtime pending |
| Six entities / hierarchy | PARTIAL | Correct entities; sparse unique identifiers default to null, causing collisions |
| Historical readings | FAIL | PUT and DELETE mutate supposedly append-only history |
| Seed | PARTIAL | Correct planned volume and solar curve, but index collision, no destructive guard, time depends on wall clock |
| Export/import | FAIL | JSON.stringify fallback destroys ObjectId/Date types; unsafe exception logs may reveal URI |
| REST resources | PARTIAL | Nested reads exist; top-level district/substation/installation/readings collections absent |
| Device access | FAIL | Own history/last-reading lack authorizedInstallation, returning 404 |
| Analyst authorization | PARTIAL | Existing hierarchy checks; broader regression coverage needed; role/scope consistency absent |
| Pagination/filter/sort | PARTIAL | History implemented; permissive numeric/date parsing and inconsistent collection envelopes |
| Conditional GET | FAIL | Header precedence, weak tags, HTTP-date precision, stale collection timestamps; summary ETag changes every call |
| Errors/negotiation | PARTIAL | Rate limiter returns different format; oversized body becomes 500; Accept q=0 mishandled |
| JWT/passwords | PARTIAL | Hashes present; explicit algorithm and subject validation needed |
| Summary | PARTIAL | Real aggregation; today delta excludes boundary baseline and reset behavior not specified |
| Swagger | FAIL | Many missing/placeholder response schemas; documents destructive reading methods |
| Vercel/Atlas | PARTIAL | Handler exists; no live credentials/configuration supplied; connection cache can retain resolved disconnected promise |
| Tests | PARTIAL | 25 existing tests; no full seed/export round trip or regression edge cases; forceExit masks handles |
| README/disclosure | PARTIAL | Useful base; several inaccurate claims; final audit missing |

Implementation will preserve the layered API, remove historical mutations, use GET If-Match for real 412 semantics, add no artificial CRUD resources, and verify with isolated MongoDB only. 204 is appropriate for CORS preflight, not fabricated deletion of history.
