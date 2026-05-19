import { parsePhoneNumberFromString } from "libphonenumber-js";

// Primary timezone per ISO country code. Covers our /signup country list plus
// a handful of likely fallthroughs. For multi-zone countries (US/CA/AU) we
// pick the most populous zone — IP geolocation gives us a sharper answer for
// web-signup users; this is the cold-text fallback.
const TIMEZONE_BY_REGION: Record<string, string> = {
  KR: "Asia/Seoul",
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  JP: "Asia/Tokyo",
  AU: "Australia/Sydney",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  IN: "Asia/Kolkata",
  ID: "Asia/Jakarta",
  IT: "Europe/Rome",
  MX: "America/Mexico_City",
  NL: "Europe/Amsterdam",
  NZ: "Pacific/Auckland",
  PH: "Asia/Manila",
  SG: "Asia/Singapore",
  LK: "Asia/Colombo",
  ES: "Europe/Madrid",
  SE: "Europe/Stockholm",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  // common extras
  BR: "America/Sao_Paulo",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  TW: "Asia/Taipei",
  MY: "Asia/Kuala_Lumpur",
  AE: "Asia/Dubai",
  IL: "Asia/Jerusalem",
  ZA: "Africa/Johannesburg",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
  TR: "Europe/Istanbul",
  RU: "Europe/Moscow",
  PL: "Europe/Warsaw",
  IE: "Europe/Dublin",
  PT: "Europe/Lisbon",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  BE: "Europe/Brussels",
  DK: "Europe/Copenhagen",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
};

export function timezoneFromPhone(phone: string): string | undefined {
  const parsed = parsePhoneNumberFromString(phone);
  const region = parsed?.country;
  if (!region) return undefined;
  return TIMEZONE_BY_REGION[region];
}

// "Tuesday 10:47pm" — concise enough for a prompt slot, easy for Sonnet to
// reason about (day-of-week + clock).
export function formatLocalTime(timezone: string, now: Date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return fmt.format(now).toLowerCase().replace(/\s+/g, " ").trim();
  } catch {
    return undefined;
  }
}

// Combines whatever silent context we have (city + local time) into one
// short line for the prompt. Returns undefined if we have nothing useful.
export function buildLocalContext(opts: {
  phone?: string;
  city?: string;
  timezone?: string;
}): string | undefined {
  const tz = opts.timezone ?? (opts.phone ? timezoneFromPhone(opts.phone) : undefined);
  const time = tz ? formatLocalTime(tz) : undefined;
  const city = opts.city?.trim();

  if (!time && !city) return undefined;
  if (time && city) return `it's ${time} for them in ${city}`;
  if (time) return `it's ${time} where they are`;
  return `they're in ${city}`;
}
