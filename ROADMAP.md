# Sidequest Roadmap

This starts from the current MVP: a Next.js generator, Convex storage, Claude quest generation, and public `/q/[id]` mission pages.

## Phase 1: Stabilize the Web Foundation

1. Finish Convex project setup and confirm quest generation works locally.
2. Add a few manually reviewed sample quests for Seoul, New York, Tokyo, and San Francisco.
3. Add simple error logging around Claude and Convex failures.
4. Add a feedback mutation so the W/L buttons save a result.
5. Add a lightweight admin list page for recent quests.

## Phase 2: Improve Quest Quality

1. Create a prompt test set with realistic bored-user requests.
2. Add safety and practicality rules: no dangerous locations, no closed venues, no excessive travel time, no budget-breaking stops.
3. Add optional inputs for city, time window, budget, solo/group, weather, and energy level.
4. Add fallback generation if Claude returns a weak or invalid quest.
5. Review W/L feedback weekly and update the prompt based on patterns.

## Phase 3: Prepare for Messaging

1. Choose the messaging provider and confirm the iMessage/Photon integration path.
2. Design the SMS/iMessage conversation states: onboarding, request intake, mission delivery, reminder, W/L feedback.
3. Add a Convex table for users and message threads.
4. Store each generated quest against a user or phone number.
5. Add webhook endpoints for inbound messages.

## Phase 4: Launchable Private Beta

1. Deploy the Next.js app to Vercel.
2. Configure Convex production and production environment variables.
3. Add rate limits so one tester cannot burn the Claude API budget.
4. Add basic analytics for generated quests, opened quest pages, and W/L feedback.
5. Recruit 10 to 25 testers in one city and manually inspect every failed or bad quest.

## Phase 5: Public Launch Readiness

1. Add account and consent language for phone-based usage.
2. Add abuse handling, opt-out, and data deletion flows.
3. Build a simple operator dashboard for monitoring conversations and failed generations.
4. Add city-specific quality packs for the first launch market.
5. Create launch copy that explains the product as: `Text us. Get a mission.`

## Phase 6: Growth Loops

1. Make invite text trackable so shared quests can attribute new users.
2. Add group missions for two to five people.
3. Add streaks or lightweight achievements only after the core mission quality is strong.
4. Add weekly themed drops: date-night chaos, solo reset, cheap thrill, touch grass, food sidequest.
5. Use feedback data to personalize future missions without making onboarding heavy.
