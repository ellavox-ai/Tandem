import { z } from "zod";

export const assigneeSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

export const sourceQuoteSchema = z.object({
  text: z.string(),
  timestamp: z.number(),
});

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const prioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

// ─── Extraction Agent Output ────────────────────────────────────────────────

export const extractedTaskSchema = z.object({
  title: z.string().describe("Concise, actionable title in imperative mood"),
  description: z
    .string()
    .describe("Full context from the discussion — what, why, constraints"),
  inferredAssignees: z.array(assigneeSchema),
  confidence: confidenceSchema,
  missingContext: z
    .array(z.string())
    .describe("Specific questions that couldn't be answered from the transcript"),
  sourceQuotes: z.array(sourceQuoteSchema),
  priority: prioritySchema,
  labels: z.array(z.string()),
});

export const extractionOutputSchema = z.object({
  tasks: z.array(extractedTaskSchema),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

// ─── Interview Completion Output ────────────────────────────────────────────

export const interviewCompletionSchema = z.object({
  title: z.string().describe("Refined task title"),
  description: z.string().describe("Full task description with gathered context"),
  assignee: z.string().nullable().describe("Person name or null"),
  priority: prioritySchema,
  labels: z.array(z.string()),
  should_create: z.boolean().describe("Whether the task should be created in Jira"),
});

export type InterviewCompletion = z.infer<typeof interviewCompletionSchema>;

// ─── Requirements Agent Output ──────────────────────────────────────────────

export const requirementsOutputSchema = z.object({
  title: z.string().describe("Concise, actionable Jira issue summary"),
  issueType: z.enum(["Story", "Task", "Bug", "Spike"]),
  description: z
    .string()
    .describe("Rich description formatted for Jira with full context"),
  acceptanceCriteria: z
    .array(z.string())
    .describe("Testable acceptance criteria items"),
  technicalNotes: z
    .string()
    .optional()
    .describe("Implementation hints, architecture considerations"),
  storyPoints: z
    .enum(["1", "2", "3", "5", "8", "13"])
    .optional()
    .describe("Estimated complexity"),
  priority: prioritySchema,
  labels: z.array(z.string()),
  assignee: assigneeSchema.nullable(),
  blockedBy: z
    .array(z.string())
    .optional()
    .describe("Known dependencies or blockers"),
});

export type RequirementsOutput = z.infer<typeof requirementsOutputSchema>;

// ─── Routing Agent Output ───────────────────────────────────────────────────

export const routingOutputSchema = z.object({
  projectKey: z.string().describe("The Jira project key to route this task to"),
  reasoning: z.string().describe("Brief explanation of why this project was chosen"),
});

export type RoutingOutput = z.infer<typeof routingOutputSchema>;
