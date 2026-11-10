/** Pino-compatible level numbers; "silent" disables logging. */
const LEVELS = {
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  silent: Number.POSITIVE_INFINITY,
} as const;

type LogFn = (obj: object, msg: string) => void;

const configured = process.env.LOG_LEVEL ?? "info";
const threshold = Object.hasOwn(LEVELS, configured)
  ? LEVELS[configured as keyof typeof LEVELS]
  : LEVELS.info;

// JSON lines on stderr: stdout carries the stdio MCP protocol.
const log =
  (level: Exclude<keyof typeof LEVELS, "silent">): LogFn =>
  (obj, msg) => {
    if (LEVELS[level] < threshold) return;
    console.error(
      JSON.stringify({
        level: LEVELS[level],
        time: Date.now(),
        name: "index-now-mcp",
        ...obj,
        msg,
      }),
    );
  };

export const logger = {
  error: log("error"),
  warn: log("warn"),
  info: log("info"),
  debug: log("debug"),
};
