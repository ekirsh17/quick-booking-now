import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { CreateTypes, Options } from "canvas-confetti";

/** OpenAlert design tokens */
export const CONFETTI_COLORS = [
  "#4E8DFF",
  "#60a5fa",
  "#4BB543",
  "#FF914D",
  "#a855f7",
  "#f472b6",
  "#fbbf24",
  "#22c55e",
];

export const BOOKING_CONFETTI_TIMING = {
  ticks: 130,
  phase2DelayMs: 70,
  phase3DelayMs: 170,
  phase3ParticleCount: 12,
  canvasFadeMs: 250,
} as const;

/** Prior shortened timing baseline for regression checks (~3.4s wall time). */
export const PREVIOUS_BOOKING_CONFETTI_TIMING = {
  ticks: 175,
  phase3DelayMs: 210,
  canvasFadeMs: 300,
} as const;

/** Previous timing baseline for regression checks (~5.3s wall time). */
export const LEGACY_BOOKING_CONFETTI_TIMING = {
  ticks: 300,
  phase3DelayMs: 280,
  canvasFadeMs: 0,
} as const;

export function getBookingConfettiMaxDurationMs(
  timing: Pick<typeof BOOKING_CONFETTI_TIMING, "phase3DelayMs" | "ticks" | "canvasFadeMs"> = BOOKING_CONFETTI_TIMING,
  assumedFps = 60,
): number {
  return timing.phase3DelayMs + (timing.ticks / assumedFps) * 1000 + timing.canvasFadeMs;
}

const BASE_OPTIONS: Options = {
  colors: CONFETTI_COLORS,
  disableForReducedMotion: true,
  shapes: ["square", "circle"],
  gravity: 1.1,
  ticks: BOOKING_CONFETTI_TIMING.ticks,
  scalar: 1.05,
};

/** Upper-center origin — near the confirmation header on ConsumerLayout */
const BURST_ORIGIN = { x: 0.5, y: 0.34 };

type ConfettiFire = CreateTypes;

function fireBookingSuccessConfetti(
  fire: ConfettiFire,
  timeouts: number[],
  isCancelled: () => boolean,
): Promise<undefined> | null {
  const animationDone = fire({
    ...BASE_OPTIONS,
    particleCount: 90,
    spread: 110,
    startVelocity: 48,
    decay: 0.9,
    origin: BURST_ORIGIN,
  });

  timeouts.push(
    window.setTimeout(() => {
      if (isCancelled()) return;
      fire({
        ...BASE_OPTIONS,
        particleCount: 55,
        spread: 130,
        startVelocity: 38,
        decay: 0.92,
        origin: BURST_ORIGIN,
      });
    }, BOOKING_CONFETTI_TIMING.phase2DelayMs),
  );

  timeouts.push(
    window.setTimeout(() => {
      if (isCancelled()) return;
      fire({
        ...BASE_OPTIONS,
        particleCount: BOOKING_CONFETTI_TIMING.phase3ParticleCount,
        spread: 80,
        startVelocity: 28,
        origin: { x: 0.5, y: 0.05 },
      });
    }, BOOKING_CONFETTI_TIMING.phase3DelayMs),
  );

  return animationDone;
}

function fadeOutAndRemoveCanvas(
  canvas: HTMLCanvasElement,
  timeouts: number[],
  fadeMs: number,
  onRemoved: () => void,
) {
  canvas.style.transition = `opacity ${fadeMs}ms ease-out`;
  canvas.style.opacity = "0";

  timeouts.push(
    window.setTimeout(() => {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      onRemoved();
    }, fadeMs),
  );
}

type BookingSuccessConfettiProps = {
  active: boolean;
};

export const BookingSuccessConfetti = ({ active }: BookingSuccessConfettiProps) => {
  const mountGenerationRef = useRef(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const generation = ++mountGenerationRef.current;
    const timeouts: number[] = [];
    let raf2 = 0;
    let canvas: HTMLCanvasElement | null = null;
    let fire: ConfettiFire | null = null;

    const isCancelled = () => generation !== mountGenerationRef.current;

    const cleanup = () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      timeouts.length = 0;
      if (fire) {
        fire.reset();
      }
      if (canvas?.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      fire = null;
    };

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (isCancelled()) return;

        canvas = document.createElement("canvas");
        canvas.style.position = "fixed";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "110";
        document.body.appendChild(canvas);

        fire = confetti.create(canvas, { resize: true, useWorker: false });
        const animationDone = fireBookingSuccessConfetti(fire, timeouts, isCancelled);

        void animationDone?.then(() => {
          if (isCancelled() || !canvas) return;

          fadeOutAndRemoveCanvas(
            canvas,
            timeouts,
            BOOKING_CONFETTI_TIMING.canvasFadeMs,
            () => {
              if (canvas) {
                canvas = null;
              }
              fire = null;
            },
          );
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      cleanup();
    };
  }, [active]);

  return null;
};
