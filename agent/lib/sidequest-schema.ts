import { z } from "zod";

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const verifiedPlaceSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  coordinates: coordinatesSchema,
  googleMapsUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
});

const momentSchema = z.object({
  kind: z.enum(["place", "activity", "transition", "pause", "surprise"]),
  title: z.string().min(1).max(90),
  description: z.string().min(1).max(500),
  startTime: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive().max(720),
  place: verifiedPlaceSchema.optional(),
  estimatedCost: z
    .object({
      amount: z.number().nonnegative(),
      currency: z.string().length(3),
      basis: z.enum(["verified", "estimated"]),
    })
    .optional(),
});

const routeSchema = z.object({
  fromMoment: z.number().int().nonnegative(),
  toMoment: z.number().int().nonnegative(),
  mode: z.enum(["walk", "bicycle", "transit", "drive", "two_wheeler"]),
  durationMinutes: z.number().int().nonnegative(),
  distanceMeters: z.number().int().nonnegative(),
});

export const sidequestSchema = z.object({
  title: z.string().min(1).max(90),
  invitation: z.string().min(1).max(280),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  participants: z.string().min(1).max(160),
  moments: z.array(momentSchema).min(1).max(5),
  routes: z.array(routeSchema).max(4),
  weatherNote: z.string().max(280).optional(),
  preparation: z.array(z.string().min(1).max(180)).max(5),
  bookingNote: z.string().max(280).optional(),
  backupPlan: z
    .object({
      trigger: z.string().min(1).max(180),
      adjustment: z.string().min(1).max(500),
    })
    .optional(),
  confidence: z.enum(["high", "medium", "low"]),
  uncertainties: z.array(z.string().min(1).max(240)).max(6),
  sources: z.array(z.string().url()).max(12),
});

export type Sidequest = z.infer<typeof sidequestSchema>;

export function assertSidequestIntegrity(sidequest: Sidequest): void {
  const startsAt = Date.parse(sidequest.startsAt);
  const endsAt = Date.parse(sidequest.endsAt);
  if (endsAt <= startsAt) {
    throw new Error("Sidequest endsAt must be after startsAt.");
  }

  let previousStart = startsAt;
  sidequest.moments.forEach((moment, index) => {
    const momentStart = Date.parse(moment.startTime);
    const momentEnd = momentStart + moment.durationMinutes * 60_000;

    if (momentStart < startsAt || momentEnd > endsAt) {
      throw new Error(`Moment ${index} must fit inside the Sidequest window.`);
    }
    if (momentStart < previousStart) {
      throw new Error("Sidequest moments must be in chronological order.");
    }
    previousStart = momentStart;
  });

  sidequest.routes.forEach((route, index) => {
    if (route.fromMoment >= sidequest.moments.length || route.toMoment >= sidequest.moments.length) {
      throw new Error(`Route ${index} references a missing moment.`);
    }
    if (route.toMoment <= route.fromMoment) {
      throw new Error(`Route ${index} must move forward through the experience.`);
    }
  });
}
