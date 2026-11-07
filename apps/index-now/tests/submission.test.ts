import { describe, expect, it, vi } from "vitest";
import {
  runSubmission,
  type SubmissionDeps,
  submitRetryDelay,
} from "../src/indexnow/submission.ts";
import { IndexNowApiError } from "../src/utils/errors.ts";

const KEY = "test-key-not-secret";
const request = {
  host: "example.com",
  key: KEY,
  urlList: ["https://example.com/a", "https://example.com/b"],
};

/** Deps with a live key file and a sleep that returns at once, recording the delays. */
function fakeDeps(overrides: Partial<SubmissionDeps> = {}) {
  const sleep = vi.fn(async (_seconds: number, _reason: string) => {});
  const deps: SubmissionDeps = {
    fetchKeyFile: liveKeyFile(),
    submit: vi.fn().mockResolvedValue(200),
    sleep,
    ...overrides,
  };
  const delays = () => sleep.mock.calls.map(([seconds]) => seconds);
  return { deps, delays };
}

const liveKeyFile = () => vi.fn().mockResolvedValue({ status: 200, text: KEY });

describe("runSubmission", () => {
  it("should check the root key file, then submit", async () => {
    const { deps } = fakeDeps();

    const output = await runSubmission(request, deps);

    expect(deps.fetchKeyFile).toHaveBeenCalledWith(
      `https://example.com/${KEY}.txt`,
    );
    expect(deps.submit).toHaveBeenCalledWith(request);
    expect(output).toEqual({ host: "example.com", submitted: 2, status: 200 });
  });

  it("should check keyLocation when given", async () => {
    const keyLocation = `https://example.com/blog/${KEY}.txt`;
    const { deps } = fakeDeps({ submit: vi.fn().mockResolvedValue(202) });

    await runSubmission(
      { ...request, keyLocation, urlList: ["https://example.com/blog/a"] },
      deps,
    );

    expect(deps.fetchKeyFile).toHaveBeenCalledWith(keyLocation);
  });

  it("should retry until the key file is live", async () => {
    const { deps, delays } = fakeDeps({
      fetchKeyFile: vi
        .fn()
        .mockResolvedValueOnce({ status: 404, text: "" })
        .mockResolvedValue({ status: 200, text: KEY }),
    });

    await runSubmission(request, deps);

    expect(delays()).toEqual([15]);
    expect(deps.submit).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", { status: 404, text: "Not Found" }, "not found"],
    ["redirected", { status: 308, text: "" }, "redirects"],
    [
      "holding another key",
      { status: 200, text: "other" },
      "does not contain the key",
    ],
  ])(
    "should fail without submitting when the key file stays %s",
    async (_label, keyFile, expected) => {
      const { deps, delays } = fakeDeps({
        fetchKeyFile: vi.fn().mockResolvedValue(keyFile),
      });

      const run = runSubmission(request, deps);

      await expect(run).rejects.toThrow(/^\[not_found\] /);
      await expect(run).rejects.toThrow(expected);
      expect(delays()).toEqual([15, 30, 60, 120, 240, 480]);
      expect(deps.submit).not.toHaveBeenCalled();
    },
  );

  it("should wait out IndexNow's Retry-After when it is unavailable", async () => {
    const { deps, delays } = fakeDeps({
      submit: vi
        .fn()
        .mockRejectedValueOnce(new IndexNowApiError(503, "", 120))
        .mockResolvedValue(200),
    });

    await runSubmission(request, deps);

    expect(delays()).toEqual([120]);
  });

  it("should fail with a quota error on a rate limit without retrying", async () => {
    const { deps } = fakeDeps({
      submit: vi.fn().mockRejectedValue(new IndexNowApiError(429, "", 120)),
    });

    await expect(runSubmission(request, deps)).rejects.toThrow(/^\[quota\] /);
    expect(deps.submit).toHaveBeenCalledOnce();
  });

  it("should not retry a submission IndexNow rejects", async () => {
    const { deps } = fakeDeps({
      submit: vi.fn().mockRejectedValue(new IndexNowApiError(422, "")),
    });

    await expect(runSubmission(request, deps)).rejects.toThrow(
      /^\[invalid_input\] /,
    );
    expect(deps.submit).toHaveBeenCalledOnce();
  });
});

describe("submitRetryDelay", () => {
  it("should back off exponentially from 30 seconds, capped at an hour", () => {
    const error = new Error("[unavailable] IndexNow could not complete");
    expect(
      [1, 2, 3, 9].map((attempt) => submitRetryDelay(attempt, error)),
    ).toEqual([30, 60, 120, 3600]);
  });
});
