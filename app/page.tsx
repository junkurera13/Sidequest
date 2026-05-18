import PixelBlast from "@/components/PixelBlast";
import { TextSidequestButton } from "@/components/TextSidequestButton";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-pixel-yellow">
      <div className="absolute inset-0 z-0">
        <PixelBlast
          variant="square"
          color="#ff3dec"
          pixelSize={6}
          patternScale={3}
          patternDensity={0.9}
          pixelSizeJitter={0.4}
          speed={0.4}
          edgeFade={0}
          enableRipples
          transparent
        />
      </div>

      {/* Yellow center mask — keeps the middle clean, lets the pink pattern
          show through at the corners/edges only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at center, #f8e600 35%, rgba(248,230,0,0.85) 55%, rgba(248,230,0,0) 90%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="flex w-full max-w-3xl -translate-y-4 flex-col items-center text-center sm:-translate-y-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="sidequest"
            width={200}
            height={200}
            className="image-pixelated h-32 w-32 sm:h-44 sm:w-44"
          />

          <div className="-mt-2 flex flex-col items-center gap-10">
            <h1 className="font-[family-name:var(--font-pixelify-sans)] text-6xl font-bold leading-none tracking-tight text-pixel-pink sm:text-8xl">
              sidequest
            </h1>

            <p className="font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-tight text-black sm:text-5xl">
              life&apos;s too short
              <br />
              to not go on
              <br />
              a sidequest.
            </p>

            <div className="mt-2">
              <TextSidequestButton />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
