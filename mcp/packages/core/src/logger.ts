import { type Env, processEnv } from "./env.ts";

/** Pino-compatible level numbers; "silent" disables logging. */
const LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: Number.POSITIVE_INFINITY,
} as const;

export type LogLevel = keyof typeof LEVELS;

type LogFn = (objOrMsg: object | string, msg?: string) => void;

export interface Logger {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
}

export interface LoggerOptions {
  /** @default env.LOG_LEVEL ?? "info" */
  level?: LogLevel;
  /** @default process.env */
  env?: Env;
}

/** Key names redacted at any depth, compared case-insensitively. */
const REDACTED_KEYS = new Set(
  [
    "token",
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "id_token",
    "idToken",
    "client_secret",
    "clientSecret",
    "secret",
    "privateKey",
    "private_key",
    "p8",
    "pem",
    "ciphertext",
    "authorization",
    "cookie",
    "set-cookie",
    "authInfo",
  ].map((key) => key.toLowerCase()),
);

function redact(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[Circular]";
  // Only the name, message and stack: enumerable fields (e.g. a request config) may hold secrets.
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  // Date, URL and the like serialise themselves; walk every other object's own fields.
  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(item, seen),
    ]),
  );
}

/** Structured JSON logger on `console` that redacts tokens, secrets, cookies and Authorization headers. */
export function createLogger(
  name: string,
  { env = processEnv(), level }: LoggerOptions = {},
): Logger {
  const configured = level ?? env.LOG_LEVEL ?? "info";
  const threshold = Object.hasOwn(LEVELS, configured)
    ? LEVELS[configured as LogLevel]
    : LEVELS.info;

  const log =
    (levelName: Exclude<LogLevel, "silent">): LogFn =>
    (objOrMsg, msg) => {
      const value = LEVELS[levelName];
      if (value < threshold) return;
      const obj = objOrMsg instanceof Error ? { err: objOrMsg } : objOrMsg;
      const fields =
        typeof obj === "string"
          ? { msg: obj }
          : { ...(redact(obj, new WeakSet()) as object), msg };
      console.log(
        JSON.stringify({ level: value, time: Date.now(), name, ...fields }),
      );
    };

  return {
    error: log("error"),
    warn: log("warn"),
    info: log("info"),
    debug: log("debug"),
  };
}
