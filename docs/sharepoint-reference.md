# SharePoint Reference Mode

This guide covers the `PUSH_REFERENCE` ingestion mode, which allows you to submit a
Microsoft Graph DriveItem reference in place of the document bytes. The Evidence
Ingestion service fetches the document directly from SharePoint or OneDrive using
its own application permissions.

## How It Works

```
Caller                          Evidence Service                     SharePoint
  |                                    |                                  |
  |-- POST /evidence/ingest ---------->|                                  |
  |   (PUSH_REFERENCE + itemId)        |                                  |
  |                                    |-- GET /drives/{id}/items/{id} -->|
  |                                    |<-- file bytes -------------------|
  |                                    |                                  |
  |                                    | [validate + index]               |
  |<-- 202 Accepted + correlationId ---|                                  |
```

## Required Graph Permissions

The `cam-func-ejovh2nxzqvcg` function app's managed identity must be granted:

| Permission | Type | Scope |
|-----------|------|-------|
| `Files.Read.All` | Application | Microsoft Graph |
| `Sites.Read.All` | Application | Microsoft Graph (if multi-site) |

Grant these in **Entra ID → App Registrations → cam-func → API Permissions**.

## Finding SharePoint IDs

### siteId

```powershell
# Replace with your SharePoint hostname and site path
$site = Invoke-MgGraphRequest -Method GET `
  "https://graph.microsoft.com/v1.0/sites/consiliumam.sharepoint.com:/sites/Compliance"
$site.id   # Format: hostname,siteGuid,webGuid
```

### driveId

```powershell
$drives = Invoke-MgGraphRequest -Method GET `
  "https://graph.microsoft.com/v1.0/sites/$($site.id)/drives"
# Pick the drive whose name matches your document library (e.g. "Documents")
$driveId = ($drives.value | Where-Object name -eq "Documents").id
```

### itemId

```powershell
# Path-based lookup
$item = Invoke-MgGraphRequest -Method GET `
  "https://graph.microsoft.com/v1.0/drives/$driveId/root:/Suitability Reports/SR-CLIENT-0042.pdf"
$item.id       # itemId
$item.'@odata.etag'  # eTag (supply to avoid redundant re-ingestion)
```

## eTag-Based Deduplication

If you supply the `eTag` field in `sharepointReference`, the service compares it
against the stored eTag from the previous successful ingestion of the same item.
If they match, the service returns `204 No Content` without re-processing.

This is particularly useful for scheduled sync jobs that check SharePoint folders
periodically.

```json
{
  "sharepointReference": {
    "driveId": "b!abc123...",
    "itemId": "01ABCDEF...",
    "eTag": "\"{A1B2C3D4-0000-0000-0000-000000000001},42\""
  }
}
```

## Version Conflict Handling

SharePoint may update a document between the time you read the `eTag` and the time
the service fetches it. The service handles this gracefully:

1. Service GETs the item using `If-None-Match: <eTag>`.
2. If Graph returns `304 Not Modified`, the service skips re-ingestion (idempotent).
3. If the item has changed, Graph returns the new bytes; ingestion proceeds normally
   and the stored eTag is updated.

## Supported Libraries

| Library Type | Supported | Notes |
|-------------|-----------|-------|
| SharePoint Document Library | ✅ | Primary use case |
| OneDrive for Business | ✅ | Same Graph API surface |
| SharePoint List Attachments | ❌ | Use PULL mode with SAS URL instead |
| Teams Channel Files | ✅ | Backed by SharePoint; use driveId from the channel |

## Troubleshooting

| Error | Resolution |
|-------|-----------|
| `403 Forbidden` from Graph | Check managed identity has `Files.Read.All` on the correct tenant |
| `404 Not Found` from Graph | Verify `driveId` and `itemId` are from the same drive |
| `MIME_TYPE_NOT_ALLOWED` rule failure | Upload only PDF or DOCX to SharePoint; convert other formats first |
| Item deleted before fetch | The service returns `FAILED` with code `SOURCE_NOT_FOUND`; re-submit after restoring the item |
