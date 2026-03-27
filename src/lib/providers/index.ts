// Import all providers to trigger self-registration
import "./google-meet";
import "./zoom";
import "./ms-teams";
import "./manual";
import "./n8n";

// Re-export registry functions
export { getProvider, getAllProviders, registerProvider } from "./base";
export type { TranscriptProviderAdapter, ProviderConfig } from "./base";
