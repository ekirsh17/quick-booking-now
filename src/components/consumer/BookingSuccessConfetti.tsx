import { useEffect } from "react";
import type { Options } from "canvas-confetti";

/** OpenAlert design tokens */
const CONFETTI_COLORS = [
  "#4E8DFF",
  "#60a5fa",
  "#4BB543",
  "#FF914D",
  "#a855f7",
  "#f472b6",
  "#fbbf24",
  "#22c55e",
];

const BASE_OPTIONS: Options = {
  colors: CONFETTI_COLORS,
  disableForReducedMotion: true,
  zIndex: 110,
  shapes: ["square"],
  gravity: 1.1,
  ticks: 320,
  scalar: 1.05,
};

/** Upper-center origin — near the confirmation header on ConsumerLayout */
const BURST_ORIGIN = { x: 0.5, y: 0.34 };

type ConfettiFire = (options?: Options) => Promise<undefined> | null;

function fireBookingSuccessConfetti(
  confetti: ConfettiFire,
  timeouts: number[],
  isCancelled: () => boolean,
) {
  confetti({
    ...BASE_OPTIONS,
    particleCount: 90,
    spread: 110,
    startVelocity: 48,
    origin: BURST_ORIGIN,
  });

  timeouts.push(
    window.setTimeout(() => {
      if (isCancelled()) return;
      confetti({
        ...BASE_OPTIONS,
        particleCount: 55,
        spread: 130,
        startVelocity: 38,
        decay: 0.92,
        origin: BURST_ORIGIN,
      });
    }, 120),
  );

  timeouts.push(
    window.setTimeout(() => {
      if (isCancelled()) return;
      confetti({
        ...BASE_OPTIONS,
        particleCount: 35,
        spread: 80,
        startVelocity: 28,
        origin: { x: 0.5, y: 0.05 },
      });
    }, 280),
  );
}

type BookingSuccessConfettiProps = {
  active: boolean;
};

export const BookingSuccessConfetti = ({ active }: BookingSuccessConfettiProps) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    const timeouts: number[] = [];
    let raf2 = 0;
    const isCancelled = () => cancelled;

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;

        void import("canvas-confetti")
          .then(({ default: confetti }) => {
            if (cancelled) return;
            fireBookingSuccessConfetti(confetti, timeouts, isCancelled);
          })
          .catch((error) => {
            console.error("[BookingSuccessConfetti] Failed to load confetti", error);
          });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [active]);

  return null;
};
