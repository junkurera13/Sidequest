export async function readApiError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof body.error === "string") return body.error.slice(0, 500);
      if (body.error?.message) return body.error.message.slice(0, 500);
      if (body.message) return body.message.slice(0, 500);
    }

    return (await response.text()).slice(0, 500) || response.statusText;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export function secondsToMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return undefined;
  return Math.ceil(Number(match[1]) / 60);
}
