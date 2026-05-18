import { TextSidequestButton } from "@/components/TextSidequestButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f3e7] text-stone-950">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16 sm:px-10">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
          sidequest
        </p>
        <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          text us.
          <br />
          we&apos;ll find u
          <br />
          something to do.
        </h1>
        <p className="mt-6 max-w-xl text-lg font-semibold leading-7 text-stone-700 sm:text-xl">
          ur bored. we text u back a real-world plan — three stops, a budget,
          a backup if shit falls through. then u go do it.
        </p>

        <div className="mt-10">
          <TextSidequestButton />
        </div>

        <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          imessage only. no app. no account.
        </p>
      </section>
    </main>
  );
}
