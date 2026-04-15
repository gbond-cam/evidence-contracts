# Evidence Ingestion API — Contract Package

This package is the **single source of truth** for the Evidence Ingestion API contract.
It contains the OpenAPI specification, JSON Schemas, request/response examples, integration
guides, and CI tooling.

## Contents

| Path | Purpose |
|------|---------|
| `openapi/evidence-ingestion.v1.yaml` | OpenAPI 3.1 specification |
| `schemas/` | JSON Schema 2020-12 definitions |
| `examples/` | Annotated request/response examples |
| `docs/` | Integration guides and versioning policy |
| `tools/spectral.yaml` | Spectral API linting ruleset |
| `scripts/` | Validation and packaging scripts |
| `.github/workflows/contract-ci.yml` | CI pipeline |

## Quick Start

### Validate the contract locally

**PowerShell (Windows):**
```powershell
.\scripts\validate.ps1
```

**Bash (Linux / macOS / WSL):**
```bash
./scripts/validate.sh
```

### Pack for distribution
```powershell
.\scripts\pack.ps1
```

## Evidence Types

| Code | Description |
|------|-------------|
| `FACT_FIND` | Client Fact Find |
| `ATR_RISK_PROFILE` | Attitude to Risk / Risk Profile Output |
| `CLIENT_OBJECTIVES` | Client Objectives / Goals Summary |
| `FEES_AND_CHARGES_AGREEMENT` | Adviser Fees / Charges Agreement |
| `PRODUCT_KFI_KEY_FEATURES` | Product KFI / Key Features Illustration |
| `CEDING_STATEMENT` | Ceding Scheme/Provider Statement |
| `TRANSFER_AUTHORITY_OR_INSTRUCTION` | Transfer Authority / Client Instruction |
| `SUITABILITY_REPORT` | Suitability Report |
| `MEETING_NOTES` | Adviser Meeting Notes |
| `ID_VERIFICATION` | ID Verification Document |
| `PROOF_OF_ADDRESS` | Proof of Address |
| `OTHER` | Other (use sparingly) |

## Ingestion Modes

| Mode | Description |
|------|-------------|
| `PULL` | Service fetches the document from a URL you supply |
| `PUSH_INLINE` | Document bytes base64-encoded in the request body |
| `PUSH_REFERENCE` | Microsoft Graph DriveItem reference (SharePoint / OneDrive) |

## Integration Guides

- [Zapier Integration](zapier-integration.md)
- [SharePoint Reference Mode](sharepoint-reference.md)
- [Versioning & Breaking Changes](versioning-and-breaking-changes.md)

## Live Endpoints

| Environment | Base URL |
|-------------|----------|
| Production | `https://cam-func-ejovh2nxzqvcg.azurewebsites.net/api` |
| Local | `http://localhost:7071/api` |

Authentication uses an Azure Functions host key passed as `?code=<key>` query parameter.

## Schema Validation Rules

Documents submitted for ingestion are evaluated against the rules defined in
`evidence_profiles.v1.json` in the `evidence-contract` package. Key rules include:

- `DOC_MUST_BE_VERIFIED` — document must carry a verification flag
- `DOC_MUST_BE_LEGIBLE` — OCR confidence must meet threshold
- `DATE_MAX_AGE_365D` — document must not be older than 365 days
- `DATE_MAX_AGE_180D` — document must not be older than 180 days (applied to ceding statements)
