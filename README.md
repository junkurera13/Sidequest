# Sidequest

Sidequest is being rebuilt as an agentic product for creating beautiful human
experiences from lived memories, relationships, and genuine free time.

[`VISION.md`](./VISION.md) is the product source of truth.

## What Exists Today

- `/` — the public landing page.
- `/sign-in` and `/sign-up` — the Clerk identity doorway, styled for Sidequest.
- `/app` — the authenticated product shell with **Now**, **You**, and
  **Together**.
- **You** — an interactive 3D projection of the current development memory
  graph. It uses redacted local data until account-scoped graph retrieval exists.
- **Together** — accepted human connections only. A named person begins as a
  private reference owned by one account, becomes identity-aware only through a
  single-use invitation, and appears in Together only after acceptance.
- `/invite/[token]` — the public accept-or-decline doorway for a human
  connection invitation. This is not an experience invitation or itinerary.
- `agent/` — the Eve shell and a signed Photon webhook for the future iMessage
  doorway. The doorway is deliberately receive-only today: it does not start an
  AI session, store inbound content, or send a reply.
- `lib/experienceOntology.ts` — the shared language for memories, people,
  places, activities, feelings, conditions, patterns, and their relationships.
- `convex/` — authenticated accounts, private person references, connection
  invitations, accepted connections, shared-experience memory foundations, and
  the narrow messaging transport tables.

The Now view remains intentionally blank. Human connection invitations now
exist, but the separate Sidequest experience invitation has not been designed
or implemented. No experience-generation capability is present in the
repository.

## Local Development

Use Node 24, then install and start the web app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Authentication uses Clerk with Convex token validation. Local development
requires the Clerk keys in `.env.local`, a Clerk JWT template named `convex`
with audience `convex`, and `CLERK_JWT_ISSUER_DOMAIN` on the matching Convex
deployment.

Eve is mounted inside the same Next.js app, so the future agent can share one
deployment with the web product. No persistent iMessage worker or separate
Railway service is required.

## Agent

Eve and Spectrum are pinned exactly because both are fast-moving. The current
product boundary, iMessage transport, and credentials are documented in
[`docs/agent-brain.md`](./docs/agent-brain.md).

Useful commands:

```bash
npm run agent:info
npm run agent:build
npm run agent:gateway:check
npm run agent:dev
```

Vercel OIDC is loaded by the local wrapper script for development. Copy
`.env.example` to `.env.local` for local-only values. Never commit real secrets.

## Verification

```bash
npm run lint
npm test
npm run build
npm run agent:build
```

Do not commit real `.env` files.
