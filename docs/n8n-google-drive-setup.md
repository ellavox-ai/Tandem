# n8n → Google Drive → Ellavox Setup

Watch a Google Drive folder for new meeting transcripts and automatically send them to Ellavox for processing.

## Prerequisites

- n8n instance running (cloud or self-hosted)
- Google account with Drive access
- Ellavox running with `WEBHOOK_SECRET` configured

## Architecture

```
Google Drive (new file) → n8n (watch + download) → Ellavox webhook → processing pipeline
```

n8n polls your Google Drive folder for new transcript files (`.vtt`, `.srt`, `.txt`), downloads the content, and POSTs it to `POST /api/webhooks/n8n`. The n8n provider parses the file inline — no separate fetch step needed.

---

## Step 1: Create a Google Drive Folder

Create a dedicated folder in Google Drive for meeting transcripts. Note the **folder ID** from the URL:

```
https://drive.google.com/drive/folders/<FOLDER_ID>
```

If you use Google Meet, configure it to save transcripts to this folder (Google Workspace Admin → Meet settings → Recording & transcripts).

---

## Step 2: Set Up the n8n Workflow

### Node 1: Google Drive Trigger

1. Add a **Google Drive Trigger** node
2. Connect your Google account (OAuth2)
3. Configure:
   - **Trigger On:** File Created
   - **Folder:** Select the folder from Step 1 (or paste the folder ID)
   - **Poll Times:** Every 5 minutes (or your preferred interval)

### Node 2: Filter (Optional but Recommended)

Add an **IF** node to filter by file type:

- **Condition:** `{{ $json.mimeType }}` contains `text/` OR `{{ $json.name }}` ends with `.vtt`, `.srt`, or `.txt`

This prevents non-transcript files (images, PDFs, etc.) from triggering the pipeline.

### Node 3: Download File Content

Add a **Google Drive** node (action node, not trigger):

1. **Operation:** Download
2. **File ID:** `{{ $json.id }}` (from the trigger node)
3. **Output:** Binary data

### Node 4: Convert Binary to Text

Add a **Move Binary Data** node:

1. **Mode:** Binary to JSON
2. **Options → Encoding:** UTF-8

This gives you the file content as a string in `{{ $json.data }}`.

### Node 5: Send to Ellavox

Add an **HTTP Request** node:

1. **Method:** POST
2. **URL:** `https://<YOUR_ELLAVOX_URL>/api/webhooks/n8n`
3. **Authentication:** Header Auth
4. **Header Name:** `x-webhook-secret`
5. **Header Value:** Your `WEBHOOK_SECRET` value
6. **Body Content Type:** JSON
7. **JSON Body:**

```json
{
  "fileContent": "{{ $json.data }}",
  "fileName": "{{ $('Google Drive Trigger').item.json.name }}",
  "fileId": "{{ $('Google Drive Trigger').item.json.id }}",
  "meetingTitle": "{{ $('Google Drive Trigger').item.json.name.replace(/\\.[^.]+$/, '') }}",
  "meetingDate": "{{ $('Google Drive Trigger').item.json.createdTime }}"
}
```

> Adjust the expression references (`$('Google Drive Trigger')`) to match your actual node names.

---

## Step 3: Test the Workflow

1. Drop a sample `.vtt` transcript file into your Google Drive folder
2. Manually execute the n8n workflow
3. Verify:
   - n8n shows a successful HTTP 200/201 response
   - Ellavox dashboard shows the new transcript in "pending" status
   - Processing kicks off and tasks are extracted

### Sample Test Payload

You can also test the webhook directly with curl:

```bash
curl -X POST https://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "fileContent": "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nAlice: We need to update the API docs by Friday.\n\n00:00:06.000 --> 00:00:10.000\nBob: I can take that. Should I also update the SDK examples?\n\n00:00:11.000 --> 00:00:15.000\nAlice: Yes, and create a Jira ticket to track it.",
    "fileName": "Sprint Planning 2024-01-15.vtt",
    "fileId": "test-file-001",
    "meetingTitle": "Sprint Planning",
    "meetingDate": "2024-01-15T10:00:00Z",
    "attendees": "Alice, Bob"
  }'
```

---

## Step 4: Activate the Workflow

Once testing passes, toggle the workflow to **Active** in n8n. It will now automatically poll Google Drive and forward new transcripts.

---

## Webhook Payload Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileContent` | string | **Yes** | Raw transcript text (VTT, SRT, or plain text) |
| `fileName` | string | No | Original filename — used to detect format (`.vtt`/`.srt`/`.txt`) |
| `fileId` | string | No | Google Drive file ID — used for deduplication |
| `meetingTitle` | string | No | Falls back to `fileName` without extension |
| `meetingDate` | string (ISO 8601) | No | Falls back to current time |
| `attendees` | string or array | No | Comma-separated names or JSON array of `{ name, email? }` |
| `duration` | number | No | Meeting duration in seconds — estimated from transcript if omitted |

---

## Troubleshooting

### Webhook returns 401

Your `x-webhook-secret` header doesn't match the `WEBHOOK_SECRET` env var in Ellavox. Double-check both values.

### Webhook returns 404

Make sure the URL path ends in `/api/webhooks/n8n` (not `/api/webhooks/google-meet`).

### Duplicate transcripts are ignored

The pipeline deduplicates on `(provider, fileId)`. If you re-upload the same Google Drive file, it will be skipped. To re-process, delete the transcript from the Ellavox dashboard first.

### n8n can't reach Ellavox

If running locally, use your machine's LAN IP or a tunnel (ngrok, Cloudflare Tunnel) instead of `localhost`. n8n Cloud cannot reach `localhost`.

### File content is empty or garbled

Make sure the "Move Binary Data" node is set to UTF-8 encoding. Some transcript files may use different encodings.

---

## Optional: Enrich with Google Calendar

To automatically populate meeting title and attendees from Google Calendar, add a **Google Calendar** node between the trigger and the HTTP request:

1. Search for calendar events matching the transcript filename or date
2. Extract the event title and attendee list
3. Pass them as `meetingTitle` and `attendees` in the webhook body
