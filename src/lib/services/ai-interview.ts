/**
 * AI interview service — delegates to the interview agent.
 *
 * This module re-exports from the new agent architecture for backward
 * compatibility. All callers (API routes, etc.) continue to work unchanged.
 */
export {
  startAIInterview,
  continueAIInterview,
  applyInterviewCompletion,
  type InterviewMessage,
} from "@/lib/agents/interview-agent";

export type { InterviewCompletion as InterviewCompletionData } from "@/lib/agents/schemas";
