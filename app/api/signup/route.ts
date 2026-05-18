import { parsePhoneNumberFromString } from "libphonenumber-js";

type PhotonUserResponse = {
  succeed?: boolean;
  data?: {
    assignedPhoneNumber?: string;
  };
};

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

  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;

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
          phoneNumber: parsed.format("E.164"),
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

  return Response.json({ assignedPhone: assigned });
}
