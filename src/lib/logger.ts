import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino/file",
      options: { destination: 1 }, // stdout
    },
  }),
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
