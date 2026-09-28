// Shared credential loading (A5): environment variables FIRST (GitHub Secrets in CI),
// falling back to local client_secret.json / token.json (for local testing & re-auth).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

export function loadClient() {
  if (process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET) {
    return { clientId: process.env.YT_CLIENT_ID, clientSecret: process.env.YT_CLIENT_SECRET };
  }
  const file = path.join(ROOT, "client_secret.json");
  if (!existsSync(file)) {
    throw new Error("No YT_CLIENT_ID/YT_CLIENT_SECRET env vars and no client_secret.json in the project folder");
  }
  const j = JSON.parse(readFileSync(file, "utf8"));
  const c = j.installed || j.web;
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

export function loadRefreshToken() {
  if (process.env.YT_REFRESH_TOKEN) return process.env.YT_REFRESH_TOKEN;
  const file = path.join(ROOT, "token.json");
  if (!existsSync(file)) throw new Error("No YT_REFRESH_TOKEN env var and no token.json — run `node scripts/auth.mjs` once");
  return JSON.parse(readFileSync(file, "utf8")).refresh_token;
}

export async function getAccessToken() {
  const { clientId, clientSecret } = loadClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: loadRefreshToken(),
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error("Google token refresh error:", JSON.stringify(data, null, 2));
    if (data.error === "invalid_grant") {
      console.error(
        "invalid_grant = the refresh token is dead. Most common cause: OAuth consent screen was in 'Testing' (7-day expiry, A2). " +
          "Publish the app to Production, then re-run `node scripts/auth.mjs` and update the YT_REFRESH_TOKEN secret.",
      );
    }
    throw new Error("Could not refresh YouTube access token");
  }
  return data.access_token;
}
