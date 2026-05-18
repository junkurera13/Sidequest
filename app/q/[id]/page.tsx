import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";

import { QuestMission } from "@/components/QuestMission";
import { getQuestByShortId } from "@/lib/convexFunctions";

export const dynamic = "force-dynamic";

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f3e7] px-5">
      <div className="max-w-md rounded-[2rem] border-2 border-stone-950 bg-white p-6 shadow-[8px_8px_0_#1c1917]">
        <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-red-700">
          Mission desk offline
        </p>
        <h1 className="mt-3 text-3xl font-black">Convex needs setup.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-stone-700">
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
