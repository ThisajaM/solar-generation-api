# Verification results — 2026-10-10

| Verification | Result | Environment / evidence |
| --- | --- | --- |
| Full Jest suite | 171/171 passed; 6 suites; 0 failed/skipped; 31.513s | Disposable MongoDB replica sets; `evidence/FINALIZATION-TEST-RESULTS.json` |
| ESLint | Passed | `npm run lint` |
| OpenAPI schema | Passed | `npm run docs:validate` |
| Existing smoke groups | 17/17 passed | Disposable full seed; `evidence/FINALIZATION-ISOLATED-SMOKE.json` |
| Swagger demo verification | 5/5 passed | Isolated local demo; `evidence/FINALIZATION-DEMO-VERIFICATION.json` |
| Atlas connection/integrity | Passed | Read-only; `evidence/FINALIZATION-ATLAS-INTEGRITY.json` |
| Atlas preservation | All six counts/digests and reading indexes unchanged | `evidence/FINALIZATION-ATLAS-PRESERVATION.json` |
| Preview / Production for this release | Not performed | Push/deploy prohibited pending user approval |

The six suites cover API/security regression, schemas, prior remediation, full seed, new CRUD/reporting/snapshot behavior and energy quality. Full-size snapshot tests use 134400 readings and reject 150001; concurrency includes new backdated and equal-timestamp records. Isolated ingestion/archival race tests preserve history. No production writes were used for verification.

No test coverage instrumentation was configured; no percentage is claimed. There is no separate build script for this plain Node service. Real local startup and HTTP tests passed; a new Vercel build remains a release gate. Earlier reports and failed intermediate findings are preserved through genuine changes and historical evidence; final results above supersede earlier test counts.
