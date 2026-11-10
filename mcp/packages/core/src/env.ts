/** Environment variables, e.g. `process.env` on Node or a Worker's `env`. */
export type Env = Record<string, string | undefined>;

/** `process.env` where it exists (Node, Workers with nodejs_compat), else empty. */
export function processEnv(): Env {
  return (globalThis as { process?: { env: Env } }).process?.env ?? {};
}
