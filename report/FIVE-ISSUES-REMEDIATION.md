# Project finalization engineering evidence — 2026-10-10

This is an AI-assisted engineering record, not the student's assessed academic report. Superseded reports are preserved in `archive/PRE-FINALIZATION-2026-10-10-*`. Earlier deployment evidence describes earlier code. This release has not been pushed or deployed.

## Executive summary

The initial audit found no installation update/delete path or administrative role; conservative energy and freshness handling already existed; signed keyset cursors traversed a live dataset. The existing architecture and append-only readings were preserved. Installation CRUD, explicit historical reports, detailed measured-energy coverage and bounded fixed-membership pagination are now implemented and locally verified.

All 171 tests passed across six suites, with zero failures or skipped tests. Lint and OpenAPI validation passed. The existing 17 smoke groups passed against disposable MongoDB, and five separate local demo groups passed. Read-only Atlas verification confirmed all six business collections retained identical counts and sorted BSON content digests. No reseeding, credential changes or production writes occurred.

## Issue-by-issue results

| Issue | Initial finding | Implemented result | Evidence / remaining limit |
| --- | --- | --- | --- |
| CRUD | Partial implementation: installation reads only | Scoped installation-admin create/read/PATCH/archive; strict validation and immutable identifiers | `tests/finalization.test.js`; new role is an explicit engineering extension, not claimed lecturer approval |
| Historical/live readings | Correct freshness behavior, poor historical demonstration usability | Explicit historical windows and isolated Swagger demo; current power still excludes stale samples | Historical and live tests; historical seed remains legitimately stale |
| Energy | Conservative deltas existed, coverage detail incomplete | Duration coverage, expected/actual readings, missing intervals, reset indications and complete/partial/unavailable status | Independent numerical tests; missing physical measurements cannot be reconstructed |
| Pagination | Signed live keyset cursor, no fixed membership | Transaction-captured ID manifest, signed v2 cursor, fixed total, later/backdated insert exclusion | Concurrent insert and 134400-row tests; bounded 150000 rows, 15 minutes, one snapshot/account |
| Device security | Existing JWT/ownership controls already implemented | Preserved controls; devices cannot manage installations; ingestion and archival serialize transactionally | Authentication/security regression and archival tests; direct privileged database writes remain outside API guarantees |

## API changes and CRUD

All paths below use `/api/v1`.

| Method | Endpoint | Role | Success / main errors |
| --- | --- | --- | --- |
| POST | `/installations` | installation-admin, within jurisdiction | 201 + Location; 400/401/403/404/409 |
| GET | `/installations` | analyst-read including scoped admin | 200; 400/401/403 |
| GET | `/installations/:installationId` | authorized analyst/admin or owning device | 200; 400/401/403/404 |
| PATCH | `/installations/:installationId` | scoped installation-admin | 200; 400/401/403/404/409 |
| DELETE | `/installations/:installationId` | scoped installation-admin | 204, including repeated archive; 400/401/403/404 |

PATCH permits name, capacityKw, latitude, longitude and status only. Identifiers and substation ancestry are immutable. Unknown fields are rejected. Creation checks valid references, jurisdiction, uniqueness, capacity and coordinates. GET validators and existing conditional response behavior remain available.

DELETE always archives, including installations without readings. It preserves history and user references, reserves identifiers, excludes archived sites from default lists, and blocks new ingestion with 409. Explicit status=archived permits authorized discovery; atomic and historical reads remain available. Archived installations cannot be patched back into service. Repeated DELETE does not alter the archive timestamp. Reading insertion and archive changes serialize through a transaction on the installation; no reading mutation endpoints were added.

Existing SLSEA read-only users retain their privileges. A separately provisioned installation-admin has analyst-read and installation-manage scopes with national, province or district boundaries. `scripts/provision-admin.js` creates a new account only and never upgrades existing users. No production administrator has been created.

New GET `/generation-summary` provides scoped geographical reporting; GET `/installations/:installationId/generation-summary` supports one installation. Existing district summary accepts mode=historical. Default/live behavior remains compatible. Historical queries use either date=YYYY-MM-DD in Asia/Colombo or explicitly zoned from/to timestamps, maximum 31 days, no future end. Date and range parameters cannot be mixed. Historical reports include archived installations and ignore live freshness filtering.

Actual Atlas readings span 2026-09-26T21:45:00.000Z to 2026-10-03T21:30:00.000Z. Example: `/api/v1/generation-summary?mode=historical&date=2026-10-02`. No timestamps were changed. Empty, invalid, scoped and boundary windows are tested. Reports cap input at 150000 readings and return 422 above that limit.

## Energy calculation and quality

The stored cumulativeEnergyKwh is a meter counter; powerKw is instantaneous power. Measured energy sums valid consecutive nonnegative counter deltas within the window and configured reporting interval (default 900 seconds). Decreases indicate a possible reset or invalid counter interval; the decrease interval and unjustified post-reset value are excluded. Later valid increments remain usable. Missing boundaries and long gaps are not interpolated. Adjacent windows may share a boundary sample but never count an interval twice. UTC storage and Asia/Colombo reporting boundaries are explicit; Sri Lanka has no contemporary seasonal DST transition.

Response fields include energyKwh, coveragePercent, expectedReadings, actualReadings, missingIntervals, hasMeterReset, isComplete and qualityStatus. Coverage is accepted interval duration divided by requested duration, rounded down to two decimal places. Expected samples equal ceil(duration/reporting interval)+1; actual samples count unique timestamps. Missing intervals equal ceil(uncovered duration/reporting interval), so bursty samples cannot hide uncovered time. Complete requires 100% duration coverage with no quality warnings. No accepted intervals means unavailable, even when numeric energy is zero for compatibility. A valid continuous zero-generation series is complete. hasMeterReset signals an observed decrease, not independently proven reset semantics.

Totals are measured, not estimated; estimatedEnergyKwh is null. Coverage includes every selected catalog installation, even one without historical observations; the model has no commissioning-date history. Meter errors, undetectable between-sample resets and missing observations remain physical data limitations. Consumers must interpret quality alongside numeric totals.

## Snapshot mechanism

`pagination=snapshot` is optional on the existing historical collections. Offset and live cursor modes retain their contracts. A short MongoDB snapshot-read transaction captures the ordered reading IDs and stores a bounded manifest. No database transaction remains open while the client paginates. Signed v2 cursors bind manifest nonce, position, expiry, filters, direction, limit, principal and current jurisdiction. Every page is independently authorized. Subsequent pages fetch only the manifest slice and return its original ordering and fixed total, excluding even backdated new inserts.

A snapshot lasts 15 minutes and allows at most 150000 readings. One active snapshot per account bounds storage; starting another replaces the prior session. Tampered/mismatched/expired tokens return 400; missing/expired/replaced stored snapshots return 410; deleted manifest members return 409; excessive results return 422. Missing operational TTL index returns 503 until maintenance is performed. Queries and capture transactions have bounded timeouts.

This is fixed membership captured at a database snapshot, with stable values under the API's append-only contract. It is not a long-lived database snapshot-isolation transaction. Out-of-band privileged document updates are unsupported; removed members are detected rather than silently skipped. Snapshot mode provides forward traversal; legacy offset/live cursor modes retain next/previous navigation.

## Database changes and preservation

Optional installation archivedAt and private ingestionVersion fields are backward compatible with existing documents. The new role does not change existing users. ReadingSnapshot is an operational cache collection, not a seventh coursework domain entity or Device entity. It needs an expiresAt TTL index; an additive timestamp/_id compound index accelerates global snapshot ordering. `npm run indexes` creates indexes idempotently; this was verified twice only in disposable MongoDB. No Atlas migration or index command was executed.

| Collection | Before | After | Content digest |
| --- | ---: | ---: | --- |
| Provinces | 9 | 9 | unchanged |
| Districts | 25 | 25 | unchanged |
| Substations | 27 | 27 | unchanged |
| Installations | 200 | 200 | unchanged |
| Readings | 134400 | 134400 | unchanged |
| Users | 227 | 227 | unchanged |

Evidence: `evidence/FINALIZATION-ATLAS-{BEFORE,AFTER,PRESERVATION,INTEGRITY}.json`. Duplicate identifiers and broken references were zero. Atlas transaction capability was confirmed read-only. Production reading indexes also remained unchanged. Future explicit administrator provisioning legitimately adds a user; future authorized installation CRUD legitimately changes installation counts/digests. Neither occurred here.

## Testing evidence

Final run: 171 executed, 171 passed, zero failed, zero skipped; six suites; 31.513 seconds. `evidence/FINALIZATION-TEST-RESULTS.json` records the structured Jest summary. Coverage instrumentation is not configured and no coverage percentage is claimed. `npm run lint` and `npm run docs:validate` passed. This plain Node application has no separate compilation/build script; module startup and real HTTP behavior are covered by the seed/startup and demo tests. No new Vercel build is claimed.

Tests preserve earlier assertions and add scoped CRUD, immutable fields, archive/ingestion concurrency, administrator create-only provisioning, historical validation, numerical energy fixtures, malformed/expired/filter-bound/scope-bound snapshot tokens, concurrent and backdated inserts, full-size traversal and 150001-record rejection. At full scale, global sorted query execution examined at most 100 documents for a 100-row limit. Index setup was tested idempotently. Implementation failures found during full-size verification were fixed before the successful final run; tests were not weakened.

The 17 existing smoke groups ran against disposable MongoDB in the seed suite (`FINALIZATION-ISOLATED-SMOKE.json`). Five independent demo groups verified Swagger, admin login, CRUD/repeated archive, historical coverage and full-size snapshot (`FINALIZATION-DEMO-VERIFICATION.json`). These are local results, not new Preview or Production evidence.

## Deployment and remaining limitations

No push or deployment was performed, as requested. Previously verified production is https://project-n8zne.vercel.app, with the previous remediation deployment dpl_2wQEX9c6VHZxApMCiR5kdv5RtxVe; it does not yet contain these changes. Preview and Production release verification remain pending. Follow DEPLOYMENT-CHECKLIST.md after explicit approval. Snapshot maintenance and separate administrator provisioning are release prerequisites, not destructive data migrations.

Technical CRUD is resolved locally. Historical usability is resolved; stale seed data correctly remains historical. Energy transparency is resolved; missing physical data remains irrecoverable. Snapshot consistency is resolved within the explicit bounds above. Production availability of the new functionality remains pending release.

## Factual material for independently written coursework

- Architecture: six domain entities retained; separate ephemeral snapshot cache; meter identifier remains an installation attribute.
- API design: scoped mutable installation metadata plus immutable telemetry; PATCH whitelisting, 201 Location and idempotent archival.
- Security: separate admin role, no analyst elevation, jurisdiction intersections and transactional archive/ingest ordering.
- Deployment: Node 22/Vercel entry preserved; new release not deployed; index preparation and replica-set transactions required.
- Richardson maturity: resource URIs, methods, status codes and conditional GET demonstrate Level 2; no claim of Level 3.
- Critical evaluation: incomplete measurements remain explicit, manifests are bounded, operational rollback must respect archival, and direct database administrator changes bypass API guarantees.

The student must write the assessed report independently, retain prompts and accurate AI disclosure, verify collaborator access, complete the declaration and prepare for the viva. No marks or lecturer approval are claimed.
