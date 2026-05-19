# Sidequest Roadmap

iMessage agent that assigns real-world sidequests when people are bored. Web exists only for the landing page (`/`), the signup flow (`/signup`), and read-only mission cards (`/q/[id]`).

---

## Where we are now

**Web** (deployed at `sdqst.fun` via Vercel):
- Pixel-art landing page with PixelBlast WebGL background and magnetic CTA button
- `/signup` route — Poke-inspired layout with country picker (20 countries, per-country placeholders, dial-code dropdown), composes E.164 client-side, calls `/api/signup` which creates the user in Photon (shared) + Convex with IP-derived city + lat/lon, then deep-links to iMessage
- `/q/[id]` mission card — sleek dark redesign (subtle cards, accent dots, rounded number badges)
- `/admin` — internal recent-quests dashboard, sleek dark redesign with source-coded chips
- `/admin/me` — personal admin view of the operator's own user record + memory + full quest history (defaults to Jun's phone, swap with `?phone=`)
- `/admin/generate` — internal manual generator for prompt iteration

**Agent** (runs locally via `npm run imessage:agent`):
- Inbound iMessage handler keyed by phone, parses country from phone number
- Per-user state machine (`idle` → `awaiting_followup` → `idle`)
- Convex `users` table holds memory: name, homeCity, currentCity, onVacation, notes, country, assignedPhone, signedUpAt, latitude, longitude
- Two-tier model split: Haiku for follow-up question + quick ack + memory updater + inline location extraction, Sonnet 4.6 + web search for quest crafting
- Quest fallback: if Sonnet finishes without calling the structured tool, second forced pass
- Memory auto-extracted via Haiku after each turn (fire-and-forget)
- **Silent context** injected into every prompt: local time (from phone area code → timezone), current city (IP geo at signup OR Haiku-extracted from the current turn's text), live weather (Open-Meteo using the freshest available coords). Travel cases ("im in tokyo tonight") update weather on the first turn.
- Terminal mode (`npm run terminal:agent`) for offline prompt iteration

**Deployment:**
- Web is on Vercel, auto-deploys on push to main
- Convex dev deployment (`incredible-guineapig-515`)
- iMessage agent runs on Railway as a 24/7 worker (`sidequest-imessage-agent` / `sidequest-agent`)
- Photon Free plan (10 user cap)

---

## Phase 1 — Private beta ready

Goal: invite 5–10 friends, link `sdqst.fun`, and have it Just Work without Jun's laptop being on.

1. **Done: link quests to users.** New iMessage and terminal quests now save `phone`, `initialRequest`, `followupAnswer`, and `source`; admin-generated quests are marked as `admin`.
2. **Done: admin observability.** `/admin` now shows recent quests with source, linked phone, request, follow-up answer, mission preview, and link. Critical for prompt-tuning based on real outputs.
3. **Done: deploy the iMessage agent.** The long-running iMessage listener now runs on Railway, so Sidequest no longer depends on Jun's laptop being on.
4. **Convex production deployment.** Currently using a dev deployment. Move quests + users to prod, swap env vars on Vercel + the deployed agent.

---

## Phase 2 — Public beta polish

Goal: ready to share more widely without things breaking or burning credits.

1. **W/L feedback in iMessage.** After a quest is sent, parse subsequent `W` / `L` (or "won" / "lost" / "did it" / "skipped it") in the user's next message, save against the quest, optionally feed into memory.
2. **Quest re-roll / refine.** If user replies "naw" or "different vibe" after the link drops, regenerate with a tweak rather than ignoring.
3. **Anti-spam at signup.** Either SMS verification (Twilio code), or rate-limit by IP / fingerprint. The 100-user Photon Pro cap can be eaten by junk signups otherwise.
4. **Error logging.** Real logging on Claude / Photon / Convex failures — visible somewhere Jun can scan. Today errors land in stdout and disappear when the agent restarts.
5. **Photon plan check.** Likely time to move from Free (10 users) to Pro ($25, 100 users) once invites go out.

---

## Phase 3 — Quality + intelligence

Quests get noticeably better.

1. **Done: Time-of-day + day-of-week awareness.** Local time is derived from each user's phone country code on every turn and injected silently into the ack, follow-up, and quest prompts.
2. **Done: Weather awareness.** Open-Meteo lookup runs every turn using either IP-derived signup coords or coords resolved from the current message's text via Haiku + Open-Meteo geocoder. Travel cases get the right weather on the first turn.
3. **Richer memory.** Track past quests (titles + W/L), spots they've been to, dislikes. Use as anti-repetition signal. (Blocked on Phase 2 #1 W/L feedback.)
4. **Multi-stop flexibility.** Currently fixed at 3 stops. Allow 1–5 based on time budget / vibe.
5. **Group mode.** Multiple friends on the same quest, possibly via group iMessage thread (Photon supports DM + group).

---

## Phase 4 — Public launch readiness

1. Upgrade to Photon Business (`$250/line`) for a single public number — drops the per-user signup friction.
2. Terms of service, privacy, consent flow for phone storage.
3. Opt-out (`STOP`) handling.
4. Abuse handling / blocklist.
5. Rate limit per user (so one tester can't burn the Claude budget).
6. Onboarding copy that explains the product cleanly.

---

## Phase 5 — Growth loops

1. **Trackable invite text.** The mission's `inviteText` field becomes a trackable share — friends-of-friends sign up via attribution.
2. **Weekly themed drops.** "Date night chaos." "Solo reset." "Cheap thrill." "Touch grass." Surfaces a curated mission to active users.
3. **Streaks / lightweight achievements.** Only after core quest quality is dialed.
4. **Personalization from W/L history.** Memory already exists — feed past wins into the quest prompt explicitly.

---

## Parking lot (interesting but not now)

- "Agent does it for you" — booking restaurants, buying tickets via real APIs (OpenTable, Resy, Eventbrite). Cool but big undertaking and only worth it post-launch.
- Browser automation (Browser Use / Browserbase). Same parking lot.
- WhatsApp / SMS via Twilio as alternate provider — only if Photon Business pricing becomes a blocker.
- Public API for partners.
