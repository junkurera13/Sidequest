const PREFILLED_MESSAGE = "yo im bored";

function buildSmsHref(phone: string) {
  // `?&body=` works on both iOS (which prefers `&`) and Android (`?`).
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export function TextSidequestButton() {
  const phone = process.env.NEXT_PUBLIC_SIDEQUEST_PHONE;

  if (!phone) {
    return (
      <div className="inline-flex items-center gap-3 rounded-full border-2 border-stone-950 bg-stone-300 px-7 py-4 text-lg font-black uppercase tracking-[0.16em] text-stone-700 shadow-[6px_6px_0_#1c1917]">
        Coming soon
      </div>
    );
  }

  return (
    <a
      href={buildSmsHref(phone)}
      className="inline-flex items-center gap-3 rounded-full border-2 border-stone-950 bg-emerald-400 px-7 py-4 text-lg font-black uppercase tracking-[0.16em] text-stone-950 shadow-[6px_6px_0_#1c1917] transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#1c1917]"
    >
      text sidequest
      <span aria-hidden className="text-xl">→</span>
    </a>
  );
}
