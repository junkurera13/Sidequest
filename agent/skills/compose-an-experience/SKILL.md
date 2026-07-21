---
description: Compose one deeply personal, feasible Sidequest from a person's memories, relationships, circumstances, time window, and location.
---

# Compose An Experience

The output is not a recommendation list or an itinerary assembled from popular
places. It is one authored human experience: personal, emotionally coherent,
easy to begin, and real enough to do.

## The Private Creative Brief

Before searching, silently form a brief with:

1. **The people.** Who is present, what is their relationship, and what kind of
   connection might this time make possible?
2. **The emotional need.** Rest, play, intimacy, courage, wonder, belonging,
   movement, reconnection, or something more precise.
3. **The anchors.** Specific activities, rhythms, environments, people, or
   feelings the person has genuinely enjoyed before.
4. **The opening.** One adjacent ingredient that could expand their world
   without making the day feel alien or performative.
5. **The friction.** Energy, indecision, crowds, queues, cost, mobility,
   transport, weather, booking, social anxiety, or another reason the person
   might stay home.
6. **The hard frame.** Location, start and end time, participants, budget,
   accessibility, transport, dietary needs, and safety constraints.

Mark every item internally as one of:

- fact: directly stated or present in trusted memory;
- hypothesis: plausible but unconfirmed;
- unknown: unavailable and unsafe to assume.

Never infer a preference from nationality or another demographic. Never show
this brief, its labels, graph mechanics, or the creative pattern to the user.

## Compose Before You Search

Imagine two or three different *shapes* for the experience before looking up
venues. A shape is a human arc, not a set of businesses. Examples of shape:

- a gentle reason to leave home, followed by an unhurried shared reward;
- movement that loosens conversation, followed by a place to linger;
- one tactile discovery with a familiar person, then space to absorb it.

Do not copy these examples as formulas. Choose the shape that best serves this
person today. The number of moments must emerge from the shape. One beautiful
moment can be enough; never force three stops.

## Discover Ingredients

Use `search_web` when local writing, cultural calendars, community pages, or
unusual possibilities could reveal ingredients that ordinary place ranking
would miss. Search by the creative need and constraints, not merely "top things
to do." Translate personal context into anonymous search terms. Never send a
person's name, phone number, raw memory, relationship details, or other private
data to a discovery service.

Use `search_places` to turn a promising ingredient into a verified real place.
Popularity and rating are evidence, never the reason for the choice. Prefer the
right atmosphere, timing, scale, and fit over the most famous venue.

If a discovery tool is unavailable, do not fabricate. Work from verifiable
tools that remain, reduce specificity, or record the limitation as uncertainty.

## Verify The Day

Before submitting:

- Verify every relied-upon venue with `search_places`.
- Verify transitions with `compute_route` whenever two moments occur at
  different places. Route duration belongs inside the experience, not outside
  its time window.
- Check `get_weather` when weather could shape comfort, safety, transport, or
  whether the idea works. If the date is beyond forecast range, say so.
- Treat opening hours, prices, events, and reservations as time-sensitive.
  Never present an estimate as verified fact.
- Include a backup only when a realistic failure mode warrants one. A backup is
  a graceful variation of the same emotional experience, not an unrelated list.

## The Taste Pass

Reject the draft and recompose if any answer is yes:

- Could this have been generated for almost anyone in this city?
- Is it secretly a list, a crawl, or a schedule padded with stops?
- Does it repeat the surface of a memory instead of understanding why it
  mattered?
- Is the opening so large that the person must become someone else to enjoy it?
- Is the opening so small that nothing in their world can grow?
- Does getting started demand more energy than the experience gives back?
- Is a venue doing all the creative work?
- Have demographics been mistaken for personality?
- Is the magic explained instead of felt?
- Is any logistical claim invented, stale, or ambiguous?

The final experience should score strongly on personal fit, emotional promise,
gentle expansion, low activation energy, pacing, feasibility, dignity, and
afterglow. Safety and hard constraints are gates, not scores to trade away.

## Submit One Sidequest

Call `submit_sidequest` exactly once with the finished experience.

- Write the title and invitation as a thoughtful human, without revealing the
  hidden rationale.
- Use one to five moments. Every moment must earn its place.
- Include verified place objects only from `search_places` results.
- Include routes only from `compute_route` results.
- Keep preparation short enough that the person can simply go.
- Put genuine unknowns in `uncertainties`; never disguise them with confidence.
- Include source URLs used for live claims.
- Use a low confidence level if a central fact could not be verified.

After submission, introduce the Sidequest simply. Do not narrate the workflow,
the tools, a score, or the private creative brief.
