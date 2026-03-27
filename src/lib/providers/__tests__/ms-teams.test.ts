import { describe, it, expect } from "vitest";
import { MSTeamsProvider } from "../ms-teams";

describe("MSTeamsProvider", () => {
  const provider = new MSTeamsProvider();

  describe("validateWebhook", () => {
    it("returns true for validationToken handshake", () => {
      const result = provider.validateWebhook(
        {},
        { validationToken: "abc123" }
      );
      expect(result).toBe(true);
    });

    it("returns true for regular notifications", () => {
      const result = provider.validateWebhook(
        {},
        { value: [{ resourceData: { id: "call-1" } }] }
      );
      expect(result).toBe(true);
    });
  });

  describe("parseWebhook", () => {
    it("parses a valid Graph notification with resourceData.id", () => {
      const body = {
        value: [
          {
            resourceData: {
              id: "call-record-123",
              "@odata.type": "#microsoft.graph.callRecord",
            },
            resource: "communications/callRecords/call-record-123",
            changeType: "created",
          },
        ],
      };

      const result = provider.parseWebhook(body);
      expect(result).toEqual({
        externalId: "call-record-123",
        metadata: {
          resource: "communications/callRecords/call-record-123",
          changeType: "created",
        },
      });
    });

    it("returns null for empty value array", () => {
      expect(provider.parseWebhook({ value: [] })).toBeNull();
    });

    it("returns null for missing value field", () => {
      expect(provider.parseWebhook({})).toBeNull();
    });

    it("returns null when resourceData has no id", () => {
      const body = {
        value: [{ resourceData: {}, resource: "some/resource" }],
      };
      expect(provider.parseWebhook(body)).toBeNull();
    });

    it("returns null for undefined body", () => {
      expect(provider.parseWebhook(undefined)).toBeNull();
    });
  });

  describe("fetchTranscript", () => {
    it("throws not-implemented error", async () => {
      await expect(
        provider.fetchTranscript("call-123")
      ).rejects.toThrow("not yet implemented");
    });
  });
});
