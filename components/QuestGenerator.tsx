"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";

import { generateQuest } from "@/lib/convexFunctions";

const exampleRequest =
  "I’m free tonight in Seoul, ₩30k budget, solo, surprise me.";

export function QuestGenerator() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(
    () => (convexUrl ? new ConvexHttpClient(convexUrl) : null),
    [convexUrl],
  );
  const [request, setRequest] = useState(exampleRequest);
  const [result, setResult] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!client) {
      setError("Missing NEXT_PUBLIC_CONVEX_URL. Run npx convex dev first.");
      return;
    }

    if (request.trim().length < 8) {
      setError("Give Sidequest a little more intel before dispatch.");
      return;
    }

    setIsLoading(true);

    try {
      const generated = await client.action(generateQuest, {
        request: request.trim(),
        source: "admin",
      });
      setResult(generated);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The mission printer jammed. Try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
      <div className="mb-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
            Sidequest internal
          </p>
          <h1 className="mt-3 break-words text-3xl font-black tracking-tight text-stone-950 sm:text-6xl">
            Mission file generator
          </h1>
        </div>
        <p className="max-w-xs text-sm font-semibold text-stone-600">
          Text us. Get a mission.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={handleSubmit}
          className="w-[calc(100vw-4rem)] min-w-0 rounded-[2rem] border-2 border-stone-950 bg-stone-50 p-4 shadow-[8px_8px_0_#1c1917] sm:w-full sm:p-6"
        >
          <label
            htmlFor="request"
            className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-stone-500"
          >
            Incoming boredom report
          </label>
          <textarea
            id="request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={8}
            className="mt-3 w-full min-w-0 resize-none rounded-3xl border-2 border-stone-900 bg-white p-4 text-base leading-7 text-stone-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-200"
            placeholder={exampleRequest}
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full rounded-full border-2 border-stone-950 bg-emerald-400 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-stone-950 shadow-[4px_4px_0_#1c1917] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1c1917] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
          >
            {isLoading ? "Mission file incoming..." : "Generate Quest"}
          </button>
        </form>

        <aside className="w-[calc(100vw-4rem)] min-w-0 rounded-[2rem] border-2 border-stone-950 bg-stone-950 p-5 text-stone-50 shadow-[8px_8px_0_#10b981] sm:w-full sm:p-6">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            Dispatch status
          </p>

          <div className="mt-8 space-y-5">
            <p className="text-2xl font-black">Case accepted.</p>
            <p className="text-sm leading-6 text-stone-300">
              Paste a bored-human request, press the button, and Sidequest will
              assign three checkpoints with budget notes and map searches.
            </p>

            {isLoading && (
              <div className="rounded-3xl border border-emerald-300/40 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
                Consulting the mission desk. Stand by.
              </div>
            )}

            {error && (
              <div className="rounded-3xl border border-red-300/50 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
                {error}
              </div>
            )}

            {result && (
              <div className="rounded-3xl border border-emerald-300/50 bg-emerald-300/10 p-4">
                <p className="text-sm font-semibold text-emerald-100">
                  Mission file ready:
                </p>
                <a
                  href={result.url}
                  className="mt-2 block break-all font-mono text-lg font-black text-white underline decoration-emerald-300 decoration-2 underline-offset-4"
                >
                  {result.url}
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
