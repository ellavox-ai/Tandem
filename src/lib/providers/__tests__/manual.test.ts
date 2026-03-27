import { describe, it, expect } from "vitest";
import { ManualProvider } from "../manual";
import fs from "fs";
import path from "path";

describe("ManualProvider", () => {
  const provider = new ManualProvider();
  const baseMeta = {
    meetingTitle: "Test Meeting",
    meetingDate: new Date("2026-03-26T10:00:00Z"),
  };

  describe("validateWebhook / parseWebhook", () => {
    it("validateWebhook returns false", () => {
      expect(provider.validateWebhook()).toBe(false);
    });

    it("parseWebhook returns null", () => {
      expect(provider.parseWebhook()).toBeNull();
    });
  });

  describe("fetchTranscript", () => {
    it("throws directing to parseUpload", async () => {
      await expect(provider.fetchTranscript("any")).rejects.toThrow(
        "Use parseUpload instead"
      );
    });
  });

  describe("parseUpload", () => {
    it("parses VTT format", () => {
      const vtt = fs.readFileSync(
        path.join(process.cwd(), "test/fixtures/sample.vtt"),
        "utf-8"
      );
      const result = provider.parseUpload(vtt, "vtt", baseMeta);

      expect(result.provider).toBe("manual");
      expect(result.externalId).toMatch(/^manual-/);
      expect(result.meetingTitle).toBe("Test Meeting");
      expect(result.utterances.length).toBe(4);
      expect(result.rawFormat).toBe("vtt");
    });

    it("parses SRT format", () => {
      const srt = fs.readFileSync(
        path.join(process.cwd(), "test/fixtures/sample.srt"),
        "utf-8"
      );
      const result = provider.parseUpload(srt, "srt", baseMeta);

      expect(result.utterances.length).toBe(4);
      expect(result.utterances[0].speaker).toBe("Sean");
      expect(result.utterances[1].speaker).toBe("Alex");
    });

    it("parses plain text format", () => {
      const txt = "Sean: Let's start\nAlex: Sounds good\nJordan: Ready";
      const result = provider.parseUpload(txt, "txt", baseMeta);

      expect(result.utterances.length).toBe(3);
      expect(result.utterances[0].speaker).toBe("Sean");
      expect(result.utterances[2].speaker).toBe("Jordan");
    });

    it("throws for unsupported format", () => {
      expect(() =>
        provider.parseUpload("content", "mp3" as "vtt", baseMeta)
      ).toThrow("Unsupported format");
    });

    it("includes attendees from metadata when provided", () => {
      const result = provider.parseUpload("Sean: test", "txt", {
        ...baseMeta,
        attendees: [
          { name: "Alice", email: "alice@example.com" },
          { name: "Bob" },
        ],
      });
      expect(result.attendees).toEqual([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob" },
      ]);
    });

    it("extracts speakers when no attendees provided", () => {
      const result = provider.parseUpload(
        "Sean: Hello\nAlex: World",
        "txt",
        baseMeta
      );
      expect(result.attendees).toEqual([
        { name: "Sean" },
        { name: "Alex" },
      ]);
    });

    it("uses provided duration", () => {
      const result = provider.parseUpload("Sean: test", "txt", {
        ...baseMeta,
        duration: 3600,
      });
      expect(result.duration).toBe(3600);
    });

    it("estimates duration from utterances when not provided", () => {
      const result = provider.parseUpload(
        "A: line1\nB: line2\nC: line3",
        "txt",
        baseMeta
      );
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
