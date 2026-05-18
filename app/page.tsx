import Image from "next/image";

import PixelBlast from "@/components/PixelBlast";
import { TextSidequestButton } from "@/components/TextSidequestButton";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <PixelBlast
          variant="square"
          color="#ff3dec"
          pixelSize={6}
          patternScale={3}
          patternDensity={0.9}
          pixelSizeJitter={0.4}
          speed={0.4}
          edgeFade={0.4}
          enableRipples
          transparent
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
          <Image
            src="/logo-mark.png"
            alt="sidequest"
            width={200}
            height={200}
            className="image-pixelated h-32 w-32 sm:h-44 sm:w-44"
            priority
          />

          <h1 className="font-[family-name:var(--font-pixelify-sans)] text-6xl font-bold leading-none tracking-tight text-pixel-yellow sm:text-8xl">
            sidequest
          </h1>

          <p className="font-[family-name:var(--font-pixelify-sans)] text-3xl font-bold leading-tight text-pixel-pink sm:text-5xl">
            text us.
            <br />
            we&apos;ll find u
            <br />
            something to do.
          </p>

          <p className="max-w-md font-[family-name:var(--font-vt323)] text-2xl leading-snug text-white sm:text-3xl">
            ur bored. we text u back a real-world plan — three stops, a budget,
            a backup if shit falls through. then u go do it.
          </p>

          <div className="mt-2">
            <TextSidequestButton />
          </div>

          <p className="font-[family-name:var(--font-vt323)] text-xl uppercase tracking-[0.3em] text-pixel-green sm:text-2xl">
            imessage only<span className="pixel-blink">_</span> no app
            <span className="pixel-blink">_</span> no account
          </p>
        </div>
      </div>
    </main>
  );
}
