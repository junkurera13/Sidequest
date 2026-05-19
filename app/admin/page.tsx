import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { listRecentQuests, type QuestRecord } from "@/lib/convexFunctions";

export const dynamic = "force-dynamic";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(timestamp));
}

function labelForSource(source: QuestRecord["source"]) {
  if (!source) return "unknown";
  return source;
}

function QuestRow({ quest }: { quest: QuestRecord }) {
  const initial = quest.initialRequest ?? quest.request;

  return (
    <article className="border-4 border-black bg-white p-4 pixel-shadow-black">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-2 border-black bg-pixel-yellow px-2 py-1 font-[family-name:var(--font-vt323)] text-sm uppercase text-black">
              {labelForSource(quest.source)}
            </span>
            <span className="font-[family-name:var(--font-vt323)] text-lg text-black">
              {formatDate(quest.createdAt)}
            </span>
          </div>

          <h2 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight text-pixel-pink sm:text-3xl">
            {quest.title}
          </h2>

          <p className="mt-2 font-mono text-sm text-stone-700">
            {quest.phone ?? "no phone linked"}
          </p>
        </div>

        <Link
          href={`/q/${quest.shortId}`}
          className="w-fit border-2 border-black bg-pixel-pink px-3 py-2 font-[family-name:var(--font-pixelify-sans)] text-lg font-bold text-black"
        >
          open
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="font-[family-name:var(--font-vt323)] text-lg uppercase text-stone-500">
            initial
          </p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-sm leading-6 text-black">
            {initial}
          </p>
        </div>

        <div>
          <p className="font-[family-name:var(--font-vt323)] text-lg uppercase text-stone-500">
            follow-up
          </p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-sm leading-6 text-black">
            {quest.followupAnswer ?? "none"}
          </p>
        </div>
      </div>

      <details className="mt-5">
        <summary className="cursor-pointer font-[family-name:var(--font-vt323)] text-lg uppercase text-black">
          mission preview
        </summary>
        <div className="mt-3 space-y-3 border-t-2 border-black pt-3">
          <p className="font-mono text-sm leading-6 text-stone-800">
            {quest.brief}
          </p>
          <ol className="space-y-2">
            {quest.stops.map((stop, index) => (
              <li
                key={`${quest.shortId}-${index}`}
                className="font-mono text-sm text-black"
              >
                <span className="font-bold">{stop.name}</span> -{" "}
                {stop.estimatedCost}
              </li>
            ))}
          </ol>
        </div>
      </details>
    </article>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-pixel-yellow px-5 py-10">
      <div className="mx-auto max-w-xl border-4 border-black bg-white p-6 pixel-shadow-black">
        <h1 className="font-[family-name:var(--font-pixelify-sans)] text-4xl font-bold text-pixel-pink">
          admin offline
        </h1>
        <p className="mt-3 font-mono text-sm leading-6 text-black">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <SetupNotice message="missing NEXT_PUBLIC_CONVEX_URL. run npx convex dev or set the env var." />
    );
  }

  let quests: QuestRecord[];

  try {
    quests = await fetchQuery(listRecentQuests, { limit: 50 });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "could not load recent quests from convex.";
    return <SetupNotice message={message} />;
  }

  return (
    <main className="min-h-screen bg-pixel-yellow px-5 py-8 text-black sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-vt323)] text-xl uppercase text-black">
              sidequest admin
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-5xl font-bold leading-none text-pixel-pink sm:text-7xl">
              recent quests
            </h1>
          </div>
          <p className="font-[family-name:var(--font-vt323)] text-2xl text-black">
            {quests.length} shown
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/admin/generate"
            className="inline-flex border-2 border-black bg-white px-4 py-3 font-[family-name:var(--font-pixelify-sans)] text-lg font-bold text-black pixel-shadow-black"
          >
            manual generator
          </Link>
        </div>

        <div className="mt-8 grid gap-5">
          {quests.length === 0 ? (
            <div className="border-4 border-black bg-white p-6 pixel-shadow-black">
              <p className="font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold text-black">
                no quests yet
              </p>
            </div>
          ) : (
            quests.map((quest) => (
              <QuestRow key={quest.shortId} quest={quest} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
