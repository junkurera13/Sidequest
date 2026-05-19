"use client";

import { useMemo, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import Link from "next/link";

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
      setError("missing NEXT_PUBLIC_CONVEX_URL. run npx convex dev first.");
      return;
    }

    if (request.trim().length < 8) {
      setError("need more intel before dispatch.");
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
          : "mission printer jammed. try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 text-black sm:px-8">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-xl uppercase text-black">
            sidequest admin
          </p>
          <h1 className="mt-2 break-words font-[family-name:var(--font-pixelify-sans)] text-5xl font-bold leading-none text-pixel-pink sm:text-7xl">
            manual dispatch
          </h1>
        </div>
        <Link
          href="/admin"
          className="w-fit border-2 border-black bg-white px-4 py-3 font-[family-name:var(--font-pixelify-sans)] text-lg font-bold text-black pixel-shadow-black"
        >
          recent quests
        </Link>
      </div>

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={handleSubmit}
          className="min-w-0 border-4 border-black bg-white p-4 pixel-shadow-black sm:p-6"
        >
          <label
            htmlFor="request"
            className="font-[family-name:var(--font-vt323)] text-xl uppercase text-stone-500"
          >
            incoming text
          </label>
          <textarea
            id="request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={8}
            className="mt-3 w-full min-w-0 resize-none border-4 border-black bg-pixel-yellow p-4 font-[family-name:var(--font-pixelify-sans)] text-xl leading-snug text-black outline-none focus:bg-white sm:text-2xl"
            placeholder={exampleRequest}
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full border-4 border-black bg-pixel-pink px-5 py-4 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase text-black transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-300 pixel-shadow-black"
          >
            {isLoading ? "mission file incoming..." : "generate quest"}
          </button>
        </form>

        <aside className="min-w-0 border-4 border-black bg-black p-5 text-white pixel-shadow-black sm:p-6">
          <p className="font-[family-name:var(--font-vt323)] text-xl uppercase text-pixel-green">
            operator notes
          </p>

          <div className="mt-6 space-y-5">
            <p className="font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-none text-pixel-yellow">
              case accepted.
            </p>
            <p className="font-mono text-sm leading-6 text-stone-300">
              use this when you want to test the quest brain without texting
              the agent. paste the user request exactly how they would send it.
              output is saved as an admin quest.
            </p>

            {isLoading && (
              <div className="border-4 border-pixel-green bg-black p-4 font-[family-name:var(--font-pixelify-sans)] text-xl text-pixel-green">
                consulting mission desk. stand by.
              </div>
            )}

            {error && (
              <div className="border-4 border-pixel-pink bg-black p-4 font-mono text-sm leading-6 text-pixel-pink">
                {error}
              </div>
            )}

            {result && (
              <div className="border-4 border-pixel-green bg-black p-4">
                <p className="font-[family-name:var(--font-vt323)] text-xl uppercase text-pixel-green">
                  mission file ready
                </p>
                <a
                  href={result.url}
                  className="mt-3 block break-all font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold text-pixel-yellow underline decoration-pixel-pink decoration-4 underline-offset-4"
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
