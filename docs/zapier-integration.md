# Zapier Integration Guide

This guide explains how to connect Zapier to the Evidence Ingestion API so that
documents placed in a watched folder (e.g., email attachment, Google Drive, OneDrive)
are automatically ingested into the Consilium FCA Vector Store.

## Prerequisites

- Zapier account with access to the relevant trigger app (e.g., Gmail, OneDrive, SharePoint)
- Azure Functions host key for the `cam-func-ejovh2nxzqvcg` function app
- `clientRef` and `caseRef` values for the target client record in the CRM

## Recommended Zap Pattern

```
[Trigger] New file in folder / email attachment received
    → [Filter] File type is PDF or DOCX
    → [Action] Upload file to Azure Blob Storage (get signed URL)
    → [Action] POST to Evidence Ingestion API (PULL mode)
    → [Action] Log correlationId to CRM / spreadsheet
```

## Step-by-Step: PULL Mode via Blob Signed URL

### 1. Trigger: File added to OneDrive folder

Configure the OneDrive "New File" trigger. Filter to ensure only supported MIME types
proceed (PDF, DOCX).

### 2. Action: Upload to Azure Blob Storage

Use the Azure Blob Storage Zapier app or a Webhooks action to PUT the file into your
staging container and retrieve a time-limited SAS URL (recommended TTL: 1 hour).

### 3. Action: POST to Evidence Ingestion API

**URL:**
```
https://cam-func-ejovh2nxzqvcg.azurewebsites.net/api/evidence/ingest?code=<YOUR_KEY>
```

**Method:** POST  
**Content-Type:** application/json

**Body template:**
```json
{
  "correlationId": "{{zap_meta_human_now | uuid4}}",
  "clientRef": "{{crm_client_ref}}",
  "caseRef": "{{crm_case_ref}}",
  "evidenceType": "FACT_FIND",
  "mode": "PULL",
  "documentDate": "{{file_last_modified | iso8601}}",
  "pullUrl": "{{blob_sas_url}}",
  "callbackUrl": "https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID/",
  "metadata": {
    "source": "zapier-workflow",
    "zapId": "{{zap_meta_zap_id}}"
  }
}
```

> **Note:** Replace `evidenceType` with the correct value for the document type you are
> ingesting. Refer to the evidence type table in [README.md](README.md).

### 4. (Optional) Action: Catch Webhook callback

Add a second Zap triggered by the `callbackUrl` webhook above to log the final
`COMPLETE` or `FAILED` status back into your CRM or audit sheet.

## Security Considerations

- Store the Azure Functions host key in Zapier's **App Secret** storage, not in Zap fields.
- Blob SAS URLs must use HTTPS and should have a short TTL (≤ 1 hour).
- Never log the full SAS URL to an audit trail; log only the `correlationId`.
- The staging blob container should be set to private access; SAS tokens provide
  scoped read-only access for the service.

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| HTTP 400 | Request body schema validation failure | Check all required fields are present; verify `mode` matches the body (e.g. `PULL` requires `pullUrl`) |
| HTTP 401 | Missing or expired function key | Re-generate the host key in Azure Portal and update Zapier App Secret |
| HTTP 422 | Business rule violation | Check `errors` array in response; most common is `DATE_MAX_AGE_365D` for old documents |
| `FAILED` webhook | Document failed validation | Check `itemResults[].rulesFailed` in the callback payload |
| No callback received | callbackUrl unreachable | Ensure the Zapier catch hook URL is active and not behind a firewall |
