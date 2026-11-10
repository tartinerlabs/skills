import { Hono } from "hono";
import { handleMcp } from "./http.ts";
import { auth } from "./lib/auth.ts";
import { consentPage, signInPage } from "./pages.ts";

const app = new Hono();

app.get("/", (c) =>
  c.json({ name: "google-search-console-mcp", status: "ok", mcp: "/mcp" }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
// OAuth discovery metadata (RFC 8414, RFC 9728) served by Better Auth.
app.get("/.well-known/*", (c) => auth.handler(c.req.raw));
app.post("/mcp", (c) => handleMcp(c.req.raw));
app.get("/sign-in", (c) => signInPage(c.req.raw));
app.get("/consent", (c) => consentPage(c.req.raw));

export default app;
