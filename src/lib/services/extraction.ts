/**
 * Task extraction service — delegates to the extraction agent.
 *
 * This module re-exports from the new agent architecture for backward
 * compatibility. All callers (processors.ts, etc.) continue to work unchanged.
 */
export { extractTasks, storeAndRouteExtractedTasks } from "@/lib/agents/extraction-agent";
