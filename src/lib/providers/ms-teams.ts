import type { NormalizedTranscript } from "@/lib/types";
import type { TranscriptProviderAdapter, ProviderConfig } from "./base";
import { registerProvider } from "./base";
import { parseVTT } from "./zoom"; // Reuse VTT parser — Teams also uses VTT
import { logger } from "@/lib/logger";

/**
 * Microsoft Teams transcript provider.
 *
 * Trigger: Microsoft Graph change notifications (callRecords → poll transcripts)
 * Format: WebVTT (.vtt) via Graph API
 * Auth: Application permissions + access policy
 */
export class MSTeamsProvider implements TranscriptProviderAdapter {
  readonly name = "ms-teams";
  private config: ProviderConfig = {};

  async initialize(config: ProviderConfig) {
    this.config = config;
    logger.info({ provider: this.name }, "MS Teams provider initialized");
  }

  async startListening() {
    // In production: create Graph change notification subscription for callRecords
    // Subscriptions expire (max ~4230 min) and must be renewed
    logger.info({ provider: this.name }, "Ready to receive Graph notifications");
  }

  async stopListening() {
    logger.info({ provider: this.name }, "Stopped listening");
  }

  validateWebhook(headers: Record<string, string>, body: unknown): boolean {
    // Graph sends a validation request with validationToken query param
    // For regular notifications: verify the clientState matches our configured value
    const payload = body as { validationToken?: string; value?: unknown[] };

    // Validation handshake
    if (payload?.validationToken) {
      return true; // Handled in parseWebhook
    }

    // TODO: Verify notification signature
    return true;
  }

  parseWebhook(body: unknown): { externalId: string; metadata?: Record<string, unknown> } | null {
    const payload = body as {
      validationToken?: string;
      value?: Array<{
        resourceData?: {
          id?: string;
          "@odata.type"?: string;
        };
        resource?: string;
        changeType?: string;
      }>;
    };

    if (!payload?.value?.length) return null;

    // We subscribe to callRecords, then poll for transcripts
    const notification = payload.value[0];
    const callRecordId = notification?.resourceData?.id;

    if (!callRecordId) return null;

    return {
      externalId: callRecordId,
      metadata: {
        resource: notification.resource,
        changeType: notification.changeType,
      },
    };
  }

  async fetchTranscript(externalId: string): Promise<NormalizedTranscript> {
    // TODO: Implement actual Graph API calls
    // 1. Get app-only OAuth token (client credentials flow)
    // 2. Fetch call record: GET /communications/callRecords/{id}
    // 3. Resolve online meeting from call record
    // 4. List transcripts: GET /users/{id}/onlineMeetings/{id}/transcripts
    // 5. Fetch transcript content: GET .../transcripts/{id}/content?$format=text/vtt
    // 6. Parse VTT (reuse parseVTT from zoom provider)
    // 7. Resolve participants from call record

    logger.info({ externalId }, "Fetching MS Teams transcript");

    throw new Error(
      `MS Teams fetchTranscript not yet implemented for: ${externalId}. ` +
        "Requires Azure AD app registration, admin consent, and application access policy."
    );
  }
}

// Self-register
registerProvider(new MSTeamsProvider());
