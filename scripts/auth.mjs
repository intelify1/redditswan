// ONE-TIME local YouTube authorization. Run on your own PC (needs Node 18+), AFTER the OAuth consent
// screen has been published to Production (A2) — a token minted under "Testing" dies after 7 days.
//
//   1. Put client_secret.json (Desktop-app OAuth client) in the project folder
//   2. node scripts/auth.mjs
//   3. Your browser opens → choose the Google account that owns the RedditSwan channel → Allow
//   4. token.json is written and the refresh token is printed → paste it into the GitHub secret YT_REFRESH_TOKEN
import { exec } from "node:child_process";
import { writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { ROOT, SCOPES, loadClient } from "./youtube-auth-lib.mjs";

const { clientId, clientSecret } = loadClient();
const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent"); // always return a fresh refresh_token

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (!code && !err) {
    res.end();
    return;
  }
  if (err) {
    res.end(`Authorization failed: ${err}. You can close this tab.`);
    console.error("Authorization failed:", err);
    server.close();
    process.exit(1);
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    res.end("No refresh token returned — see the terminal.");
    console.error("Token exchange response:", JSON.stringify(tokens, null, 2));
    server.close();
    process.exit(1);
  }
  writeFileSync(path.join(ROOT, "token.json"), JSON.stringify(tokens, null, 2));

  // Sanity check: which channel did we authorize?
  let channel = "(unknown)";
  try {
    const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    channel = ch.items?.[0]?.snippet?.title ?? JSON.stringify(ch.error ?? ch);
  } catch {}

  res.end(`RedditSwan authorized for channel: ${channel}. You can close this tab and go back to the terminal.`);
  console.log("\n✅ Authorized YouTube channel:", channel);
  console.log("✅ token.json written (it is git-ignored — never commit it).");
  console.log("\nCopy the line below into the GitHub secret named YT_REFRESH_TOKEN:\n");
  console.log(tokens.refresh_token);
  console.log("");
  server.close();
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Opening your browser for Google sign-in…\nIf it doesn't open, paste this URL into your browser:\n");
  console.log(authUrl.toString() + "\n");
  const u = authUrl.toString();
  const cmd =
    process.platform === "win32" ? `start "" "${u}"` : process.platform === "darwin" ? `open "${u}"` : `xdg-open "${u}"`;
  exec(cmd);
});
