import type { NormalizedTranscript, Utterance, Attendee } from "@/lib/types";
import type { TranscriptProviderAdapter, ProviderConfig } from "./base";
import { registerProvider } from "./base";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Google Meet transcript provider.
 *
 * Accepts two payload formats:
 * 1. Gemini Notes direct post: { transcript: string, filename: string }
 * 2. Pub/Sub push message (future): { message: { data: base64, ... } }
 */
export class GoogleMeetProvider implements TranscriptProviderAdapter {
  readonly name = "google-meet";
  private config: ProviderConfig = {};
  private pendingTranscripts = new Map<string, { raw: string; filename: string }>();

  async initialize(config: ProviderConfig) {
    this.config = config;
    logger.info({ provider: this.name }, "Google Meet provider initialized");
  }

  async startListening() {
    logger.info({ provider: this.name }, "Listening for webhook messages");
  }

  async stopListening() {
    logger.info({ provider: this.name }, "Stopped listening");
  }

  validateWebhook(_headers: Record<string, string>, _body: unknown): boolean {
    return true;
  }

  parseWebhook(body: unknown): { externalId: string; metadata?: Record<string, unknown> } | null {
    const payload = body as {
      transcript?: string;
      filename?: string;
      message?: { data?: string; attributes?: Record<string, string> };
    };

    // Format 1: Direct Gemini Notes post — { transcript, filename }
    if (payload?.transcript && typeof payload.transcript === "string") {
      const externalId = `gmeet-${crypto.randomUUID()}`;
      this.pendingTranscripts.set(externalId, {
        raw: payload.transcript,
        filename: payload.filename || "Untitled Meeting",
      });

      return {
        externalId,
        metadata: { format: "gemini-notes", filename: payload.filename },
      };
    }

    // Format 2: Pub/Sub push message
    if (payload?.message?.data) {
      try {
        const decoded = JSON.parse(
          Buffer.from(payload.message.data, "base64").toString("utf-8")
        );
        const transcriptName = decoded?.transcript?.name;
        if (!transcriptName) {
          logger.warn({ decoded }, "No transcript name in Pub/Sub message");
          return null;
        }
        return {
          externalId: transcriptName,
          metadata: {
            format: "pubsub",
            conferenceRecord: decoded.conferenceRecord,
            eventType: payload.message.attributes?.["ce-type"],
          },
        };
      } catch (err) {
        logger.error({ err }, "Failed to parse Pub/Sub message");
        return null;
      }
    }

    return null;
  }

  async fetchTranscript(externalId: string): Promise<NormalizedTranscript> {
    const pending = this.pendingTranscripts.get(externalId);
    if (pending) {
      this.pendingTranscripts.delete(externalId);
      return parseGeminiNotes(externalId, pending.raw, pending.filename);
    }

    throw new Error(
      `Google Meet fetchTranscript not yet implemented for: ${externalId}. ` +
        "Requires OAuth setup and Google Workspace API integration."
    );
  }
}

/**
 * Parse a Gemini Notes transcript into a NormalizedTranscript.
 *
 * Expected filename format: "Title - YYYY/MM/DD HH:MM TZ - Notes by Gemini"
 * Transcript text contains a "📖 Transcript" section with speaker-attributed lines.
 */
function parseGeminiNotes(
  externalId: string,
  raw: string,
  filename: string
): NormalizedTranscript {
  const { title, date } = parseFilename(filename);
  const attendees = parseAttendees(raw);
  const utterances = parseTranscriptSection(raw);

  resolveSpeakersToAttendees(utterances, attendees);

  const summary = parseSummaryAndDetails(raw);

  const duration =
    utterances.length > 0
      ? utterances[utterances.length - 1].endTime
      : 0;

  return {
    provider: "google-meet",
    externalId,
    meetingTitle: title,
    meetingDate: date,
    duration,
    attendees,
    utterances,
    rawFormat: "text",
    metadata: { source: "gemini-notes", filename, ...(summary ? { summary } : {}) },
  };
}

/**
 * Cross-reference speaker display names from utterances with attendee
 * entries that have emails, and populate speakerEmail on matches.
 */
function resolveSpeakersToAttendees(
  utterances: Utterance[],
  attendees: Attendee[]
): void {
  const emailByName = new Map<string, string>();
  for (const a of attendees) {
    if (a.email) {
      emailByName.set(a.name.toLowerCase(), a.email);
    }
  }
  if (emailByName.size === 0) return;

  for (const utterance of utterances) {
    const email = emailByName.get(utterance.speaker.toLowerCase());
    if (email) {
      utterance.speakerEmail = email;
    }
  }
}

/**
 * Extract Summary and Details sections from Gemini Notes.
 * These contain rich context with clear speaker attribution that
 * the raw transcript lines may lack.
 */
function parseSummaryAndDetails(raw: string): string | null {
  const summaryMatch = raw.match(/\nSummary\n([\s\S]*?)(?=\nDetails\n|\n📖 Transcript|\n📝)/);
  const detailsMatch = raw.match(/\nDetails\n([\s\S]*?)(?=\n📖 Transcript|\n📝)/);

  const parts: string[] = [];
  if (summaryMatch?.[1]?.trim()) parts.push(`Summary:\n${summaryMatch[1].trim()}`);
  if (detailsMatch?.[1]?.trim()) parts.push(`Details:\n${detailsMatch[1].trim()}`);

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function parseFilename(filename: string): { title: string; date: Date } {
  // "Flexpay Walk Through - 2026/03/26 09:29 CDT - Notes by Gemini"
  const match = filename.match(
    /^(.+?)\s*-\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\s*(\w+)?\s*-/
  );

  if (match) {
    const title = match[1].trim();
    const dateStr = match[2].replace(/\//g, "-");
    const tz = match[3] || "";
    const date = new Date(`${dateStr} ${tz}`);
    return { title, date: isNaN(date.getTime()) ? new Date() : date };
  }

  return { title: filename, date: new Date() };
}

function parseAttendees(raw: string): Attendee[] {
  // "Invited eric@landandapartments.com Sean Alsup"
  const invitedMatch = raw.match(/Invited\s+(.+?)(?:\r?\n)/);
  if (!invitedMatch) return [];

  const tokens = invitedMatch[1].trim().split(/\s+/);
  const attendees: Attendee[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i].includes("@")) {
      attendees.push({ name: tokens[i], email: tokens[i] });
      i++;
    } else {
      // Collect consecutive non-email tokens as a full name
      const nameParts: string[] = [];
      while (i < tokens.length && !tokens[i].includes("@")) {
        nameParts.push(tokens[i]);
        i++;
      }
      if (nameParts.length > 0) {
        attendees.push({ name: nameParts.join(" ") });
      }
    }
  }

  return attendees;
}

function parseTranscriptSection(raw: string): Utterance[] {
  const transcriptStart = raw.indexOf("📖 Transcript");
  if (transcriptStart === -1) return [];

  const transcriptText = raw.slice(transcriptStart);
  const lines = transcriptText.split(/\r?\n/);

  const utterances: Utterance[] = [];
  let currentTimestamp = 0;
  const timestampRegex = /^(\d{2}):(\d{2}):(\d{2})$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tsMatch = trimmed.match(timestampRegex);
    if (tsMatch) {
      currentTimestamp =
        parseInt(tsMatch[1], 10) * 3600 +
        parseInt(tsMatch[2], 10) * 60 +
        parseInt(tsMatch[3], 10);
      continue;
    }

    // "Speaker Name: text they said"
    const speakerMatch = trimmed.match(/^([^:]+):\s+(.+)$/);
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();

      // Skip Gemini meta-lines
      if (
        speaker.startsWith("📖") ||
        speaker.startsWith("📝") ||
        trimmed.includes("Transcript") && !text
      ) {
        continue;
      }

      utterances.push({
        speaker,
        text,
        startTime: currentTimestamp,
        endTime: currentTimestamp,
      });
    }
  }

  // Back-fill endTime: each utterance ends when the next one starts
  for (let i = 0; i < utterances.length - 1; i++) {
    utterances[i].endTime = utterances[i + 1].startTime;
  }

  return utterances;
}

// Self-register
registerProvider(new GoogleMeetProvider());
