# Sidequest

Sidequest is an agent that composes real-world experiences that feel strangely meant for the person receiving them. It begins as a quiet iMessage relationship and opens into a crafted mobile experience.

The product is being renovated block by block. [VISION.md](./VISION.md) is the source of truth for the new direction; legacy quest and web surfaces remain temporarily while their replacements are built.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Convex
- Eve agent pilot with Vercel AI Gateway
- OpenRouter and Anthropic support in the existing Convex runtime
- nanoid

## New Agent Pilot

The first contained version of the new experience-composition brain lives under
`agent/`. It does not replace the current product runtime yet. Its architecture,
tools, credentials, commands, and tasting suite are documented in
[`docs/agent-brain.md`](./docs/agent-brain.md).

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

Add model-provider credentials to Convex, because the quest generation action
runs inside Convex.

For OpenRouter:

```bash
npx convex env set LLM_PROVIDER openrouter
npx convex env set OPENROUTER_API_KEY your_openrouter_key_here
npx convex env set OPENROUTER_MODEL moonshotai/kimi-k2.6
```

`OPENROUTER_MODEL` controls both chat/router and quest generation. To split
them later, set `OPENROUTER_CONVERSATION_MODEL` and/or
`OPENROUTER_QUEST_MODEL`.

Anthropic is still supported as a fallback:

```bash
npx convex env set ANTHROPIC_API_KEY your_anthropic_key_here
```

Quest crafting uses Claude Sonnet 4.6 by default when `LLM_PROVIDER` is unset or
set to `anthropic`. To override it, set:

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

Add one provider config in Convex with `npx convex env set` or in the Convex
dashboard:

```bash
# OpenRouter
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=moonshotai/kimi-k2.6
OPENROUTER_CONVERSATION_MODEL=moonshotai/kimi-k2.6  # optional
OPENROUTER_REFLECTION_MODEL=your_fast_model          # optional
OPENROUTER_MEMORY_MODEL=your_strong_model            # optional
OPENROUTER_QUEST_MODEL=moonshotai/kimi-k2.6         # optional

# Anthropic fallback
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_REFLECTION_MODEL=claude-haiku-4-5-20251001 # optional
ANTHROPIC_MEMORY_MODEL=claude-sonnet-4-6              # optional
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
