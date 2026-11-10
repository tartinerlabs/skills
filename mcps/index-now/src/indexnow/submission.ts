import { classifyError, IndexNowApiError } from "../utils/errors.ts";
import type { IndexNowClient, SubmitRequest } from "./client.ts";
import { checkKeyFile, keyFileUrl } from "./key.ts";

/** What a completed submission returns. */
export interface SubmissionOutput {
  host: string;
  submitted: number;
  status: number;
}

export interface SubmissionDeps extends IndexNowClient {
  /** Waits before the next attempt; `reason` is why the last one failed. */
  sleep(seconds: number, reason: string): Promise<void>;
}

const RETRIES = 6;
const RETRY_AFTER = /retry after (\d+)s/;
const MAX_DELAY_SECONDS = 3600;

/** IndexNow's Retry-After, carried in the error's message, else exponential from 30 seconds. */
export function submitRetryDelay(attempt: number, error: Error): number {
  const retryAfter = RETRY_AFTER.exec(error.message)?.[1];
  const seconds = retryAfter
    ? Number(retryAfter)
    : 30 * 2 ** Math.max(0, attempt - 1);
  return Math.min(seconds, MAX_DELAY_SECONDS);
}

/** Runs `callback`, retrying on throw up to RETRIES times with `delay(attempt, error)` seconds between. */
async function retry<T>(
  deps: SubmissionDeps,
  delay: (attempt: number, error: Error) => number,
  callback: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callback();
    } catch (error) {
      if (attempt > RETRIES) throw error;
      await deps.sleep(
        delay(attempt, error as Error),
        (error as Error).message,
      );
    }
  }
}

/**
 * Waits for the key file to be live, then POSTs to IndexNow. Failures that
 * can pass (the deploy still going live, outages) are retried; rate limits
 * and rejections end the submission with the classified error, since
 * retrying a throttled request only prolongs the throttle.
 */
export async function runSubmission(
  request: SubmitRequest,
  deps: SubmissionDeps,
): Promise<SubmissionOutput> {
  const { host, key, keyLocation, urlList } = request;
  const location = keyFileUrl(urlList[0] as string, key, keyLocation);

  // 15s, 30s, … 8 minutes: about 16 minutes for a deploy to go live.
  await retry(
    deps,
    (attempt) => 15 * 2 ** (attempt - 1),
    async () => {
      const failure = await checkKeyFile(deps, location, key);
      if (failure) throw new Error(`[not_found] ${failure}`);
    },
  );

  const outcome = await retry(deps, submitRetryDelay, async () => {
    try {
      return { status: await deps.submit(request) };
    } catch (error) {
      const { kind, message } = classifyError(error);
      if (kind === "unavailable" || kind === "network") {
        const retryAfter =
          error instanceof IndexNowApiError && error.retryAfter
            ? ` retry after ${error.retryAfter}s`
            : "";
        throw new Error(`[${kind}] ${message}${retryAfter}`);
      }
      // Retrying cannot help.
      return { rejected: `[${kind}] ${message}` };
    }
  });

  if ("rejected" in outcome) throw new Error(outcome.rejected);
  return { host, submitted: urlList.length, status: outcome.status };
}
