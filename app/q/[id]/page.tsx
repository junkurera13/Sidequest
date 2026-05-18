import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";

import { QuestMission } from "@/components/QuestMission";
import { getQuestByShortId } from "@/lib/convexFunctions";

export const dynamic = "force-dynamic";

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5">
      <div className="max-w-md border-4 border-pixel-pink bg-black p-6 pixel-shadow-yellow">
        <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-pink">
          offline
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold text-pixel-yellow">
          convex needs setup
        </h1>
        <p className="mt-3 font-[family-name:var(--font-vt323)] text-xl leading-snug text-white">
          {message}
        </p>
      </div>
    </main>
  );
}

export default async function QuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <SetupNotice message="Add NEXT_PUBLIC_CONVEX_URL to .env.local. Convex usually writes this when you run npx convex dev." />
    );
  }

  let quest;

  try {
    quest = await fetchQuery(getQuestByShortId, { shortId: id });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Could not fetch this mission file from Convex.";

    return <SetupNotice message={message} />;
  }

  if (!quest) {
    notFound();
  }

  return <QuestMission quest={quest} />;
}
