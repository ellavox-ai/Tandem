import { vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    role: "admin",
  }),
  requireAdmin: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    role: "admin",
  }),
  getAuthUser: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    role: "admin",
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

process.env.WEBHOOK_SECRET = "test-webhook-secret";
process.env.JIRA_BASE_URL = "https://test.atlassian.net";
process.env.JIRA_EMAIL = "test@example.com";
process.env.JIRA_API_TOKEN = "test-api-token";
process.env.JIRA_DEFAULT_PROJECT = "TEST";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_KEY = "test-service-key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.OPENAI_API_KEY = "test-openai-key";
