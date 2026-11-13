"use client";

import { useEffect, useState } from "react";
import { BlackHoleHeroSection } from "@/components/ui/blackhole-hero-section";

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
 * A hero built around the picture rather than laid on top of it.
 *
 * The hole is pushed off centre with `focus`, so the busy half and the reading
 * half never overlap, and `scrim` darkens only the edge the copy sits on. A
 * flat overlay could not do that without greying the halo as well.
 *
 * A phone has no room to stand the two side by side, so there the whole thing
 * turns through 90°: hole low, copy high, veil from the top — and the ray
 * count drops, because a phone pays for every step.
 */
export default function BlackHoleHeroSectionDemo() {
  const narrow = useNarrow();

  return (
    <section className="relative min-h-[92svh] w-full md:min-h-[720px]">
      <BlackHoleHeroSection
        // A phone has no room to stand the art beside the copy, so the
        // arrangement turns through 90°: copy at the top under a veil, the
        // hole low and whole in the bottom third. Not pushed off the edge —
        // half a hole reads as a mistake, and the empty middle it leaves reads
        // as a bug. A wider field makes up the room the narrow frame lost.
        focus={narrow ? [0.5, 0.76] : [0.72, 0.46]}
        scrim={narrow ? "top" : "left"}
        scrimStrength={0.9}
        distance={24}
        elevation={narrow ? -7 : -5.5}
        fov={narrow ? 58 : 42}
        glow={narrow ? 0.85 : 1}
        steps={narrow ? 200 : 300}
        resolution={narrow ? 0.6 : 0.7}
      >
        <div className="flex h-full min-h-[92svh] items-start px-6 pt-14 sm:px-10 md:min-h-[720px] md:items-center md:pt-0 lg:px-20">
          <div className="max-w-[34rem]">
            <h1 className="text-[2.5rem] font-light leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.25rem]">
              Light does not
              <br />
              leave here
            </h1>

            <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-white/60 md:mt-7">
              The ring above the shadow is the far side of the disc, bent over
              the top. Nothing put it there but gravity.
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
      </BlackHoleHeroSection>
    </section>
  );
}