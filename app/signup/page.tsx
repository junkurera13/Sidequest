"use client";

import Link from "next/link";
import { useState } from "react";

const PREFILLED_MESSAGE = "yo im bored";

function buildSmsHref(phone: string) {
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export default function SignupPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = (await res.json()) as {
        assignedPhone?: string;
        error?: string;
      };

      if (!res.ok || !data.assignedPhone) {
        setError(data.error ?? "something broke. try again.");
        setLoading(false);
        return;
      }

      window.location.href = buildSmsHref(data.assignedPhone);
    } catch {
      setError("network glitch. try again.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-pixel-yellow px-6 py-16 sm:px-10">
      <Link
        href="/"
        className="absolute left-6 top-6 font-[family-name:var(--font-vt323)] text-lg uppercase tracking-[0.3em] text-black underline decoration-2 underline-offset-4 sm:left-10 sm:top-10 sm:text-xl"
      >
        ← back
      </Link>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.svg"
          alt="sidequest"
          width={120}
          height={120}
          className="image-pixelated h-20 w-20 sm:h-24 sm:w-24"
        />

        <h1 className="mt-6 font-[family-name:var(--font-pixelify-sans)] text-4xl font-bold leading-none tracking-tight text-pixel-pink sm:text-5xl">
          welcome to
          <br />
          sidequest
        </h1>

        <p className="mt-4 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold leading-tight text-black sm:text-3xl">
          what&apos;s ur number?
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex w-full flex-col items-stretch gap-4"
        >
          <input
            type="tel"
            inputMode="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            autoFocus
            className="w-full border-4 border-black bg-white px-4 py-4 text-center font-[family-name:var(--font-pixelify-sans)] text-2xl text-black outline-none placeholder:text-stone-400"
          />

          {error && (
            <p className="font-[family-name:var(--font-pixelify-sans)] text-lg leading-snug text-pixel-pink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || phone.trim().length < 6}
            className="w-full border-4 border-black bg-pixel-pink px-6 py-4 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black transition-transform disabled:opacity-50 sm:text-3xl pixel-shadow-black"
          >
            {loading ? "setting up..." : "lock it in"}
          </button>
        </form>

        <p className="mt-6 max-w-xs font-[family-name:var(--font-vt323)] text-base leading-snug text-black sm:text-lg">
          we&apos;ll text u from ur own dedicated sidequest line. no spam, no
          ads, no signup beyond this.
        </p>
      </div>
    </main>
  );
}
