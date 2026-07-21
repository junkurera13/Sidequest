import { describe, expect, it } from "vitest";

import { assertSidequestIntegrity, sidequestSchema, type Sidequest } from "./sidequest-schema";

const validSidequest: Sidequest = {
  title: "A Slow Afternoon Together",
  invitation: "Leave the day to us. All you need to do is step outside together.",
  startsAt: "2026-07-26T14:00:00+09:00",
  endsAt: "2026-07-26T18:00:00+09:00",
  timezone: "Asia/Seoul",
  participants: "A father, mother, and their adult son",
  moments: [
    {
      kind: "activity",
      title: "Begin Gently",
      description: "A quiet shared beginning.",
      startTime: "2026-07-26T14:30:00+09:00",
      durationMinutes: 60,
    },
    {
      kind: "pause",
      title: "Stay Awhile",
      description: "Time with nowhere else to be.",
      startTime: "2026-07-26T16:00:00+09:00",
      durationMinutes: 75,
    },
  ],
  routes: [
    {
      fromMoment: 0,
      toMoment: 1,
      mode: "walk",
      durationMinutes: 12,
      distanceMeters: 850,
    },
  ],
  preparation: ["Wear comfortable shoes"],
  confidence: "medium",
  uncertainties: [],
  sources: [],
};

describe("sidequest contract", () => {
  it("accepts one to five moments instead of forcing three stops", () => {
    expect(sidequestSchema.safeParse(validSidequest).success).toBe(true);
    expect(() => assertSidequestIntegrity(validSidequest)).not.toThrow();
  });

  it("rejects a moment that spills beyond the promised window", () => {
    const invalid: Sidequest = {
      ...validSidequest,
      moments: [
        {
          ...validSidequest.moments[0],
          startTime: "2026-07-26T17:30:00+09:00",
          durationMinutes: 60,
        },
      ],
      routes: [],
    };

    expect(() => assertSidequestIntegrity(invalid)).toThrow(/inside the Sidequest window/);
  });

  it("rejects routes that point to moments that do not exist", () => {
    const invalid: Sidequest = {
      ...validSidequest,
      routes: [{ ...validSidequest.routes[0], toMoment: 4 }],
    };

    expect(() => assertSidequestIntegrity(invalid)).toThrow(/missing moment/);
  });
});
