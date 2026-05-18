import Magnet from "@/components/Magnet";

const PREFILLED_MESSAGE = "yo im bored";

function buildSmsHref(phone: string) {
  // `?&body=` works on both iOS (which prefers `&`) and Android (`?`).
  return `sms:${phone}?&body=${encodeURIComponent(PREFILLED_MESSAGE)}`;
}

export function TextSidequestButton() {
  const phone = process.env.NEXT_PUBLIC_SIDEQUEST_PHONE;

  if (!phone) {
    return (
      <span className="inline-flex items-center gap-3 border-4 border-black bg-white px-8 py-5 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black sm:text-3xl pixel-shadow-black">
        coming soon
      </span>
    );
  }

  return (
    <Magnet padding={120} magnetStrength={3}>
      <a
        href={buildSmsHref(phone)}
        className="group inline-flex items-center gap-4 border-4 border-black bg-pixel-pink px-8 py-5 font-[family-name:var(--font-pixelify-sans)] text-2xl font-bold uppercase tracking-wider text-black transition-transform active:translate-x-0 active:translate-y-0 sm:text-3xl pixel-shadow-black"
      >
        text sidequest
        <span aria-hidden className="text-3xl">→</span>
      </a>
    </Magnet>
  );
}
