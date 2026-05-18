import { buildMapSearchUrl } from "@/lib/quest";
import type { QuestRecord } from "@/lib/convexFunctions";

export function QuestMission({ quest }: { quest: QuestRecord }) {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="sidequest"
            width={64}
            height={64}
            className="image-pixelated h-12 w-12 shrink-0 sm:h-16 sm:w-16"
          />
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-green">
              sidequest
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-[0.95] tracking-tight text-pixel-yellow sm:text-5xl">
              {quest.title}
            </h1>
          </div>
        </header>

        <section className="border-4 border-pixel-yellow bg-black p-5 sm:p-6">
          <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-pink">
            the plan
          </p>
          <p className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-xl leading-snug sm:text-2xl">
            {quest.brief}
          </p>
        </section>

        <section className="flex flex-col gap-4">
          {quest.stops.map((stop, index) => (
            <div
              key={`${stop.name}-${index}`}
              className="border-4 border-pixel-pink bg-black p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-pixel-yellow font-[family-name:var(--font-pixelify-sans)] text-xl font-bold text-black sm:h-14 sm:w-14 sm:text-2xl">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h2 className="font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight text-pixel-yellow sm:text-3xl">
                      {stop.name}
                    </h2>
                    <p className="w-fit border-2 border-pixel-green px-2 py-1 font-[family-name:var(--font-vt323)] text-base uppercase tracking-wider text-pixel-green">
                      {stop.estimatedCost}
                    </p>
                  </div>
                  <p className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-lg leading-snug text-white sm:text-xl">
                    {stop.description}
                  </p>
                  <a
                    href={buildMapSearchUrl(stop.mapSearch)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 border-4 border-black bg-pixel-yellow px-4 py-2 font-[family-name:var(--font-pixelify-sans)] text-base font-bold uppercase tracking-wider text-black transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 sm:text-lg pixel-shadow-pink"
                  >
                    open maps
                    <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="border-4 border-white bg-black p-5 sm:p-6">
            <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-green">
              total
            </p>
            <p className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold text-pixel-yellow sm:text-4xl">
              {quest.budget}
            </p>
          </div>
          <div className="border-4 border-white bg-black p-5 sm:p-6">
            <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-green">
              backup
            </p>
            <p className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-lg leading-snug text-white sm:text-xl">
              {quest.backup}
            </p>
          </div>
        </section>

        <section className="border-4 border-dashed border-pixel-green bg-black p-5 sm:p-6">
          <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-green">
            text a friend
          </p>
          <blockquote className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-xl leading-snug text-white sm:text-2xl">
            &ldquo;{quest.inviteText}&rdquo;
          </blockquote>
        </section>

        <footer className="pt-2 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-pink">
            sdqst.fun<span className="pixel-blink">_</span>
          </p>
        </footer>
      </article>
    </main>
  );
}
