# Sidequest

Sidequest is an agent that composes real-world experiences that feel strangely
meant for the person receiving them. It learns from lived memories, notices the
relationships and conditions that gave those moments meaning, and creates one
thoughtful experience rather than another list of recommendations.

[`VISION.md`](./VISION.md) is the product source of truth.

## What Exists Today

- `/` — the public landing page.
- `/app` — the new product shell with **Now**, **You**, and **Together**.
- **You** — an interactive 3D projection of the current development memory
  graph. It uses redacted local data until account-scoped graph retrieval exists.
- `agent/` — the Eve experience-composition agent, its research and
  verification tools, its iMessage doorway, and the canonical Sidequest output
  contract.
- `evals/` — taste and feasibility cases for the agent.
- `lib/experienceOntology.ts` — the shared language for memories, people,
  places, activities, feelings, conditions, patterns, and their relationships.
- `convex/` — a deliberately narrow messaging foundation. It gives signed
  Spectrum deliveries a stable conversation identity and prevents provider
  retries from creating duplicate agent turns. The new account-owned memory
  model has not been chosen yet.

The Now and Together views are intentionally blank. They will be built from the
new product vision rather than inheriting the retired product.

## Local Development

Use Node 24, then install and start the web app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Eve is mounted inside the same Next.js app, so local development and future
Vercel deployments expose the web product and agent together. No persistent
iMessage worker or separate Railway service is required.

## Agent

Eve and Spectrum are pinned exactly because both are fast-moving. The agent
architecture, iMessage flow, and credentials are documented in
[`docs/agent-brain.md`](./docs/agent-brain.md).

Useful commands:

```bash
npm run agent:info
npm run agent:build
npm run agent:gateway:check
npm run agent:parallel:check
npm run agent:dev
npm run agent:eval -- --list
```

The Google place and route tools require `GOOGLE_MAPS_API_KEY`. Vercel OIDC and
the configured Parallel development key are loaded by the local wrapper script.
Copy `.env.example` to `.env.local` for the local-only values. Never commit real
secrets.

## Verification

```bash
npm run lint
npm test
npm run build
npm run agent:build
```

Do not commit real `.env` files.
