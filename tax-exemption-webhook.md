# Tax-Exemption Validation Webhook

This page is the integrator contract for Micah's team (the external doc-review system). It describes how to send a validated tax-exemption decision to SCW Commerce.

---

## Overview

Tax-exempt customer status is set **authoritatively** by the external doc-review system — not by editing fields in HubSpot or the SCW Commerce admin UI. When Micah's team approves or revokes a customer's exemption, they send a signed webhook to SCW Commerce. SCW Commerce records the decision and pushes it to TaxJar so the correct tax treatment applies at checkout.

> **Important:** The customer account must already exist in SCW Commerce (by email address) before the webhook is sent. If the account does not exist, the webhook returns `404 customer_not_found`. Create the account first, then retry.

---

## Endpoint

```
POST /api/webhooks/tax-exemption
```

**Full URL (staging):** `https://hubspot.getscw.com/api/webhooks/tax-exemption`

---

## Authentication — Request Signing

Every request must include two headers:

| Header | Value |
|---|---|
| `x-scw-timestamp` | Current time as **epoch milliseconds** (e.g., `1717449600000`) |
| `x-scw-signature` | Hex-encoded HMAC-SHA256 signature (see below) |

### Signing Recipe

```
signature = HMAC-SHA256(
  key    = TAX_EXEMPTION_WEBHOOK_SECRET,
  message = "<timestamp>.<rawBody>"
)
```

Where:
- `<timestamp>` is the exact value sent in `x-scw-timestamp` (epoch ms, as a string)
- `<rawBody>` is the raw request body bytes (before any JSON parsing)
- The separator between timestamp and body is a literal period (`.`)
- The result is encoded as a **lowercase hex string**

**Example (pseudo-code):**
```
timestamp = "1717449600000"
body      = '{"email":"jane@example.com","exemption_type":"wholesale",...}'
message   = timestamp + "." + body
signature = hex(HMAC-SHA256(secret, message))
```

### Replay Window

SCW Commerce rejects requests where the `x-scw-timestamp` is more than **5 minutes** in the past **or** in the future relative to the server's current time. This is a symmetric ±5-minute window. Always generate `x-scw-timestamp` immediately before sending the request.

---

## Request Body

`Content-Type: application/json`

```json
{
  "email": "jane@example.com",
  "exemption_type": "wholesale",
  "exempt_regions": ["CA", "TX"],
  "validated_by": "micah@example.com",
  "validated_at": "2026-06-03T14:00:00Z",
  "document_reference": "EX-2026-0042"
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Customer email address. Matched **case-insensitively**; the stored and echoed value uses the lowercased form. |
| `exemption_type` | string | Yes | One of: `wholesale`, `government`, `other`, `non_exempt`. Use `non_exempt` to remove an existing exemption. |
| `exempt_regions` | string[] | No — defaults to `[]` | Array of two-letter US state codes (e.g., `["CA", "TX"]`). Optional. If omitted, defaults to an empty array. When `exemption_type` is not `non_exempt`, each provided code must be a valid US state/territory code (else 422). When `exemption_type` is `non_exempt`, this field is ignored. |
| `validated_by` | string | No | Email or name of the person who approved the exemption. Stored for audit. |
| `validated_at` | string | No | ISO 8601 datetime of when the document was validated. Stored for audit. |
| `document_reference` | string | No | Your internal reference ID for the supporting document (e.g., reseller certificate number). Stored for audit; shown on the admin Tax Exemptions page. |

---

## Response Codes

| HTTP Status | Code | Meaning | Retryable? |
|---|---|---|---|
| `200 OK` | — | Exemption applied. Body: `{ "ok": true, "changed": true/false }` (`changed: false` means the record was already in the requested state). | — |
| `400 Bad Request` | `invalid_json` | Request body could not be parsed as JSON. | Fix the payload |
| `401 Unauthorized` | `invalid_signature` | HMAC signature did not match, or the timestamp is outside the ±5-minute window. Check your signing logic and clock sync. | Fix the signature |
| `404 Not Found` | `customer_not_found` | No SCW Commerce account exists for that email. Create the account first, then retry. | Create account, then retry |
| `422 Unprocessable Entity` | `validation_error` | `exemption_type` is not one of the allowed values, or `exempt_regions` contains an unrecognised US state code. | Fix the payload |
| `502 Bad Gateway` | `sync_failed` | SCW Commerce saved the record but the TaxJar push failed. The exemption is recorded in SCW Commerce but TaxJar has not been updated yet. | Yes — retry the full request |

### 200 Response Body

```json
{
  "ok": true,
  "changed": true
}
```

`changed: false` is returned when the incoming request matches the customer's current exemption state exactly — the record was not modified. This is normal and does not indicate an error.

---

## What Happens On Success

1. The customer's exemption type, exempt regions, and provenance fields (`validated_by`, `validated_at`, `document_reference`) are updated in the SCW Commerce database.
2. An append-only row is written to the `tax_exemption_events` audit table — the history of every exemption change is preserved and cannot be overwritten.
3. The updated exemption is pushed to TaxJar so `$0` tax applies at checkout for the exempt regions.
4. The change is visible immediately on the read-only `/admin/tax-exemptions` page.

---

## Account Pre-Requisite

The webhook identifies customers by email address. If no SCW Commerce account exists for the supplied email, the endpoint returns `404 customer_not_found`. The workflow is:

1. Ensure the customer has an SCW Commerce account (created via the standard storefront registration or the HubSpot Contact webhook).
2. Send the tax-exemption webhook.

Do not retry a `404` without first creating the account — repeated `404` responses are not rate-limited but will never succeed until the account exists.

---

## Shared Secret

The `TAX_EXEMPTION_WEBHOOK_SECRET` is a shared secret agreed between SCW Commerce and the external doc-review system. It is stored as an environment variable on the SCW Commerce server. Contact the SCW engineering team to obtain or rotate the secret.
