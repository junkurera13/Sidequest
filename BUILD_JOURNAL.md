# Sidequest Build Journal

This is the human-readable history of Sidequest: what changed on each workday,
the decisions behind it, and exactly where the project was left.

Add a new entry at the end of every meaningful work session. Keep the newest
entry first. Git remains the technical history; this file is the product story.

---

## July 21, 2026 — The renovation begins

_The conversation began late at night and the implementation landed after
midnight, so this session is recorded under July 21._

### What changed in the vision

- We abandoned the old version of Sidequest as the product direction. Existing
  code is not sacred and can be replaced when it conflicts with the new vision.
- Sidequest is no longer conceived as a marketplace. It is an agent that helps
  create beautiful, movie-like human experiences that feel strangely meant for
  the person receiving them.
- A great Sidequest has two pillars:
  - **People:** time alone, with friends, family, or strangers who may become
    meaningful.
  - **Experiences:** a hidden balance between something familiar and something
    undiscovered.
- The balance of the known and unknown is an internal creative thesis. The
  product must never explain it to the user. The magician does not reveal the
  trick.
- The agent should learn from real memories, not from a conventional preference
  questionnaire or demographic stereotypes.
- iMessage is the initial doorway. A richer owned mobile experience can appear
  later when the experience needs more than conversation.
- The initial test is intentionally narrow: learn from one meaningful memory,
  ask when the person is free, and eventually create their first Sidequest.
- Calendar and Gmail access may later let Sidequest notice genuine openings in
  someone’s life, but those integrations are not part of the first test.
- The complete new product thesis was captured in `VISION.md`.
- The obsolete `ROADMAP.md` was deleted.

### Design direction

- The design rule is: **Airbnb’s emotional warmth and composition, Apple’s
  behavior and motion, and Sidequest’s own identity.**
- The visual tone should be warm, human, editorial, spacious, calm, and quietly
  cinematic.
- The old neon yellow, pink, green, pixel type, and scan-line visual language is
  not the new direction.
- Motion should feel direct and interruptible, with restrained springs, clear
  hierarchy, reduced-motion support, and no animation added merely as decoration.
- Airbnb is a reference, not an identity to clone. Sidequest should use properly
  licensed typography and develop its own accent color, iconography, and visual
  language.

### What was built

- Replaced the old multi-question onboarding with one invitation:

  > tell me about a real day you'd live again — the people, what happened, and
  > why it stayed. messy is good.

- The user’s raw response is saved immediately as an experience memory.
- A background job analyzes that memory while the conversation continues.
- Sidequest gives a short, specific human reflection and immediately asks:

  > when do u have a few hours free? i want to make your first sidequest.

- The person’s free-time answer is preserved in their own words for the future
  first-Sidequest composer.
- Built the first experience-graph system:
  - Nodes can represent people, places, activities, settings, emotions, motifs,
    constraints, context, and the memory itself.
  - Connections explain how those nodes relate.
  - Every node and connection keeps its evidence, confidence, and whether it is
    a fact or a hypothesis.
  - The graph prompt forbids inventions and demographic stereotypes.
  - Failed background analysis is retried and recorded instead of silently
    disappearing.
- Added separate model configuration for fast memory reflections and deeper
  background memory analysis.
- Added migration-safe support for users stranded in the old onboarding states.
- Updated the README to describe the renovated product and the new model
  configuration.

### Final block — the new landing page

- Completely replaced the old yellow-and-pink pixel landing page. The public
  entry point no longer uses the old `SDQST` logo, PixelBlast effect, scanlines,
  pixel typography, chunky shadows, or neon composition.
- Created an original photographic hero inspired by the emotional center of the
  product: three close friends cycling through a quiet seaside town near
  Fukuoka in the late-afternoon sun. The asset is stored locally at
  `app/assets/sidequest-coast.jpg`; the live page has no dependency on stock
  photography or a remote image host.
- Created a new Sidequest wordmark and path-like symbol. It is intentionally its
  own identity rather than a copy of Airbnb’s logo.
- Established the first real visual system:
  - warm ivory, ink, muted stone, and clay red
  - calm modern sans-serif typography paired with an editorial serif
  - full-bleed photography and cardless layouts
  - restrained translucent navigation and soft material depth
  - immediate press feedback, quiet entrances, scroll reveals, and complete
    reduced-motion, reduced-transparency, and increased-contrast fallbacks
- Rewrote the landing-page story around the actual product:
  - begin with one meaningful memory
  - quietly learn what gave the day its texture
  - ask for a genuine opening in the person’s life
  - deliver one experience rather than another feed of recommendations
- The primary actions open a prefilled iMessage directly when the Sidequest
  phone number is configured, with the existing signup route as the fallback.
- Updated the site title and description to match the renovated product.

### Verification

- All 22 automated tests passed.
- Lint passed with no errors. Four warnings remain in pre-existing generated
  Convex files.
- Convex code generation and TypeScript validation passed.
- The production build passed.
- The renovated landing page returned HTTP 200 with no application error or
  Next.js error overlay in headless Chrome.
- Desktop and 390px mobile compositions were visually inspected. The mobile
  page has no horizontal overflow (`scrollWidth === clientWidth === 390`).
- The hero, primary action, internal navigation, and SMS destination render at
  both sizes. The only browser-console noise was the development hot-reload
  WebSocket under headless Chrome, not an application error.
- Dependency installation reported 22 advisories, including 6 high-severity
  advisories. No automatic potentially breaking repair was applied.

### Where we left off

- The new onboarding and graph engine exist, but the development database does
  not contain a memory yet. The Fukuoka story from the Codex conversation was
  not silently copied into the product.
- There is no visual graph interface yet. Raw graph data can currently be seen
  through the Convex dashboard in these tables:
  - `experienceMemories`
  - `experienceGraphNodes`
  - `experienceGraphEdges`
- To create the first real graph, run `npm run terminal:agent`, begin a new
  conversation, and answer the memory invitation. Then run
  `npx convex dashboard` to inspect the stored data.
- The strongest candidate for the first visual surface is a private
  **Your Constellation** view: a living, calm representation of meaningful
  memories and emerging understanding, not a corporate flowchart.
- The landing page now expresses the new identity, but older internal surfaces
  such as signup, quest files, and admin tools still contain parts of the legacy
  pixel system. They should be renovated only as each new product block reaches
  them; they were not silently redesigned as part of the landing-page request.
- The next functional block is the **first Sidequest composer**. It needs enough
  immediate context—current location, who is joining, available window, and hard
  constraints—to turn the graph into one thoughtful real-world experience.
- The renovation changes are currently local and uncommitted. Nothing from this
  session was intentionally deployed to production.

---

## May 25, 2026 — First onboarding experiments

### What was built

- Added a four-beat onboarding flow with a generated cold quest, name, mirror
  question, and location capture.
- Iterated on the flow so responses felt acknowledged by the language model.
- Removed the cold quest again and settled on an introduction followed by name,
  mirror, and location questions.
- Split reflection and location into separate messages and increased model token
  limits for Kimi’s reasoning behavior.

### Where we left off

- Sidequest had a functioning but conventional question-by-question onboarding.
- This became the primary onboarding until the July renovation rejected it in
  favor of one meaningful memory dump.

---

## May 20, 2026 — A more agentic conversation engine

### What was built

- Replaced the rigid agent state machine with a language-model router and tool
  use.
- Added generated handoffs, outcome acknowledgements, and location questions.
- Added active-quest loading and hardened Anthropic content-block handling.

### Where we left off

- The agent could hold a more flexible conversation and select tools, while the
  product still revolved around the original quest-generation model.

---

## May 19, 2026 — Context and operations

### What was built

- Added quest links, admin observability, a Railway worker, and improved cards,
  signup, and admin surfaces.
- Added silent awareness of time, city, live weather, and travel context.
- Added win/loss feedback and surfaced Photon signup failures.

### Where we left off

- The original product could create and monitor quests with better real-world
  context and operational visibility.

---

## May 18, 2026 — Original MVP

### What was built

- Created the Next.js foundation and first iMessage agent.
- Built the original pixel-art landing page and its neon visual identity.
- Added quest generation, phone-number signup, account creation, and a dedicated
  signup page.

### Where we left off

- Sidequest existed as a working quest-generation MVP with a playful pixel-art
  identity and an early roadmap. Both the identity and roadmap were later
  superseded by the July renovation.
