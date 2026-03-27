import { describe, it, expect, beforeEach } from "vitest";
import { N8nProvider } from "../n8n";
import fs from "fs";
import path from "path";

describe("N8nProvider", () => {
  let provider: N8nProvider;

  beforeEach(() => {
    provider = new N8nProvider();
  });

  describe("validateWebhook", () => {
    it("always returns true", () => {
      expect(provider.validateWebhook()).toBe(true);
    });
  });

  describe("parseWebhook", () => {
    it("accepts payload with fileContent and returns externalId", () => {
      const body = {
        fileContent: "Sean: Hello\nAlex: Hi",
        fileName: "meeting.txt",
        fileId: "drive-file-123",
      };

      const result = provider.parseWebhook(body);
      expect(result).not.toBeNull();
      expect(result!.externalId).toBe("drive-file-123");
      expect(result!.metadata).toMatchObject({
        fileContent: "Sean: Hello\nAlex: Hi",
        fileName: "meeting.txt",
        fileId: "drive-file-123",
      });
    });

    it("generates UUID-based externalId when no fileId", () => {
      const body = { fileContent: "Some content" };
      const result = provider.parseWebhook(body);
      expect(result).not.toBeNull();
      expect(result!.externalId).toMatch(/^n8n-/);
    });

    it("returns null when fileContent is missing", () => {
      expect(provider.parseWebhook({ fileName: "test.vtt" })).toBeNull();
    });

    it("returns null for empty object", () => {
      expect(provider.parseWebhook({})).toBeNull();
    });
  });

  describe("fetchTranscript", () => {
    it("parses VTT content via file extension", async () => {
      const vttContent = fs.readFileSync(
        path.join(process.cwd(), "test/fixtures/sample.vtt"),
        "utf-8"
      );

      const parsed = provider.parseWebhook({
        fileContent: vttContent,
        fileName: "meeting.vtt",
        fileId: "vtt-test",
        meetingTitle: "VTT Meeting",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.provider).toBe("n8n");
      expect(result.meetingTitle).toBe("VTT Meeting");
      expect(result.utterances.length).toBe(4);
      expect(result.rawFormat).toBe("vtt");
    });

    it("parses SRT content via file extension", async () => {
      const srtContent = fs.readFileSync(
        path.join(process.cwd(), "test/fixtures/sample.srt"),
        "utf-8"
      );

      const parsed = provider.parseWebhook({
        fileContent: srtContent,
        fileName: "meeting.srt",
        fileId: "srt-test",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.utterances.length).toBe(4);
      expect(result.utterances[0].speaker).toBe("Sean");
    });

    it("parses plain text content", async () => {
      const parsed = provider.parseWebhook({
        fileContent: "Sean: Hello\nAlex: Hi there",
        fileName: "notes.txt",
        fileId: "txt-test",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.utterances.length).toBe(2);
      expect(result.utterances[0].speaker).toBe("Sean");
      expect(result.utterances[1].speaker).toBe("Alex");
    });

    it("defaults to plain text when no extension", async () => {
      const parsed = provider.parseWebhook({
        fileContent: "Speaker: Content here",
        fileId: "no-ext-test",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.utterances.length).toBe(1);
    });

    it("throws for unknown externalId without metadata", async () => {
      await expect(
        provider.fetchTranscript("nonexistent")
      ).rejects.toThrow("No n8n payload");
    });

    it("uses meetingTitle from payload, falls back to fileName", async () => {
      const parsed = provider.parseWebhook({
        fileContent: "Sean: test",
        fileName: "Sprint Planning.txt",
        fileId: "title-test",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.meetingTitle).toBe("Sprint Planning");
    });

    it("extracts attendees from comma-separated string", async () => {
      const parsed = provider.parseWebhook({
        fileContent: "Sean: test",
        fileId: "attendees-test",
        attendees: "Alice, Bob, Carol",
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.attendees).toEqual([
        { name: "Alice" },
        { name: "Bob" },
        { name: "Carol" },
      ]);
    });

    it("extracts attendees from JSON array", async () => {
      const parsed = provider.parseWebhook({
        fileContent: "Sean: test",
        fileId: "attendees-json-test",
        attendees: [
          { name: "Alice", email: "alice@example.com" },
          { name: "Bob" },
        ],
      });

      const result = await provider.fetchTranscript(parsed!.externalId, parsed!.metadata);
      expect(result.attendees).toEqual([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob" },
      ]);
    });
  });
});
