# Versioning and Breaking Changes

## Versioning Policy

This contract follows **semantic versioning** with the following adaptations for
API contracts:

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| New optional field in request/response | **MINOR** (e.g. 1.0 → 1.1) | Adding `documentDate` |
| New enum value in a non-breaking position | **MINOR** | Adding a new `EvidenceType` |
| New required field in request | **MAJOR** (e.g. 1.x → 2.0) | Adding required `adviserId` |
| Removing a field | **MAJOR** | Removing `pullHeaders` |
| Changing a field type | **MAJOR** | Changing `correlationId` from `string` to `object` |
| Removing an enum value | **MAJOR** | Removing `MEETING_NOTES` evidence type |
| Changing HTTP status codes | **MAJOR** | Returning 200 instead of 202 for accepted jobs |
| New endpoint | **MINOR** | Adding `GET /evidence` list endpoint |
| Removing an endpoint | **MAJOR** | Removing `DELETE /evidence/{id}` |

## File Naming Convention

Schema and OpenAPI files carry the major version in their name:

```
ingestion-request.1.0.schema.json   ← major=1, minor=0
ingestion-request.2.0.schema.json   ← major=2 (breaking change)
evidence-ingestion.v1.yaml          ← v1 track
evidence-ingestion.v2.yaml          ← v2 track (when introduced)
```

Minor/patch increments update the file **in place**; the file name does not change.
This means consumers pinned to `v1` automatically receive non-breaking enhancements.

## Breaking Change Process

1. **Proposal** — raise a PR with the proposed change and label it `breaking-change`.
2. **Review** — at least two reviewers from Platform and Compliance must approve.
3. **Deprecation notice** — the old version is marked deprecated in the OpenAPI
   `info.x-deprecated-on` extension field and a changelog entry is added.
4. **Parallel support** — both versions are served simultaneously for a minimum of
   **90 days** from the deprecation notice.
5. **Sunset** — consumers are notified via the `Sunset` and `Deprecation` HTTP headers
   on every response from the deprecated version (RFC 8594).
6. **Removal** — after 90 days, the deprecated endpoint/schema is removed.

## Changelog

### 1.0.0 — 2026-04-15

- Initial release.
- Supported modes: `PULL`, `PUSH_INLINE`, `PUSH_REFERENCE`.
- Evidence types from `evidence_profiles.v1.json` (contractVersion 1.0).
- Validation rules: `DOC_MUST_BE_VERIFIED`, `DOC_MUST_BE_LEGIBLE`, `DATE_MAX_AGE_365D`,
  `DATE_MAX_AGE_180D`.

## Consumer Responsibilities

- Treat unrecognised fields in responses as ignorable (Postel's Law / tolerant reader).
- Do not hard-code enum values; handle unknown values gracefully.
- Subscribe to the `#platform-api-changes` Slack channel for deprecation notices.

## CI Checks

The `contract-ci.yml` pipeline enforces:
- Schema validity (JSON Schema 2020-12 meta-validation)
- OpenAPI linting via Spectral (`tools/spectral.yaml`)
- Example validation (each example validates against its schema)
- Backwards-compatibility check via `oasdiff` on PRs targeting `main`
