// ─── Transcript Provider Types ───────────────────────────────────────────────

export type TranscriptProvider = "google-meet" | "zoom" | "ms-teams" | "manual" | "n8n";

export type TranscriptStatus = "pending" | "processing" | "completed" | "failed";

export interface Attendee {
  name: string;
  email?: string;
  providerId?: string;
}

export interface Utterance {
  speaker: string;
  speakerEmail?: string;
  text: string;
  startTime: number; // seconds from meeting start
  endTime: number;
}

export interface NormalizedTranscript {
  provider: TranscriptProvider;
  externalId: string;
  meetingTitle: string;
  meetingDate: Date;
  duration: number; // seconds
  attendees: Attendee[];
  utterances: Utterance[];
  rawFormat: "json" | "vtt" | "text";
  metadata: Record<string, unknown>;
}

// ─── Task Extraction Types ──────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";
export type Priority = "P0" | "P1" | "P2" | "P3";

export type TaskStatus =
  | "pending_interview"
  | "claimed"
  | "completed"
  | "dismissed"
  | "auto_created"
  | "expired"
  | "jira_failed";

export interface ExtractedTask {
  title: string;
  description: string;
  inferredAssignees: { name: string; email?: string }[];
  confidence: Confidence;
  missingContext: string[];
  sourceQuotes: { text: string; timestamp: number }[];
  priority: Priority;
  labels: string[];
}

// ─── Database Row Types ─────────────────────────────────────────────────────

export interface TranscriptRow {
  id: string;
  provider: TranscriptProvider;
  external_id: string;
  meeting_title: string;
  meeting_date: string;
  duration: number;
  attendees: Attendee[];
  utterance_count: number;
  status: TranscriptStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedTaskRow {
  id: string;
  transcript_id: string;
  extracted_title: string;
  extracted_description: string;
  inferred_assignees: { name: string; email?: string }[];
  confidence: Confidence;
  missing_context: string[];
  source_quotes: { text: string; timestamp: number }[];
  priority: Priority;
  labels: string[];
  status: TaskStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  dismissed_reason: string | null;
  interview_responses: Record<string, string> | null;
  jira_project: string | null;
  jira_issue_key: string | null;
  jira_error: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional, from queries)
  transcript?: TranscriptRow;
}

export interface TaskStatusHistoryRow {
  id: string;
  task_id: string;
  old_status: string;
  new_status: string;
  changed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  google_id: string | null;
  jira_account_id: string | null;
  slack_user_id: string | null;
  role: "admin" | "member";
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PipelineConfigRow {
  id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  tasks: ExtractedTask[];
  transcriptId: string;
  processingTimeMs: number;
}

export interface JiraCreateResult {
  issueKey: string;
  issueUrl: string;
}

export interface InterviewSubmission {
  responses: Record<string, string>;
  assignee?: string;
  priority?: Priority;
  labels?: string[];
}

// ─── Config Keys ────────────────────────────────────────────────────────────

export const CONFIG_KEYS = {
  CONFIDENCE_AUTO_CREATE_THRESHOLD: "confidence_auto_create_threshold",
  INTERVIEW_EXPIRY_HOURS: "interview_expiry_hours",
  CLAIM_TIMEOUT_MINUTES: "claim_timeout_minutes",
  JIRA_DEFAULT_PROJECT: "jira_default_project",
  ACTIVE_PROVIDERS: "active_providers",
  NOTIFICATION_CHANNELS: "notification_channels",
  DUPLICATE_SIMILARITY_THRESHOLD: "duplicate_similarity_threshold",
  JIRA_PROJECT_ROUTES: "jira_project_routes",
} as const;
