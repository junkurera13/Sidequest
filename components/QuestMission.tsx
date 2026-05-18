import { buildMapSearchUrl } from "@/lib/quest";
import type { QuestRecord } from "@/lib/convexFunctions";

export function QuestMission({ quest }: { quest: QuestRecord }) {
  return (
    <main className="min-h-screen bg-[#f8f3e7] px-4 py-5 text-stone-950 sm:px-6 sm:py-8">
      <article className="mx-auto max-w-2xl overflow-hidden rounded-[1.75rem] border-2 border-stone-950 bg-[#fffaf0] shadow-[8px_8px_0_#1c1917]">
        <header className="border-b-2 border-stone-950 bg-emerald-400 px-5 py-5 sm:px-7">
          <p className="font-mono text-xs font-black uppercase tracking-[0.24em]">
            sidequest
          </p>
          <p className="mt-1 text-sm font-bold">text us. we&apos;ll find u something.</p>
          <h1 className="mt-8 text-4xl font-black leading-none tracking-tight sm:text-6xl">
            {quest.title}
          </h1>
        </header>

        <section className="border-b-2 border-stone-950 px-5 py-6 sm:px-7">
          <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-red-700">
            the plan
          </p>
          <p className="mt-3 text-xl font-extrabold leading-8">{quest.brief}</p>
        </section>

        <section className="divide-y-2 divide-stone-950">
          {quest.stops.map((stop, index) => (
            <div
              key={`${stop.name}-${index}`}
              className="grid gap-4 px-5 py-5 sm:grid-cols-[4.5rem_1fr] sm:px-7"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-stone-950 bg-red-400 font-mono text-xl font-black shadow-[3px_3px_0_#1c1917]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="text-2xl font-black tracking-tight">
                    {stop.name}
                  </h2>
                  <p className="w-fit rounded-full border-2 border-stone-950 bg-white px-3 py-1 font-mono text-xs font-black">
                    {stop.estimatedCost}
                  </p>
                </div>
                <p className="mt-3 text-base font-medium leading-7 text-stone-700">
                  {stop.description}
                </p>
                <a
                  href={buildMapSearchUrl(stop.mapSearch)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border-2 border-stone-950 bg-stone-950 px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_#ef4444] transition hover:-translate-y-0.5"
                >
                  open maps
                </a>
              </div>
            </div>
          ))}
        </section>

        <section className="grid border-y-2 border-stone-950 sm:grid-cols-2">
          <div className="border-b-2 border-stone-950 bg-white px-5 py-5 sm:border-r-2 sm:border-b-0 sm:px-7">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-stone-500">
              total
            </p>
            <p className="mt-2 text-2xl font-black">{quest.budget}</p>
          </div>
          <div className="bg-emerald-100 px-5 py-5 sm:px-7">
            <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-stone-500">
              backup
            </p>
            <p className="mt-2 text-base font-bold leading-7">
              {quest.backup}
            </p>
          </div>
        </section>

        <section className="px-5 py-6 sm:px-7">
          <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-stone-500">
            text a friend
          </p>
          <blockquote className="mt-3 rounded-3xl border-2 border-dashed border-stone-950 bg-white p-4 text-lg font-black leading-7">
            {quest.inviteText}
          </blockquote>
        </section>
      </article>
    </main>
  );
}
