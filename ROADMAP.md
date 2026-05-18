# Sidequest Roadmap

iMessage agent that assigns real-world sidequests when people are bored. Web exists only for the landing page (`/`), the signup flow (`/signup`), and read-only mission cards (`/q/[id]`).

---

## Where we are now

**Web** (deployed at `sdqst.fun` via Vercel):
- Pixel-art landing page with PixelBlast WebGL background and magnetic CTA button
- `/signup` route — phone-number form, calls `/api/signup` which creates the user in Photon (shared) and in Convex, then deep-links to iMessage
- `/q/[id]` mission card — pixel-art styled, served via Convex
- `/admin` — internal generator for prompt iteration (no follow-up, no memory)

**Agent** (runs locally via `npm run imessage:agent`):
- Inbound iMessage handler keyed by phone, parses country from phone number
- Per-user state machine (`idle` → `awaiting_followup` → `idle`)
- Convex `users` table holds memory: name, homeCity, currentCity, onVacation, notes, country, assignedPhone, signedUpAt
- Two-tier model split: Haiku for follow-up question + quick ack + memory updater, Sonnet 4.6 + web search for quest crafting
- Quest fallback: if Sonnet finishes without calling the structured tool, second forced pass
- Memory auto-extracted via Haiku after each turn (fire-and-forget)
- Terminal mode (`npm run terminal:agent`) for offline prompt iteration

**Deployment:**
- Web is on Vercel, auto-deploys on push to main
- Convex dev deployment (`incredible-guineapig-515`)
- iMessage agent script still runs on local laptop — not 24/7 yet
- Photon Free plan (10 user cap)

---

## Phase 1 — Private beta ready

Goal: invite 5–10 friends, link `sdqst.fun`, and have it Just Work without Jun's laptop being on.

1. **Link quests to users.** The `quests` table has `request` but no `phone` / `userId`. Add the link so we can see who got what and tie W/L feedback to a quest later.
2. **Admin observability.** `/admin/quests` (or extend existing `/admin`) showing recent quests with the user's phone, request, follow-up answer, full mission, and link. Critical for prompt-tuning based on real outputs.
3. **Deploy the iMessage agent.** Move the long-running script off the laptop to a small 24/7 server (Fly.io / Railway / Render — ~$5/mo). Sidequest is "online" only when this is running.
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

1. **Time-of-day + day-of-week awareness.** Pass current local time (derived from country) into the quest prompt so 11pm requests don't suggest brunch spots.
2. **Weather awareness.** Free weather API → inject into the quest prompt; agent's quick ack can reference it honestly.
3. **Richer memory.** Track past quests (titles + W/L), spots they've been to, dislikes. Use as anti-repetition signal.
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
