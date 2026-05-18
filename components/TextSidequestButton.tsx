"use client";

import { useState } from "react";

import Magnet from "@/components/Magnet";

const PREFILLED_MESSAGE = "yo im bored";

function buildSmsHref(phone: string) {
  // `?&body=` works on both iOS (which prefers `&`) and Android (`?`).
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export function TextSidequestButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Magnet padding={120} magnetStrength={3}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-4 border-4 border-black bg-pixel-pink px-8 py-5 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black transition-transform active:translate-x-0 active:translate-y-0 sm:text-3xl pixel-shadow-black"
        >
          text sidequest
          <span aria-hidden className="text-3xl">
            →
          </span>
        </button>
      </Magnet>

      {open && <SignupModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SignupModal({ onClose }: { onClose: () => void }) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border-4 border-black bg-pixel-yellow p-6 pixel-shadow-black sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-pixel-pink">
          one quick thing
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-tight text-black sm:text-4xl">
          drop ur number
        </h2>
        <p className="mt-3 font-[family-name:var(--font-pixelify-sans)] text-lg leading-snug text-black">
          we&apos;ll text u from ur own dedicated sidequest line. no spam, no
          ads, no signup beyond this.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="tel"
            inputMode="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            autoFocus
            className="w-full border-4 border-black bg-white px-4 py-3 font-[family-name:var(--font-pixelify-sans)] text-xl text-black outline-none placeholder:text-stone-400 focus:bg-white"
          />

          {error && (
            <p className="font-[family-name:var(--font-vt323)] text-lg leading-snug text-pixel-pink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || phone.trim().length < 6}
            className="w-full border-4 border-black bg-pixel-pink px-6 py-4 font-[family-name:var(--font-pixelify-sans)] text-xl font-bold uppercase tracking-wider text-black transition-transform disabled:opacity-50 sm:text-2xl pixel-shadow-black"
          >
            {loading ? "setting up..." : "lock it in"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="font-[family-name:var(--font-vt323)] text-base uppercase tracking-[0.3em] text-black underline decoration-2 underline-offset-4 disabled:opacity-50"
          >
            cancel
          </button>
        </form>
      </div>
    </div>
  );
}
