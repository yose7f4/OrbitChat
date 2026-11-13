"use client";

import { useEffect, useState } from "react";
import { OrbitalHeroSection } from "@/components/ui/orbital-hero-section";

/** True while the viewport is narrow. Drives the layout swap below. */
function useNarrow(query = "(max-width: 767px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

/**
 * A hero built around the background rather than laid on top of it.
 *
 * Three things keep the copy readable without dimming the picture:
 *
 * 1. The Sun is pushed off centre with `focus`, so the busy half and the
 *    reading half never overlap.
 * 2. `scrim` darkens the edge the text sits on and fades out before the coils,
 *    which a flat overlay could not do without greying the whole frame.
 * 3. The text block is capped in width, so a long line never runs into the art.
 *
 * On a narrow screen there is no room to put those halves side by side, so the
 * whole thing turns through 90°: art low, copy high, veil from the top.
 */
export default function OrbitalHeroSectionDemo() {
  const narrow = useNarrow();

  return (
    <section className="relative min-h-[92svh] w-full md:min-h-[720px]">
      <OrbitalHeroSection
        focus={narrow ? [0.5, 0.86] : [0.74, 0.42]}
        scrim={narrow ? "top" : "left"}
        scrimStrength={narrow ? 0.94 : 0.92}
        viewRadius={narrow ? 2.1 : 3.1}
        lead={narrow ? 0.05 : 0.12}
        // A phone has no room to stand the art beside the copy: the text alone
        // takes most of the screen. So there it drops back to a quiet texture.
        glow={narrow ? 0.5 : 1}
      >
        <div className="flex h-full min-h-[92svh] items-start px-6 pt-14 sm:px-10 md:min-h-[720px] md:items-center md:pt-0 lg:px-20">
          <div className="max-w-[34rem]">
            <h1 className="text-[2.5rem] font-light leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.25rem]">
              Nothing here
              <br />
              stands still
            </h1>

            <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-white/60 md:mt-7">
              The Sun is running, and the planets chase it. Every track you see
              is a helix.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10">
              <a
                href="#"
                className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-white/90"
              >
                Get started
              </a>
              <a
                href="#"
                className="rounded-full border border-white/20 px-6 py-3 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
              >
                Read the maths
              </a>
            </div>
          </div>
        </div>
      </OrbitalHeroSection>
    </section>
  );
}
