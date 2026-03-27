import type { NormalizedTranscript } from "@/lib/types";

export interface ProviderConfig {
  [key: string]: unknown;
}

export interface TranscriptProviderAdapter {
  /** Provider identifier */
  readonly name: string;

  /** Initialize the provider with configuration */
  initialize(config: ProviderConfig): Promise<void>;

  /** Start listening for new transcripts (webhooks, polling, etc.) */
  startListening(): Promise<void>;

  /** Stop listening */
  stopListening(): Promise<void>;

  /** Validate an incoming webhook payload. Returns true if authentic. */
  validateWebhook(headers: Record<string, string>, body: unknown): boolean;

  /** Parse a webhook payload into a reference ID for fetching the full transcript */
  parseWebhook(body: unknown): { externalId: string; metadata?: Record<string, unknown> } | null;

  /** Fetch and normalize a transcript by its external reference */
  fetchTranscript(
    externalId: string,
    metadata?: Record<string, unknown>
  ): Promise<NormalizedTranscript>;
}

/** Registry of all available providers */
const providers = new Map<string, TranscriptProviderAdapter>();

export function registerProvider(provider: TranscriptProviderAdapter) {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): TranscriptProviderAdapter | undefined {
  return providers.get(name);
}

export function getAllProviders(): TranscriptProviderAdapter[] {
  return Array.from(providers.values());
}
