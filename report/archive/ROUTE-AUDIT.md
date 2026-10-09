# HTTP / REST route audit

All domain URIs use nouns. GET operations are safe and idempotent; POST creates a token or an immutable reading and is not idempotent. No PUT/PATCH/DELETE exists for historical readings. JSON responses use application/json; documentation assets use their appropriate HTML/CSS/JavaScript types.

| Method and route | Resource / scope | Safe / idempotent | Status | Location | Validators | Authorization / OpenAPI |
| --- | --- | --- | --- | --- | --- | --- |
| GET /api/v1/provinces | Visible provinces | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/provinces/{provinceId} | Province | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/provinces/{provinceId}/districts | Visible districts in province | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/districts | Visible districts | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/districts/{districtId} | District with province | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/districts/{districtId}/substations | Substations in district | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/districts/{districtId}/generation-summary | District power and daily cumulative energy delta | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/substations | Visible substations | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/substations/{substationId} | Substation with district | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/substations/{substationId}/installations | Installations at substation | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/installations | Visible installations | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/installations/{installationId} | Installation with hierarchy | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst / owning device; documented |
| GET /api/v1/installations/{installationId}/composite | Installation, ancestors and latest reading | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst / owning device; documented |
| GET /api/v1/installations/{installationId}/last-reading | Most recent historical record by timestamp | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst / owning device; documented |
| GET /api/v1/readings | Visible historical readings across installations | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst; documented |
| GET /api/v1/installations/{installationId}/readings | Installation historical readings | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst / owning device; documented |
| POST /api/v1/installations/{installationId}/readings | Append a reading (owning device only) | no / no | 201, 400, 401, 403, 404, 406, 409, 413, 415, 429, 500, 503 | required and tested | none | Owning device; documented |
| GET /api/v1/installations/{installationId}/readings/{readingId} | One immutable reading | yes / yes | 200, 304, 400, 401, 403, 404, 406, 412, 429, 500, 503 | not applicable | ETag; Last-Modified where reliable | Scoped analyst / owning device; documented |
| POST /api/v1/auth/login | Issue JWT | no / no | 200, 400, 401, 403, 404, 406, 413, 415, 429, 500, 503 | not applicable | none | Public; documented |
| GET /health | API and database health | yes / yes | 200, 503 | not applicable | none | Public; documented |
| GET /api/v1 | API metadata | yes / yes | 200, 503 | not applicable | none | Public; documented |

`/docs` serves Swagger UI, `/docs/*` serves its assets, and `/openapi.json` serves the public specification. HEAD inherits GET semantics through Express and has no response body. OPTIONS preflight is handled by CORS with 204. Unsupported resource mutations return the standard 404 error and never change data.

Collection responses use data/meta/links. Resources and login use data. Health uses its documented operational status envelope. Errors use error/code/message/detail. GET/POST path handlers authenticate before reading domain documents (format validation may reject malformed IDs before authentication). No separate users CRUD route is exposed.
