import { ConvexHttpClient } from "convex/browser";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import { upsertUserByPhone } from "@/lib/convexFunctions";
import { clientIpFromHeaders, lookupIpGeo } from "@/lib/ipGeo";

type PhotonUserResponse = {
  succeed?: boolean;
  data?: {
    assignedPhoneNumber?: string;
  };
};

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function countryFromParsedPhone(region: string | undefined) {
  if (!region) return undefined;
  try {
    return COUNTRY_NAMES.of(region) ?? region;
  } catch {
    return region;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const phone =
    body && typeof body === "object" && "phone" in body
      ? (body as { phone: unknown }).phone
      : undefined;

  if (typeof phone !== "string" || phone.trim().length === 0) {
    return Response.json({ error: "phone required" }, { status: 400 });
  }

  const parsed = parsePhoneNumberFromString(phone.trim(), "US");
  if (!parsed?.isValid()) {
    return Response.json(
      { error: "that doesnt look like a valid phone number" },
      { status: 400 },
    );
  }

  const e164 = parsed.format("E.164");
  const country = countryFromParsedPhone(parsed.country);

  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!projectId || !projectSecret) {
    console.error("missing PHOTON_PROJECT_ID or PHOTON_PROJECT_SECRET");
    return Response.json(
      { error: "server isn't configured. try again later." },
      { status: 500 },
    );
  }

  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");

  let photonRes: Response;
  try {
    photonRes = await fetch(
      `https://spectrum.photon.codes/projects/${projectId}/users/`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "shared",
          phoneNumber: e164,
        }),
      },
    );
  } catch (cause) {
    console.error("photon signup network error:", cause);
    return Response.json(
      { error: "couldnt reach the messaging service. try again." },
      { status: 502 },
    );
  }

  const photonBody = (await photonRes.json().catch(() => ({}))) as
    | PhotonUserResponse
    | { error?: { message?: string } };

  if (!photonRes.ok) {
    console.error("photon signup failed:", photonRes.status, photonBody);
    return Response.json(
      { error: "couldnt set up your sidequest line. try again." },
      { status: 502 },
    );
  }

  const assigned = (photonBody as PhotonUserResponse).data?.assignedPhoneNumber;
  if (!assigned) {
    console.error("photon response missing assignedPhoneNumber:", photonBody);
    return Response.json(
      { error: "messaging service returned an unexpected response." },
      { status: 502 },
    );
  }

  // Silently resolve a rough city from the requester's IP. This is the
  // "magic moment" — the agent later acts as if it knows where they are
  // without ever having asked. Best-effort, no permission prompt.
  const ip = clientIpFromHeaders(request.headers);
  const geo = ip ? await lookupIpGeo(ip) : undefined;

  // Create / update the Convex user record. Best-effort: if it fails the
  // user can still text the agent and we'll create them on first message.
  if (convexUrl) {
    try {
      const convex = new ConvexHttpClient(convexUrl);
      await convex.mutation(upsertUserByPhone, {
        phone: e164,
        country,
        currentCity: geo?.city,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        assignedPhone: assigned,
        signedUpAt: Date.now(),
      });
    } catch (cause) {
      console.error("convex upsert during signup failed:", cause);
    }
  } else {
    console.error("missing NEXT_PUBLIC_CONVEX_URL — skipping convex upsert");
  }

  return Response.json({ assignedPhone: assigned });
}
