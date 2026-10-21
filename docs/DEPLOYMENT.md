# Deployment

> Not yet exercised: nothing here has been run on AWS. Treat it as a checklist to validate.
> Do **not** deploy this build publicly without adding authentication (see SECURITY.md). At minimum put it behind HTTP basic auth or an IP allow-list for the demo.
> The hackathon's AWS promotional credits were reported as exhausted (research brief, 7 Oct update). Confirm service access and budget before using paid resources.

## Local development

See README. Three processes (`npm run dev`): web :5173, API :4000, MCP :4100, plus MySQL :3306. No AWS credentials needed in mock mode.

## AWS EC2 (backend + MCP) outline

1. Launch a small Linux instance (e.g. t3.small). Security group: allow 22 (your IP only), 80/443 (public). **Do not open 4000/4100/3306.**
2. Install Node 22, git, and a reverse proxy (Caddy gives automatic HTTPS; nginx + certbot also works).
3. Database: easiest is MySQL on the instance (local socket/loopback, EBS-encrypted volume); RDS MySQL is sturdier but costs more.
4. `git clone`, `npm ci`, create `.env` (below), `npm run db:migrate:deploy`, `npm run db:seed` (demo data only), `npm run build`.
5. Run with systemd (`npm run start -w @homeflow/mcp-server` and `npm run start -w @homeflow/api`), restart on failure, `NODE_ENV=production`.
6. Reverse proxy: terminate TLS and forward `https://api.example.com` → `127.0.0.1:4000`. Keep MCP on loopback unless an external MCP client needs it; if so, expose only `/mcp`, require the bearer token (or OAuth) and keep the Origin check.
7. Frontend: `VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build -w @homeflow/web`, deploy `apps/web/dist` to Vercel or serve from the proxy. Set `CORS_ORIGINS` to that exact origin.

## Environment variables

| Variable                                                                    | Used by          | Notes                                                                                            |
| --------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                              | API, MCP, seed   | `mysql://user:pass@host:3306/db`                                                                 |
| `TEST_DATABASE_URL`                                                         | tests            | database name must end in `_test`; **dropped on every run**                                      |
| `API_HOST`, `API_PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, `APPROVAL_TTL_SECONDS` | API              |                                                                                                  |
| `MCP_HOST`, `MCP_PORT`, `MCP_URL`, `MCP_AUTH_TOKEN`, `MCP_ALLOWED_ORIGINS`  | API + MCP        | token ≥ 16 chars, same value in both                                                             |
| `AI_PROVIDER`                                                               | API              | `mock` (default) or `gemini`                                                                     |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`, `AI_TIMEOUT_MS` | API | Gemini only. Keep the API key in a server-side secret manager and never in the browser |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL` | API | Optional fallback TTS. Keep credentials server-side; used only after Gemini TTS fails |
| `VITE_API_BASE_URL`                                                         | web (build time) | public value; never put secrets in `VITE_*`                                                      |

## Google Gemini

Set `GEMINI_MODEL=gemini-3.5-flash-lite` initially. Voice output uses the server-side `gemini-2.5-flash-preview-tts` model with the `Kore` voice by default. Verify that the configured Gemini API key can access both models before enabling voice in a deployment.

If Gemini TTS returns `VOICE_QUOTA_EXCEEDED`, the Gemini project has exhausted its TTS quota. With ElevenLabs configured, the API tries that secondary provider automatically; otherwise the web app uses browser speech. Enable billing or request/increase the applicable Generative Language API quota, or wait for the provider's reset window; changing browser settings cannot resolve this provider-side condition. Restart the API after changing the server-side key, project, or TTS model configuration.

## ElevenLabs fallback

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` on the API server to enable the secondary provider. Create an account at [elevenlabs.io](https://elevenlabs.io), copy an API key from your profile/API settings, and copy the ID of a voice from Voices/Voice Library. The default `eleven_multilingual_v2` model returns MP3 audio that the existing browser player can play. Gemini remains primary; ElevenLabs is called only after an eligible Gemini quota, timeout, or transient provider failure. If ElevenLabs credentials are missing, Gemini continues to work normally.

Check the ElevenLabs subscription/usage page before demos to monitor free characters and reset dates. Free-plan limits vary by account and region; when credits are exhausted, the API returns a quota response and HomeFlow falls back to browser speech without retrying indefinitely.

## Database backups & security

- Automated daily dump (`mysqldump --single-transaction`) to an encrypted S3 bucket or EBS snapshots; test a restore.
- Dedicated DB user with privileges on one schema only (the migration user may be separate); bind MySQL to loopback/private subnet.
- Encrypt volumes; never reuse the demo credentials from `docker-compose.yml`.

## Cost control

Use quota and billing alerts; cap generated output at 2048 tokens in `GeminiProvider` and keep the `/agent` rate limit. The application runtime requires `AI_PROVIDER=gemini`; mocks are injected only by automated tests.
