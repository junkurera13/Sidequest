import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "remove expired messaging delivery receipts",
  { hours: 1 },
  internal.messaging.removeExpiredDeliveries,
  {},
);

export default crons;
