# Sidequest MVP

Sidequest is an iMessage-based AI agent that assigns real-world missions when people are bored. This repo is the first web foundation only: a Next.js internal quest generator and public mission-file pages.

Photon/iMessage is intentionally not integrated yet.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Convex
- Anthropic Claude API
- nanoid

## Setup

Install dependencies:

```bash
npm install
```

Start Convex:

```bash
npx convex dev
```

On the first run, Convex will ask you to log in and create or choose a project. It usually writes `NEXT_PUBLIC_CONVEX_URL` into `.env.local` for the Next.js app.

Add the Anthropic key to Convex, because the quest generation action runs inside Convex:

```bash
npx convex env set ANTHROPIC_API_KEY your_anthropic_key_here
```

Quest crafting uses Claude Sonnet 4.6 by default. To override (e.g. drop to Haiku for cheap iteration during prompt tuning), set:

```bash
npx convex env set ANTHROPIC_QUEST_MODEL claude-haiku-4-5-20251001
```

`ANTHROPIC_QUEST_MODEL` is optional. If unset, the app uses `claude-sonnet-4-6` for quest generation. Cheaper models (Haiku) are used elsewhere for routing and lightweight conversation.

Start Next.js in another terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Add these in `.env.local` at the project root:

```bash
NEXT_PUBLIC_CONVEX_URL=your_convex_url_here
NEXT_PUBLIC_SIDEQUEST_PHONE=+15551234567
```

`NEXT_PUBLIC_SIDEQUEST_PHONE` is the Photon/iMessage number the landing page button texts. Without it, the homepage shows a `Coming soon` placeholder instead of the live `Text Sidequest` button.

Add this in Convex with `npx convex env set` or in the Convex dashboard:

```bash
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_QUEST_MODEL=claude-sonnet-4-6  # optional override; defaults to Sonnet 4.6
```

Do not commit real `.env` files.

## Local Test Flow

1. Run `npx convex dev`.
2. Run `npm run dev` in a second terminal.
3. Visit [http://localhost:3000](http://localhost:3000).
4. Paste a request like `I’m free tonight in Seoul, ₩30k budget, solo, surprise me.`
5. Click `Generate Quest`.
6. Open the generated `/q/[id]` link.

## iMessage Agent

The fastest iMessage path is a long-running Spectrum agent. It listens for inbound iMessages, generates a quest through Convex, and replies with the public quest link.

Add these to `.env.local` or export them in your shell:

```bash
PHOTON_PROJECT_ID=your_photon_project_id
PHOTON_PROJECT_SECRET=your_photon_project_secret
SIDEQUEST_PUBLIC_BASE_URL=https://your-public-url.example
```

`SIDEQUEST_PUBLIC_BASE_URL` must be reachable from your phone. For local testing, use an HTTPS tunnel such as ngrok that points to `npm run dev`, or use a deployed Vercel preview later.

Run the agent:

```bash
npm run imessage:agent
```

Then send an iMessage to your enabled Photon/Spectrum line. The first reply should be `Case accepted. Mission file incoming.`, followed by the quest link.

## Scripts

```bash
npm run dev
npm run imessage:agent
npm run build
npm run lint
npm test
```
