import { describe, it, expect, beforeEach } from "vitest";
import { registerProvider, getProvider, getAllProviders } from "../base";
import type { TranscriptProviderAdapter } from "../base";
import type { NormalizedTranscript } from "@/lib/types";

function makeFakeProvider(name: string): TranscriptProviderAdapter {
  return {
    name,
    initialize: async () => {},
    startListening: async () => {},
    stopListening: async () => {},
    validateWebhook: () => true,
    parseWebhook: () => null,
    fetchTranscript: async (): Promise<NormalizedTranscript> => {
      throw new Error("not implemented");
    },
  };
}

describe("Provider Registry", () => {
  it("registers a provider and retrieves it by name", () => {
    const provider = makeFakeProvider("test-registry");
    registerProvider(provider);
    expect(getProvider("test-registry")).toBe(provider);
  });

  it("returns undefined for unknown provider", () => {
    expect(getProvider("nonexistent-provider")).toBeUndefined();
  });

  it("getAllProviders includes registered providers", () => {
    const p1 = makeFakeProvider("reg-a");
    const p2 = makeFakeProvider("reg-b");
    registerProvider(p1);
    registerProvider(p2);

    const all = getAllProviders();
    expect(all).toContain(p1);
    expect(all).toContain(p2);
  });

  it("overwrites provider when re-registered with same name", () => {
    const original = makeFakeProvider("overwrite-test");
    const replacement = makeFakeProvider("overwrite-test");
    registerProvider(original);
    registerProvider(replacement);
    expect(getProvider("overwrite-test")).toBe(replacement);
  });
});
