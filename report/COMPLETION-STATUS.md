# Coursework completion status

Follow-up: 2026-10-04, Asia/Colombo. This is a technical handover, not the student's assessed report.

## Outcome

The existing public production API is operational against the freshly reseeded coursework Atlas database. Local and public production smoke checks passed. A new Preview/release cycle is blocked: the Vercel CLI available to this checkout reports unauthenticated and `.vercel/project.json` is absent. No new production deployment was made without the required Preview gate.

Full assessment completion also remains blocked on the official CRUD ambiguity and personal submission requirements. Passing technical tests does not establish eligibility or guarantee marks.

## Assessment requirements supported

- Six-entity geographic/asset/history/authentication model; meter identifiers are installation attributes; readings are separate append-only records.
- Hierarchy collection/atomic/nested resources, installation composite, derived last reading and scoped history.
- Device-only reading ingestion with 201 and Location, tested successfully in isolated MongoDB. Analyst and foreign-device writes rejected locally and in production.
- History pagination with totals/links, jurisdiction/time filters, both timestamp directions, ETag/304 and If-Match/412.
- JWT bearer authentication, current user scope checks and ownership/jurisdiction authorization.
- JSON validation, consistent client errors, MongoDB persistence and required seed scale.
- District generation summary stretch capability, with documented staleness and cumulative-energy limitations.
- Public HTTPS production API and Swagger; deliberately Richardson Level 2.

The detailed 8-dimension comparison, requirement sources and evidence remain in `OFFICIAL-ASSESSMENT-AUDIT.md`. It flags missing update/delete instead of labeling append-only create/read as full CRUD.

## Changes made in this follow-up

- Removed demo-password output and raw failure details from `scripts/seed.js`; seed data and permissions were preserved.
- Added `npm run seed:verify` (`scripts/verify-seed.js`) to verify six exact collection counts and per-installation history distribution.
- Added `npm run smoke -- <coursework URL or --local> [report path]` (`scripts/smoke.js`) for repeatable checks without logging credentials or tokens.
- Updated setup/testing/seeding/deployment guidance and assistance disclosure follow-up notes.
- Added sanitized seed, local Atlas, production recheck, secret-scan and final-test evidence.
- No application routes, roles, authorization rules, history mutation behavior, CORS controls or deployment protection were changed. No artificial CRUD resource was added.

## Database seed verification

The local application's configured Atlas connection succeeded. The intended `npm run seed` was executed with the existing explicit seed guard against the authorized dedicated database. Raw seed subprocess output was suppressed. Only the six coursework collections were cleared.

| Collection | Verified count |
| --- | ---: |
| provinces | 9 |
| districts | 25 |
| substations | 27 |
| solarinstallations | 200 |
| generationreadings | 134400 |
| users | 227 |

All 200 installations have 672 readings. User distribution: 200 devices, 25 district analysts, 1 province analyst and 1 national analyst. Evidence: `ATLAS-SEED-VERIFICATION.json`. Subsequent smoke checks confirm readings remain exactly 134400. Smoke tests did not add or remove records.

## Automated tests and API verification

The complete Jest suite passed 82 tests in 3 suites after removing password output. A final rerun after the remaining output-hardening change is recorded in `FINAL-TEST-VERIFICATION.json`. ESLint and formal OpenAPI/reference validation passed, and `git diff --check` passed.

The current local application was started on a temporary loopback port against Atlas. All 14 smoke groups passed (`LOCAL-ATLAS-VERIFICATION.json`). The same 14 groups passed against the existing public production deployment (`PRODUCTION-RECHECK.json`):

1. Health 200 and database connected.
2. Swagger HTML/JavaScript and OpenAPI load.
3. Missing bearer rejected with 401.
4. All four seeded role types log in successfully.
5. Five API-visible collection totals match the required seed scale.
6. District/province restrictions and forbidden foreign jurisdiction access work.
7. Device own composite and latest reading work.
8. Own history has 672 records, with pagination, timestamp sorting and time filtering.
9. ETag/Last-Modified, empty 304 and failed If-Match 412 work.
10. District summary and noncredentialed Bearer-token CORS behavior work.
11. Hierarchy atomic and nested routes are reachable.
12. Analyst/foreign-device writes are forbidden, invalid input rejected, duplicate timestamp returns 409, reading retrieval works, and PUT/PATCH/DELETE do not mutate history.
13. Invalid pagination/IDs and unsupported Accept return consistent errors.
14. Reading count remains exactly 134400.

Successful POST creation is proved by the isolated automated suite, not by adding a live Atlas reading. Update/delete are absent, so those requirements are not claimed as satisfied. The test proving rejection of historical mutation is not evidence of full CRUD.

## Secret and environment verification

`.env` and `.vercel/` are ignored and untracked. A reachable-history scan inspected the current commit and found no matches for the configured Atlas URI, JWT secret, or the selected high-confidence private-key/token patterns. `SECRET-SCAN.json` records scope and limitations without values. Synthetic coursework fixture credentials and test-only keys already exist in seed/tests; they must not be reused for real systems. Pattern scanning is not a guarantee that every possible credential format is detected.

Production database health and authenticated requests show database/signing configuration functions. CORS behavior is tested without printing configuration values. Environment values were not retrieved from Vercel, printed, placed in reports or included in screenshots. This run does not claim an exact-value comparison of deployed secrets.

## Preview and production

- Existing project: `slsea-solar-generation-api`, team `thisajams-projects`.
- Existing public production: https://project-n8zne.vercel.app
- Public Swagger: https://project-n8zne.vercel.app/docs/
- Existing Preview: https://slsea-solar-generation-bh5ldbe4g-thisajams-projects.vercel.app
- Prior Preview evidence: Ready build; signed-in Swagger, health 200 and missing-bearer 401. Extended public requests redirect to Vercel sign-in. See `PREVIEW-DEPLOYMENT-VERIFICATION.json`.
- New CLI verification: official CLI 62.2.0 was available through npm, but `whoami` exited unsuccessfully and indicated login was required. No local link was present. Credentials were never printed.
- New Preview: not deployed; blocked on CLI authentication. Protection was not disabled or weakened.
- New production: not deployed; correctly held behind a passing new Preview. The production URL above is the existing deployment, freshly retested after reseeding.

To resume: authenticate with `npx vercel login` in this environment. Then link the existing project, inspect environment names/scopes only, deploy Preview and use authenticated protection-aware tooling for smoke tests. Deploy production only after those checks pass. Do not create a duplicate project or remove Preview protection just to bypass the blocker.

## Remaining assessment and operational limitations

1. The brief requires append-only readings and restricts devices/analysts, while it and the rubric also call for CRUD. An authoritative answer identifying the mutable resource and actor is still needed. Do not silently grant analyst writes or overwrite historical data.
2. The referenced module REST API Design Guidelines white paper is not available for an exact standards comparison.
3. Lecturer collaborator access has not been verified. Vercel GitHub access and a public repository do not prove this condition.
4. Git history contains one initial commit. Keep genuine future increments; do not fabricate earlier history. Follow-up changes remain local and uncommitted.
5. The independently authored 2250-2750-word justification, signed declaration and completed prompt/AI appendix remain student responsibilities. The existing AI engineering report is not a compliant substitute.
6. Viva attendance and the ability to explain every artifact remain personal requirements.
7. Summary data can be stale; meter resets/missing boundary readings limit daily-energy interpretation. Rate limiting is per process; pagination is not snapshot-consistent during concurrent writes.

## Final submission checklist

- [x] Read official brief/rubric and map all eight dimensions.
- [x] Verify Atlas connection, reseed only authorized collections, verify exact counts.
- [x] Verify local authentication, scopes, validation, reads, ingestion and immutable history through isolated tests.
- [x] Verify local Atlas and current public production with sanitized smoke evidence.
- [x] Check ignored/private files and reachable Git history for credential findings.
- [x] Validate OpenAPI and retain setup/test/seed/deployment instructions.
- [ ] Resolve CRUD interpretation and implement/test only the confirmed missing surface.
- [ ] Authenticate/link CLI; pass new protected Preview, then deploy and retest production.
- [ ] Obtain/review the module design-guidelines white paper.
- [ ] Share repository with module leader as collaborator and verify access.
- [ ] Commit genuine remaining increments; preserve honest history.
- [ ] Write the assessed report independently with all six required sections and correct word count.
- [ ] Complete/sign declaration and attach exact prompt/AI disclosure evidence.
- [ ] Personally rehearse demonstrations, recheck the public service at submission, and attend viva.
