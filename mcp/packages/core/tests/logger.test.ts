import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/logger.ts";

function capture() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return () =>
    spy.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("writes pino-compatible JSON lines", () => {
    const lines = capture();
    createLogger("test", { level: "info" }).warn({ status: 502 }, "failed");
    expect(lines()).toEqual([
      {
        level: 40,
        time: expect.any(Number),
        name: "test",
        status: 502,
        msg: "failed",
      },
    ]);
  });

  it("accepts a message alone", () => {
    const lines = capture();
    createLogger("test", { level: "info" }).info("started");
    expect(lines()).toEqual([expect.objectContaining({ msg: "started" })]);
  });

  it("redacts sensitive keys at any depth", () => {
    const lines = capture();
    createLogger("test", { level: "info" }).error({
      token: "t",
      user: { accessToken: "a", id: "u1" },
      deep: [{ nested: { refresh_token: "r", clientSecret: "c" } }],
      headers: {
        Authorization: "Bearer x",
        cookie: "c",
        "set-cookie": ["s"],
        accept: "*/*",
      },
      authInfo: { token: "t" },
    });
    expect(lines()[0]).toMatchObject({
      token: "[redacted]",
      user: { accessToken: "[redacted]", id: "u1" },
      deep: [
        { nested: { refresh_token: "[redacted]", clientSecret: "[redacted]" } },
      ],
      headers: {
        Authorization: "[redacted]",
        cookie: "[redacted]",
        "set-cookie": "[redacted]",
        accept: "*/*",
      },
      authInfo: "[redacted]",
    });
  });

  it("serialises errors without their enumerable fields", () => {
    const lines = capture();
    const error = Object.assign(new TypeError("boom"), {
      config: { headers: { authorization: "Bearer x" } },
    });
    const logger = createLogger("test", { level: "info" });
    logger.error({ error }, "failed");
    logger.error(error);
    const [first, second] = lines() as Record<string, unknown>[];
    expect(first?.error).toEqual({
      name: "TypeError",
      message: "boom",
      stack: expect.any(String),
    });
    expect(second).toMatchObject({
      name: "test",
      err: { name: "TypeError", message: "boom" },
    });
    expect(JSON.stringify(lines())).not.toContain("Bearer x");
  });

  it("redacts class instances, including circular ones", () => {
    const lines = capture();
    class Session {
      id = "s1";
      token = "t";
      headers = { authorization: "Bearer x" };
      self?: Session;
      at = new Date(0);
    }
    const session = new Session();
    session.self = session;
    const logger = createLogger("test", { level: "info" });
    logger.info({ session });
    logger.info(new Session());
    const [first, second] = lines();
    expect(first).toMatchObject({
      session: {
        id: "s1",
        token: "[redacted]",
        headers: { authorization: "[redacted]" },
        self: "[Circular]",
        at: "1970-01-01T00:00:00.000Z",
      },
    });
    expect(second).toMatchObject({ token: "[redacted]" });
    expect(JSON.stringify(lines())).not.toMatch(/Bearer x|"t"/);
  });

  it("handles circular references", () => {
    const lines = capture();
    const obj: Record<string, unknown> = { id: 1 };
    obj.self = obj;
    createLogger("test", { level: "info" }).info(obj);
    expect(lines()[0]).toMatchObject({ id: 1, self: "[Circular]" });
  });

  it("redacts private key fields", () => {
    const lines = capture();
    createLogger("test", { level: "info" }).error({
      key: {
        privateKey: "k",
        private_key: "k",
        p8: "k",
        pem: "k",
        ciphertext: "k",
        keyId: "ABC",
      },
    });
    expect(lines()[0]).toMatchObject({
      key: {
        privateKey: "[redacted]",
        private_key: "[redacted]",
        p8: "[redacted]",
        pem: "[redacted]",
        ciphertext: "[redacted]",
        keyId: "ABC",
      },
    });
  });

  it("drops lines below the level, and everything when silent", () => {
    const lines = capture();
    createLogger("test", { level: "warn" }).info({}, "hidden");
    createLogger("test", { env: { LOG_LEVEL: "silent" } }).error({}, "hidden");
    createLogger("test", { env: { LOG_LEVEL: "debug" } }).debug({}, "shown");
    expect(lines()).toEqual([expect.objectContaining({ msg: "shown" })]);
  });
});
