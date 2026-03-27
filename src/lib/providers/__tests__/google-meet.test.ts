import { describe, it, expect, beforeEach } from "vitest";
import { GoogleMeetProvider } from "../google-meet";

describe("GoogleMeetProvider", () => {
  let provider: GoogleMeetProvider;

  beforeEach(() => {
    provider = new GoogleMeetProvider();
  });

  describe("validateWebhook", () => {
    it("always returns true", () => {
      expect(provider.validateWebhook({}, {})).toBe(true);
    });
  });

  describe("parseWebhook", () => {
    it("handles inline Gemini Notes transcript", () => {
      const body = {
        transcript: "📖 Transcript\n00:00:00\nSean: Hello everyone",
        filename: "Sprint Review - 2026/03/26 09:29 CDT - Notes by Gemini",
      };

      const result = provider.parseWebhook(body);
      expect(result).not.toBeNull();
      expect(result!.externalId).toMatch(/^gmeet-/);
      expect(result!.metadata).toEqual({
        format: "gemini-notes",
        filename: body.filename,
      });
    });

    it("handles base64 Pub/Sub message", () => {
      const decoded = {
        transcript: { name: "transcripts/abc123" },
        conferenceRecord: "conferences/xyz",
      };
      const base64Data = Buffer.from(JSON.stringify(decoded)).toString("base64");

      const body = {
        message: {
          data: base64Data,
          attributes: { "ce-type": "google.workspace.meet.transcript.v2.published" },
        },
      };

      const result = provider.parseWebhook(body);
      expect(result).toEqual({
        externalId: "transcripts/abc123",
        metadata: {
          format: "pubsub",
          conferenceRecord: "conferences/xyz",
          eventType: "google.workspace.meet.transcript.v2.published",
        },
      });
    });

    it("returns null for malformed base64", () => {
      const body = {
        message: { data: "not-valid-base64!!!" },
      };
      expect(provider.parseWebhook(body)).toBeNull();
    });

    it("returns null for Pub/Sub message without transcript name", () => {
      const decoded = { someOtherField: "value" };
      const base64Data = Buffer.from(JSON.stringify(decoded)).toString("base64");

      const body = { message: { data: base64Data } };
      expect(provider.parseWebhook(body)).toBeNull();
    });

    it("returns null for empty body", () => {
      expect(provider.parseWebhook({})).toBeNull();
    });

    it("returns null for null body", () => {
      expect(provider.parseWebhook(null)).toBeNull();
    });
  });

  describe("fetchTranscript", () => {
    it("parses a pending Gemini Notes transcript", async () => {
      const raw = `Invited eric@example.com Sean Alsup

📖 Transcript
00:00:05
Sean Alsup: Let's review the sprint goals
00:00:15
Eric: Sounds good, I'll share my screen`;

      provider.parseWebhook({
        transcript: raw,
        filename: "Sprint Review - 2026/03/26 09:29 CDT - Notes by Gemini",
      });

      const parsed = provider.parseWebhook({
        transcript: raw,
        filename: "Sprint Review - 2026/03/26 09:29 CDT - Notes by Gemini",
      });

      const result = await provider.fetchTranscript(parsed!.externalId);

      expect(result.provider).toBe("google-meet");
      expect(result.meetingTitle).toBe("Sprint Review");
      expect(result.utterances.length).toBeGreaterThanOrEqual(2);
      expect(result.attendees.length).toBeGreaterThanOrEqual(1);
    });

    it("throws for unknown externalId", async () => {
      await expect(
        provider.fetchTranscript("unknown-id")
      ).rejects.toThrow("not yet implemented");
    });
  });
});
