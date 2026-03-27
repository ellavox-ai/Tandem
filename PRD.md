# Product Requirements Document — Ellavox Meeting Intelligence Pipeline

| Field   | Value                                    |
| ------- | ---------------------------------------- |
| Product | Ellavox Meeting Intelligence Pipeline    |
| Author  | Sean (Ellavox)                           |
| Version | 2.0                                      |
| Date    | March 23, 2026                           |
| Status  | Proposed                                 |

---

## Manifest: The Human-Agent Collaboration Thesis

Autonomous agents fail at a predictable point: the moment they encounter ambiguity they can't resolve from available context. This is the bottleneck of the agentic loop. The agent either halts and waits for input — blocking the entire pipeline — or it guesses and produces low-quality output that a human has to clean up anyway. Both outcomes burn time and erode trust.

The conventional response is to pick a side: fully autonomous (accept the errors) or fully supervised (accept the slowness). Ellavox rejects this binary.

### The Bottleneck Is Context, Not Capability

Large language models are remarkably capable at structured extraction, prioritization, and specification writing. What they lack is situational context that only exists in people's heads: who actually owns a deliverable, what "soon" means for this team, whether a vague discussion point is a real commitment or idle brainstorming. No amount of prompt engineering recovers information that isn't in the transcript.

The agentic loop stalls not because the model can't reason, but because it doesn't have the inputs to reason *about*. The bottleneck is informational, not computational.

### Confidence-Routed Collaboration

Ellavox introduces a **confidence-routed architecture** that dynamically decides when human input is needed and when the agent can proceed alone:

1. **High confidence** — The agent has clear signals (explicit owner, concrete deliverable, stated timeline). It acts autonomously. No human touchpoint. No delay.
2. **Medium / Low confidence** — The agent knows *what it doesn't know*. It identifies the specific missing context, formulates targeted questions, and routes to a human interview — not for approval, but for information the agent literally cannot infer.
3. **Post-interview** — The human's input closes the context gap. The agent resumes with full autonomy: refining requirements, routing to the correct project, creating the Jira issue.

The human is never a bottleneck reviewer standing between the agent and its output. The human is a **context provider** — called in surgically, only when the agent has identified a gap it cannot fill, and released as soon as that gap is closed.

### Why This Unlocks Autonomy

Traditional human-in-the-loop systems treat human oversight as a safety net draped over the entire process. Every action gets reviewed. The agent has capability but no authority. This doesn't scale — it replaces one bottleneck (manual task creation) with another (manual task approval).

Confidence-routed collaboration inverts this. The default state is autonomous execution. Human involvement is the exception, not the rule, and when it happens it's *additive* — it contributes information the agent didn't have, rather than validating information the agent already had.

This produces a compounding effect:

- **Agents get better inputs.** Interview responses enrich the task with context no model could have extracted. The resulting Jira cards are higher quality than either pure-AI or pure-human output.
- **Humans do less work.** Instead of creating tasks from scratch or reviewing every AI output, humans answer 2-3 targeted questions for the subset of tasks that need it.
- **The pipeline self-optimizes.** Dismissal patterns and interview corrections feed back into extraction prompt tuning (Phase 4), progressively raising the confidence threshold and reducing human involvement over time.
- **Downstream agents inherit quality.** When cards land on domain-specific boards already well-structured and correctly routed, the next layer of agents — engineering, sales, marketing, design — can operate with higher autonomy because their inputs are clean.

### The Larger Vision

Ellavox is a proof of concept for a broader principle: **the fastest path to autonomous agents runs through structured human collaboration, not around it.**

Every domain has a version of this problem. Sales calls produce follow-ups that nobody tracks. Support conversations surface product gaps that never reach engineering. Strategy sessions generate initiatives that evaporate before they become work items. In each case, an AI agent can do 80% of the work autonomously — and the remaining 20% requires a human providing context that doesn't exist in any system of record.

The architecture Ellavox demonstrates — extract with confidence scoring, route by confidence level, interview for missing context, then hand off to fully autonomous downstream processing — is a general pattern. The meeting-to-Jira pipeline is the first instantiation. The thesis is that this pattern applies wherever unstructured human communication needs to become structured, trackable work.

Build the collaboration layer right, and autonomy follows.

---

## 1. Overview

The Meeting Intelligence Pipeline automates the extraction of actionable tasks from meeting transcripts using Claude AI. When a meeting ends, the system ingests the transcript, identifies action items, and either creates Jira tasks automatically (high confidence) or queues them for a short human interview to gather missing context (low confidence).

The system is **platform-agnostic** — it supports Google Meet, Zoom, and Microsoft Teams through a provider abstraction layer, with the ability to add new transcript sources without modifying core pipeline logic.

This addresses a universal problem: action items discussed in meetings get lost, forgotten, or lack sufficient detail to be actionable. By combining AI extraction with a lightweight human-in-the-loop interview process, we ensure every task gets created with the right context.

---

## 2. Problem Statement

- Action items from meetings are frequently lost or poorly documented
- Manual task creation after meetings is tedious and often skipped
- Meeting notes lack the specificity needed for engineering tickets (acceptance criteria, dependencies, etc.)
- No systematic way to ensure every discussed task becomes a tracked work item
- Context degrades rapidly — within 24 hours, participants forget nuance from the discussion

---

## 3. User Stories

| As a...           | I want to...                                                            | So that...                                                                 |
| ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Team Lead         | Review a list of pending tasks needing context after a meeting          | I can quickly add missing details without re-watching the recording        |
| Any Team Member   | Pick up an open interview from a queue and complete it                  | Tasks get created with full context regardless of who provides it          |
| Product Manager   | See all tasks auto-generated from meetings in Jira                      | Nothing falls through the cracks between meetings                          |
| Engineering Lead  | Have high-confidence tasks created automatically without manual review  | Clear action items don't require extra human touchpoints                   |
| Team Member       | Dismiss a false-positive extraction as "not a real task"                | The queue stays clean and only contains genuine action items               |
| Admin             | Configure which transcript sources are active and set confidence thresholds | The pipeline adapts to our team's tools and tolerance for auto-creation |
| Team Member       | Get notified when interviews are waiting for me                         | I don't have to remember to check the queue                               |

---

## 4. Solution Architecture

The system is a standalone Node.js service with a Next.js frontend, backed by Supabase for persistence and queue management. It integrates with meeting platforms (Google Meet, Zoom, Microsoft Teams) through a provider abstraction, Claude API for extraction, VAPI (optional voice interviews), and Atlassian Jira.

### 4.1 System Components

| Component                          | Description                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transcript Provider Layer**      | Platform-specific adapters (Google Meet, Zoom, Teams) that listen for transcript-ready events and normalize output into a common format. New providers can be added without changing downstream logic. |
| **Task Extraction Engine**         | Node.js service calling Claude API with structured prompt. Parses normalized transcript, extracts action items, assigns confidence scores.                                            |
| **Interview Queue (Supabase)**     | Stores low/medium-confidence tasks as pending interviews. Tracks status, assignee claims, completion state, and full audit trail.                                                     |
| **Interview Web UI**               | Next.js app showing pending interviews. Any team member can claim one and answer clarifying questions in a guided flow. Supports partial saves and task dismissal.                     |
| **Interview Agent (VAPI — Phase 3)** | Voice-based alternative: VAPI agent calls/messages the team and walks them through clarifying questions for queued tasks.                                                            |
| **Task Creation Service**          | Takes enriched task data and creates Jira issues via Atlassian API. Handles both auto-created (high confidence) and interview-completed tasks. Retries on failure.                    |
| **Notification Service**           | Sends Slack messages and/or email digests when new interviews are queued, claims are expiring, or tasks are created.                                                                  |
| **Dashboard / Admin UI**           | Overview of pipeline health: tasks created, interviews pending, transcript processing status, provider configuration, and confidence threshold settings.                              |

### 4.2 Provider Abstraction Layer

All transcript sources conform to a common **TranscriptProvider** interface:

```
interface TranscriptProvider {
  name: string                          // "google-meet" | "zoom" | "ms-teams"
  initialize(config: ProviderConfig): Promise<void>
  startListening(): Promise<void>       // Begin watching for new transcripts
  stopListening(): Promise<void>
  fetchTranscript(ref: string): Promise<NormalizedTranscript>
}

interface NormalizedTranscript {
  provider: string                      // Source platform
  externalId: string                    // Platform-specific transcript ID
  meetingTitle: string
  meetingDate: Date
  duration: number                      // seconds
  attendees: Attendee[]                 // { name, email, provider_id }
  utterances: Utterance[]               // Normalized speaker-labeled segments
  rawFormat: "json" | "vtt" | "text"    // Original format before normalization
  metadata: Record<string, unknown>     // Provider-specific extras
}

interface Utterance {
  speaker: string                       // Display name
  speakerEmail?: string                 // If resolvable
  text: string
  startTime: number                     // seconds from meeting start
  endTime: number
}
```

#### Platform-Specific Implementation Notes

**Google Meet**
- **Trigger**: Google Workspace Events API v1 → Pub/Sub subscription. Listen for `google.workspace.meet.transcript.v2.fileGenerated`.
- **Transcript format**: Structured JSON via Meet REST API v2 (`conferenceRecords/{id}/transcripts/{id}/entries`). Each entry has participant ref, text, start/end time.
- **Auth**: OAuth 2.0 with domain-wide delegation for service account access. Scopes: `meetings.space.readonly`, `drive.meet.readonly`.
- **Requirements**: Workspace Business Standard+ tier. Transcription must be enabled by admin.
- **Gotcha**: No direct HTTP webhook — requires Google Cloud Pub/Sub infrastructure. Transcript entries from API may differ from the Google Doc version.

**Zoom**
- **Trigger**: Direct HTTP webhook — `recording.completed` event. Filter for `file_type: "TRANSCRIPT"` in payload.
- **Transcript format**: WebVTT (.vtt) file. Speaker names embedded in cue text but not as structured metadata.
- **Auth**: Server-to-Server OAuth (simplest of the three). Scopes: `cloud_recording:read:list_recording_files`.
- **Requirements**: Pro+ tier. Cloud recording AND Audio Transcript must both be enabled (disabled by default).
- **Gotcha**: `recording.transcript_completed` webhook is unreliable — use `recording.completed` instead. Delay of minutes to tens of minutes between meeting end and transcript availability.

**Microsoft Teams**
- **Trigger**: Microsoft Graph change notifications. Subscribe to `/communications/callRecords` creation, then poll for transcripts using meeting ID from call record.
- **Transcript format**: WebVTT (.vtt) via Graph API. Speaker names and timestamps per utterance.
- **Auth**: Application permissions with `OnlineMeetingTranscript.Read.All` + `CallRecords.Read.All`. Requires admin consent AND application access policy grant.
- **Requirements**: Transcription enabled by tenant policy. Meeting ID is base64-encoded (not the join URL).
- **Gotcha**: Direct transcript subscriptions are unreliable — always use callRecords → poll pattern. Graph subscriptions expire (max ~4230 min) and must be renewed.

**Manual Upload (Fallback)**
- Upload a transcript file (.vtt, .txt, .srt, .doc) via the web UI.
- User provides meeting metadata (title, date, attendees) manually.
- Useful for platforms not yet integrated or when automatic ingestion fails.

### 4.3 Data Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Google Meet  │    │     Zoom     │    │  MS Teams    │
│   Pub/Sub     │    │   Webhook    │    │  Graph Sub   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Provider Adapter   │  Normalize to common format
        │  (per platform)     │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │  Dedup & Ingest     │  Check transcript_id, store in Supabase
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │  Claude Extraction  │  Structured prompt → task array
        └─────────┬───────────┘
                  │
           ┌──────┴──────┐
           │             │
     High confidence   Low/Medium confidence
           │             │
           ▼             ▼
  ┌────────────┐  ┌──────────────────┐
  │ Jira Auto  │  │ Interview Queue  │──→ Notifications (Slack/Email)
  │ Create     │  │ (Supabase)       │
  └─────┬──────┘  └────────┬─────────┘
        │                  │
        │           ┌──────┴──────┐
        │           │             │
        │      Web UI Interview  VAPI Agent (Phase 3)
        │           │             │
        │           └──────┬──────┘
        │                  │
        │           ┌──────┴──────┐
        │           │             │
        │      Create Task    Dismiss
        │           │         (not a task)
        │           ▼
        │    ┌────────────┐
        └───►│   Jira     │
             │   Issue    │
             └────────────┘
```

1. Meeting ends → platform generates transcript
2. Provider adapter detects new transcript via platform-specific mechanism
3. Adapter normalizes transcript to common `NormalizedTranscript` format
4. Ingestion service deduplicates (by `provider + externalId`) and stores in Supabase
5. Transcript text sent to Claude API with structured extraction prompt
6. Claude returns array of tasks with confidence scores and missing context lists
7. High-confidence tasks → Jira issues created immediately (with retry on failure)
8. Low/medium-confidence tasks → inserted into interview queue
9. Notification sent to relevant team members (Slack/email)
10. Team member claims interview in web UI, answers clarifying questions (or dismisses as false positive)
11. Completed interview → enriched task data → Jira issue created
12. (Optional Phase 3) VAPI agent proactively reaches out for interviews via voice/SMS

---

## 5. Detailed Requirements

### 5.1 Transcript Ingestion

- **Trigger latency** — Detect and begin processing new transcripts within 5 minutes of availability (note: platform-side delays vary)
- **Normalization** — All transcripts converted to `NormalizedTranscript` format before entering the pipeline. Provider-specific quirks handled in the adapter, not downstream.
- **Metadata captured** — Meeting title, date/time, attendees (resolved from platform identity where possible), duration, source platform
- **Deduplication** — Track processed transcripts by `(provider, externalId)` in Supabase `transcripts` table
- **Error handling** — Retry 3x with exponential backoff (1s, 4s, 16s). On persistent failure: mark transcript as `failed` in DB, send alert to configured notification channel.
- **Manual upload** — Web UI supports drag-and-drop upload of .vtt, .txt, .srt files with manual metadata entry
- **Backpressure** — BullMQ concurrency limit of 5 simultaneous extraction jobs. Additional transcripts queue and process in order.

### 5.2 Claude Task Extraction

The extraction prompt instructs Claude to analyze the full normalized transcript and return a structured JSON array. Each extracted task includes:

| Field              | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `title`            | Concise action item title                                          |
| `description`      | Full context from the discussion                                   |
| `inferred_assignee`| Who was discussed as owning this (name + email if identifiable)    |
| `inferred_assignees`| Array — for multi-person tasks                                    |
| `confidence`       | `high` \| `medium` \| `low`                                       |
| `missing_context`  | Array of specific questions Claude couldn't answer from transcript |
| `priority`         | Inferred urgency (P0–P3)                                          |
| `labels`           | Suggested Jira labels based on topic                               |
| `source_quotes`    | Relevant excerpts from the transcript with timestamps              |
| `meeting_group_id` | Identifier linking tasks from the same meeting for Jira grouping   |

**Confidence scoring criteria:**

| Level  | Criteria                                                     | Example                                                        |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| High   | Clear owner, specific deliverable, timeline mentioned        | "Sean will ship the AppFolio webhook by Friday."               |
| Medium | Action discussed but owner or scope ambiguous                | "Someone should look into the latency issue."                  |
| Low    | Vague reference to future work, no clear owner or deliverable| "We should probably think about scaling at some point."        |

**Multi-assignee handling**: When multiple people are mentioned for one task (e.g., "Sean and Alex will pair on this"), Claude extracts all names into `inferred_assignees`. The interview or auto-creation step picks the first as primary assignee and adds others as watchers/mentions.

**Recurring meeting awareness**: The extraction prompt includes titles and keys of Jira issues created from previous instances of the same recurring meeting (matched by meeting title). Claude uses this to distinguish "still working on X" (skip) from new action items.

### 5.3 Interview Queue & UI

The interview queue is the core differentiator of this system. Rather than discarding low-confidence items or creating garbage tasks, we route them through a lightweight interview process.

#### Queue Behavior

- Tasks enter the queue with status `pending_interview`
- Any authenticated team member can view pending interviews (scoped by access — see Section 8)
- A member claims an interview → status: `claimed`, locked for 30 minutes
- If not completed within 30 minutes, claim expires and interview returns to pool (status reverts to `pending_interview`)
- Completed interviews trigger task creation → status: `completed`
- Members can dismiss an item as "not a real task" → status: `dismissed` with optional reason
- Unclaimed interviews expire after a configurable period (default: 72 hours) → status: `expired`

#### Queue Ordering

Pending interviews are sorted by:
1. Interviews from meetings the current user attended (prioritized)
2. Inferred priority (P0 first)
3. Meeting recency (newest first)

#### Interview UI Flow

1. Member sees list of pending interviews with: meeting name, date, source platform, task title, inferred priority
2. Member clicks "Start Interview" → claim is registered, 30-minute timer starts
3. UI shows the extracted context Claude already has (including source quotes from transcript), plus the specific clarifying questions
4. Member answers each question (free text, dropdowns for assignee/priority, autocomplete for Jira labels)
5. **Partial save**: progress is auto-saved every 30 seconds. If the member navigates away, they can resume where they left off (claim timer still applies)
6. Member clicks "Create Task" → enriched data sent to Task Creation Service
7. Alternatively, member clicks "Not a Task" → item dismissed with optional reason
8. Confirmation shown with link to created Jira issue (or dismissal confirmation)

#### Notifications

- **Slack** (primary): When new interviews are queued, post to a configured Slack channel with meeting name, number of items, and a link to the queue. Mention attendees if identifiable.
- **Email digest** (secondary): Daily summary of pending interviews sent to team members who have unclaimed items from meetings they attended.
- **Claim expiry warning**: Slack DM to the claimer 5 minutes before their 30-minute window expires.

### 5.4 VAPI Interview Agent (Phase 3)

As an alternative to the web UI, a VAPI voice agent can proactively reach out to team members for interviews.

- Agent is triggered from the interview queue via BullMQ job
- Checks Google Calendar for team member availability before calling
- Runs a structured conversational interview asking Claude's clarifying questions
- Transcribes responses and sends enriched context back to the pipeline
- Falls back to SMS if voice call is unanswered
- Respects a per-user "do not call" preference

### 5.5 Jira Integration

- **Project** — Configurable target project per team/meeting (default: SCRUM)
- **Issue type** — Task (default), with option to override based on extracted context
- **Fields populated** — Summary, Description (with transcript source quotes), Assignee (via Jira account lookup from email), Priority, Labels
- **Multi-assignee** — Primary assignee set on ticket. Additional assignees added as watchers.
- **Meeting grouping** — All tasks from a single meeting are linked to a shared Jira Epic (auto-created per meeting) or labeled with a common `meeting:<meeting-id>` label
- **Source tracking** — Custom field or label linking back to source transcript, meeting, and interview (if applicable)
- **Duplicate detection** — Before creation, query recent Jira issues (last 14 days) in the target project. Use title similarity (Levenshtein distance < 0.3 on normalized strings) + same meeting attendees as signals. Flag potential duplicates for human review rather than silently skipping.
- **Creation failure handling** — On Jira API failure: retry 3x with exponential backoff. If all retries fail, task status moves to `jira_failed` and an alert is sent. Failed tasks surface in the admin dashboard for manual retry.

### 5.6 Semantic Duplicate Detection (Detail)

Duplicate detection operates at two levels:

1. **Within-meeting**: Claude is prompted to deduplicate during extraction (same action item mentioned multiple times in one meeting).
2. **Cross-meeting**: Before Jira creation, compare extracted title against recent issues:
   - Normalize both strings (lowercase, strip punctuation, remove stop words)
   - Compute Levenshtein similarity on normalized strings
   - If similarity > 0.7, flag as potential duplicate
   - Potential duplicates are surfaced in the interview UI with a "Possible duplicate of PROJ-123" warning and a link. The human decides whether to create or skip.

Phase 2+ enhancement: Use embedding-based similarity (Claude embeddings or a lightweight model) for semantic matching beyond string similarity.

---

## 6. Data Model

### 6.1 `users` table

| Field            | Type           | Description                                    |
| ---------------- | -------------- | ---------------------------------------------- |
| `id`             | UUID           | Primary key                                    |
| `email`          | String         | Primary identifier, from Google OAuth          |
| `display_name`   | String         | Display name                                   |
| `google_id`      | String (nullable) | Google account ID                           |
| `jira_account_id`| String (nullable) | Mapped Jira account ID for assignee lookup  |
| `slack_user_id`  | String (nullable) | For Slack notifications                     |
| `role`           | Enum           | `admin` \| `member`                            |
| `preferences`    | JSON           | User preferences (notification settings, do-not-call, etc.) |
| `created_at`     | Timestamp      | Record creation time                           |
| `updated_at`     | Timestamp      | Last update time                               |

### 6.2 `transcripts` table

| Field              | Type           | Description                                       |
| ------------------ | -------------- | ------------------------------------------------- |
| `id`               | UUID           | Primary key                                       |
| `provider`         | String         | `google-meet` \| `zoom` \| `ms-teams` \| `manual`|
| `external_id`      | String         | Platform-specific transcript/recording ID         |
| `meeting_title`    | String         | Name of the meeting                               |
| `meeting_date`     | Timestamp      | When the meeting occurred                         |
| `duration`         | Integer        | Meeting duration in seconds                       |
| `attendees`        | JSON array     | `[{ name, email, provider_id }]`                  |
| `utterance_count`  | Integer        | Number of utterances in normalized transcript     |
| `status`           | Enum           | `pending` \| `processing` \| `completed` \| `failed` |
| `error_message`    | Text (nullable)| Error details if processing failed                |
| `processed_at`     | Timestamp (nullable) | When extraction completed                   |
| `created_at`       | Timestamp      | Record creation time                              |
| `updated_at`       | Timestamp      | Last update time                                  |

**Note**: Raw transcript text is NOT stored long-term. It is held in memory during processing and discarded after extraction. Only metadata and extracted tasks persist.

**Unique constraint**: `(provider, external_id)` — prevents reprocessing.

### 6.3 `extracted_tasks` table

| Field                | Type                | Description                                        |
| -------------------- | ------------------- | -------------------------------------------------- |
| `id`                 | UUID                | Primary key                                        |
| `transcript_id`      | UUID / FK           | Reference to `transcripts.id`                      |
| `extracted_title`    | String              | Task title from Claude extraction                  |
| `extracted_description` | Text             | Task description from Claude                       |
| `inferred_assignees` | JSON array          | `[{ name, email }]` — supports multi-assignee      |
| `confidence`         | Enum                | `high` \| `medium` \| `low`                        |
| `missing_context`    | JSON array          | Questions Claude couldn't answer                   |
| `source_quotes`      | JSON array          | Relevant transcript excerpts with timestamps       |
| `priority`           | String              | `P0` \| `P1` \| `P2` \| `P3`                      |
| `labels`             | JSON array          | Suggested Jira labels                              |
| `status`             | Enum                | `pending_interview` \| `claimed` \| `completed` \| `dismissed` \| `auto_created` \| `expired` \| `jira_failed` |
| `claimed_by`         | UUID / FK (nullable)| Reference to `users.id`                            |
| `claimed_at`         | Timestamp (nullable)| When it was claimed                                |
| `claim_expires_at`   | Timestamp (nullable)| When the claim lock expires                        |
| `dismissed_reason`   | Text (nullable)     | Why it was dismissed (if status = dismissed)       |
| `interview_responses`| JSON (nullable)     | Answers from the interview                         |
| `jira_issue_key`     | String (nullable)   | Created Jira issue ID (e.g., SCRUM-123)            |
| `jira_error`         | Text (nullable)     | Error message if Jira creation failed              |
| `created_at`         | Timestamp           | Record creation time                               |
| `updated_at`         | Timestamp           | Last update time                                   |

### 6.4 `task_status_history` table (Audit Trail)

| Field         | Type           | Description                              |
| ------------- | -------------- | ---------------------------------------- |
| `id`          | UUID           | Primary key                              |
| `task_id`     | UUID / FK      | Reference to `extracted_tasks.id`        |
| `old_status`  | String         | Previous status                          |
| `new_status`  | String         | New status                               |
| `changed_by`  | UUID / FK (nullable) | User who caused the change (null for system) |
| `metadata`    | JSON (nullable)| Additional context (e.g., claim expiry reason) |
| `created_at`  | Timestamp      | When the transition occurred             |

### 6.5 `pipeline_config` table

| Field         | Type           | Description                                        |
| ------------- | -------------- | -------------------------------------------------- |
| `id`          | UUID           | Primary key                                        |
| `key`         | String (unique)| Configuration key                                  |
| `value`       | JSON           | Configuration value                                |
| `updated_by`  | UUID / FK      | Who last changed it                                |
| `updated_at`  | Timestamp      | When it was last changed                           |

Default configuration entries:
- `confidence_auto_create_threshold` — Which confidence levels auto-create (default: `["high"]`)
- `interview_expiry_hours` — Hours before unclaimed interviews expire (default: `72`)
- `claim_timeout_minutes` — Minutes before a claim expires (default: `30`)
- `jira_default_project` — Default Jira project key (default: `"SCRUM"`)
- `active_providers` — Which transcript providers are enabled
- `notification_channels` — Slack channel IDs, email lists for notifications
- `duplicate_similarity_threshold` — Levenshtein threshold for duplicate flagging (default: `0.7`)

---

## 7. API Design

### 7.1 REST Endpoints

#### Transcripts
| Method | Path                              | Description                          | Auth       |
| ------ | --------------------------------- | ------------------------------------ | ---------- |
| POST   | `/api/webhooks/:provider`         | Receive webhook from transcript provider | Provider-specific verification |
| POST   | `/api/transcripts/upload`         | Manual transcript upload             | Authenticated |
| GET    | `/api/transcripts`                | List processed transcripts           | Authenticated |
| GET    | `/api/transcripts/:id`            | Get transcript details + task list   | Authenticated |

#### Interview Queue
| Method | Path                              | Description                          | Auth       |
| ------ | --------------------------------- | ------------------------------------ | ---------- |
| GET    | `/api/interviews`                 | List pending interviews (sorted)     | Authenticated |
| POST   | `/api/interviews/:taskId/claim`   | Claim an interview                   | Authenticated |
| POST   | `/api/interviews/:taskId/save`    | Partial save of interview responses  | Claimer only |
| POST   | `/api/interviews/:taskId/complete`| Complete interview and create task   | Claimer only |
| POST   | `/api/interviews/:taskId/dismiss` | Dismiss as not a real task           | Authenticated |
| POST   | `/api/interviews/:taskId/release` | Release a claim early                | Claimer only |

#### Tasks
| Method | Path                              | Description                          | Auth       |
| ------ | --------------------------------- | ------------------------------------ | ---------- |
| GET    | `/api/tasks`                      | List all extracted tasks (filterable)| Authenticated |
| GET    | `/api/tasks/:id`                  | Get task detail                      | Authenticated |
| POST   | `/api/tasks/:id/retry-jira`       | Retry failed Jira creation           | Admin      |

#### Admin / Config
| Method | Path                              | Description                          | Auth       |
| ------ | --------------------------------- | ------------------------------------ | ---------- |
| GET    | `/api/config`                     | Get pipeline configuration           | Admin      |
| PATCH  | `/api/config/:key`                | Update a config value                | Admin      |
| GET    | `/api/dashboard/stats`            | Pipeline health metrics              | Authenticated |
| GET    | `/api/providers`                  | List configured providers + status   | Admin      |
| PATCH  | `/api/providers/:name`            | Enable/disable a provider            | Admin      |

### 7.2 Realtime

Supabase Realtime subscriptions for:
- `extracted_tasks` table changes — UI updates when new interviews arrive, claims change, tasks complete
- `transcripts` table changes — dashboard updates when transcripts are processing/completed

---

## 8. Auth & Access Control

### 8.1 Authentication

- **Primary**: Google OAuth 2.0 (same Google Workspace SSO)
- Session managed via HTTP-only secure cookies (Next.js auth)
- JWT tokens for API calls from the frontend

### 8.2 Roles

| Role    | Permissions                                                                     |
| ------- | ------------------------------------------------------------------------------- |
| `admin` | All member permissions + configure pipeline settings + manage providers + retry failed tasks + view all transcripts |
| `member`| View interviews from meetings they attended OR unclaimed interviews from any meeting. Claim, complete, and dismiss interviews. View dashboard. Upload transcripts manually. |

### 8.3 Row-Level Security (Supabase RLS)

- **transcripts**: Members can view transcripts from meetings where their email is in the `attendees` array. Admins can view all.
- **extracted_tasks**: Members can view tasks from transcripts they have access to, plus any task with status `pending_interview` (to enable the "anyone can help" model). Admins can view all.
- **pipeline_config**: Admin read/write only.
- **task_status_history**: Same access as the parent task.

---

## 9. Observability & Operations

### 9.1 Logging

- Structured JSON logs (pino) to stdout
- Log levels: `error`, `warn`, `info`, `debug`
- Key events logged: transcript received, extraction started/completed, task created, interview claimed/completed, Jira API calls, provider errors
- Correlation ID per transcript flows through all related log entries

### 9.2 Monitoring & Alerting

| Metric                              | Alert Condition                    | Channel       |
| ----------------------------------- | ---------------------------------- | ------------- |
| Transcript processing failures      | > 2 consecutive failures           | Slack + Email |
| Jira creation failures              | Any failure after 3 retries        | Slack         |
| Interview queue depth               | > 20 unclaimed items               | Slack         |
| Claim expiry rate                   | > 50% of claims expiring           | Email digest  |
| Provider webhook health             | No events received in 24h (if meetings occurred) | Slack |
| BullMQ job queue depth              | > 50 pending jobs                  | Slack         |

### 9.3 Rate Limiting & Backpressure

- **Claude API**: BullMQ concurrency limit of 5 simultaneous extraction jobs. Rate-limited to stay within API tier limits.
- **Jira API**: Max 10 concurrent requests. Respect Jira's rate limit headers (`X-RateLimit-Remaining`).
- **Webhook endpoints**: Express rate limiting — 100 requests/minute per provider (protects against webhook replay attacks).
- **Burst handling**: If 20 meetings end at the same time, transcripts queue in BullMQ and process sequentially within concurrency limits. No transcript is dropped.

### 9.4 Configuration Management

All runtime configuration stored in `pipeline_config` table (Section 6.5). Changes via Admin UI are audited (who changed what, when). Environment-specific secrets (API keys, OAuth credentials) stored in environment variables, never in the database.

---

## 10. Security & Privacy

### 10.1 Data Handling

- **Transcript text**: Held in memory during processing only. NOT persisted to database after extraction. Raw text is passed to Claude API for extraction and then discarded.
- **Claude API**: Review Anthropic's data usage policy. Transcripts sent to Claude may contain sensitive meeting content. Ensure the API agreement covers your data handling requirements. Consider using Claude's zero-retention API option if available.
- **PII in extracted tasks**: Task descriptions may contain names and discussion context. This is acceptable as it mirrors what would be in a manually-created Jira ticket. No special PII scrubbing applied.
- **Retention**: Extracted tasks and metadata retained as long as they exist in Jira. Transcript metadata (not raw text) retained for 90 days for audit purposes, then auto-purged.

### 10.2 Access Control

- All API endpoints require authentication (except provider webhook endpoints, which use provider-specific verification — e.g., Zoom webhook verification token, Google Pub/Sub JWT)
- Supabase RLS enforces row-level access (Section 8.3)
- Admin actions logged to `task_status_history` with `changed_by`

### 10.3 Secrets Management

- OAuth client secrets, Jira API tokens, Slack webhook URLs, provider API keys: stored as environment variables
- Never logged, never stored in database
- Rotated on a team-defined schedule (recommended: 90 days)

---

## 11. Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Runtime          | Node.js (standalone service)                            |
| Database         | Supabase (Postgres + Realtime + RLS)                    |
| AI               | Claude API (claude-sonnet-4-20250514 for extraction)    |
| Frontend         | Next.js (React) for interview queue + admin dashboard   |
| Voice            | VAPI for interview agent (Phase 3)                      |
| Telephony        | Twilio for SMS fallback (Phase 3)                       |
| Task Management  | Atlassian Jira via REST API                             |
| Meeting Platforms| Google Meet (Workspace Events API + Meet REST API)      |
|                  | Zoom (Webhook + Recording API)                          |
|                  | Microsoft Teams (Graph API + Change Notifications)      |
| Job Queue        | BullMQ (Redis-backed) for async processing              |
| Notifications    | Slack (Incoming Webhooks / Bolt) + Email (Resend/SES)   |
| Auth             | Google OAuth (Workspace SSO)                            |
| Logging          | Pino (structured JSON)                                  |
| Monitoring       | Application-level metrics exposed for your preferred tool (Datadog, Grafana, etc.) |

---

## 12. Phased Rollout

| Phase                           | Timeline   | Scope                                                                                                                     |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1: Core Pipeline**      | 4–6 weeks  | Provider abstraction layer with Google Meet adapter. Claude task extraction. Jira auto-creation for high-confidence tasks. Supabase schema + interview queue (backend only). Manual transcript upload. Basic error handling and logging. |
| **Phase 2: Interview UI**       | 2–3 weeks  | Next.js web app for interview queue. Claim/complete/dismiss flow with partial save. Slack notifications for new interviews. Duplicate detection (string similarity). Queue ordering logic. |
| **Phase 3: Multi-Provider + VAPI** | 3–4 weeks | Zoom adapter. Microsoft Teams adapter. VAPI voice interview agent. Calendar-aware outreach. SMS fallback. |
| **Phase 4: Dashboard & Polish** | 2–3 weeks  | Admin dashboard with pipeline metrics. Provider configuration UI. Confidence threshold tuning. Feedback loop for prompt improvement. Email digest notifications. Recurring meeting awareness. |

---

## 13. Success Metrics

| Metric                        | Target                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Task capture rate             | >=90% of action items discussed in meetings result in Jira tasks |
| Auto-creation accuracy        | >=80% of high-confidence tasks require no edits after creation |
| Interview completion rate     | >=75% of queued interviews completed within 24 hours       |
| Time to task (high confidence)| <2 hours from meeting end to Jira task created             |
| Time to task (interview)      | <24 hours from meeting end to Jira task created            |
| Dismissal rate                | <20% of queued interviews dismissed as false positives     |
| User satisfaction             | Team rates task quality >=4/5 after first month            |
| Provider uptime               | >=99% of transcripts successfully ingested per provider    |

---

## 14. Risks & Mitigations

| Risk                     | Impact | Mitigation                                                                                                              |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Transcript quality**   | High   | Claude prompt handles speaker misattribution and filler. Manual upload fallback. Source quotes let interviewers verify context. |
| **Over-extraction**      | Medium | Confidence scoring + interview queue catches false positives. Dismiss flow prevents garbage tasks. Dismissal data feeds prompt improvement. |
| **Interview fatigue**    | Medium | Keep interviews short (<2 min). Show clear value. Auto-expire stale items (configurable, default 72h). Slack notifications reduce friction. Queue prioritizes meetings you attended. |
| **Duplicate tasks**      | Medium | String similarity check before creation. Potential duplicates flagged for human review, not silently skipped. Phase 2+ adds embedding-based semantic matching. |
| **Privacy**              | High   | Supabase RLS. Transcript text not stored long-term. Access restricted to workspace members. Review Claude API data handling agreement. |
| **Provider API changes** | Medium | Provider abstraction isolates changes. Each adapter is independent. Manual upload always available as fallback. |
| **Rate limits / burst**  | Low    | BullMQ concurrency limits. Jira rate limit header respect. Queue absorbs bursts without dropping work. |
| **Jira downtime**        | Low    | Retry with backoff. Failed tasks surface in dashboard for manual retry. No data lost. |
| **Auth complexity**      | Medium | Each provider has different auth. Document setup per provider. Admin UI shows provider connection status. |

---

## 15. Decisions Made (from Open Questions)

| Question | Decision |
| -------- | -------- |
| Support non-Google Meet transcripts? | **Yes.** Provider abstraction from day one. Google Meet in Phase 1, Zoom + Teams in Phase 3. Manual upload available immediately. |
| Feed interview responses back to improve extraction? | **Phase 4.** Track dismissal reasons and interview corrections. Use as prompt improvement data. Full fine-tuning loop is a future consideration. |
| Interview expiration policy? | **Configurable, default 72 hours.** Stored in `pipeline_config`. |
| Slack notifications? | **Yes, Phase 2.** Primary notification channel for new interviews, claim expiry warnings, and pipeline alerts. |
| Manager approval before Jira creation? | **No for Phase 1–2.** The interview itself is the quality gate. Revisit if auto-creation accuracy is below 80%. Configurable as a future option. |
| Retroactively process historical transcripts? | **Not in initial release.** Manual upload covers the immediate need. Backfill tooling is a Phase 4+ consideration. |

---

## 16. Out of Scope (Explicit)

- Real-time transcription during meetings (we process after the meeting ends)
- Meeting recording/video processing (transcripts only)
- Non-Jira task management integrations (Linear, Asana, etc.) — future consideration
- Mobile app (web UI is responsive, no native app)
- Custom Claude fine-tuning (prompt engineering only for now)
- Cross-organization transcript sharing
