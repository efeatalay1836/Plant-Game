"use client";

/* ============================================================
   THE LAST GARDEN — "How to play" tutorial.
   A step-by-step dialog that opens on a player's first visit and
   from the "How to play" button. The wording lives in
   tutorial-steps.ts so it can be edited without touching this file.
   ============================================================ */

import { useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  ChevronLeft, ChevronRight, CircleHelp, CloudLightning, Droplets, Hand,
  HeartPulse, LayoutGrid, Sprout, Trophy, type LucideProps,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { TUTORIAL_LABELS, TUTORIAL_STEPS, type TutorialIcon } from "./tutorial-steps";

const STEP_ICONS: Record<TutorialIcon, ComponentType<LucideProps>> = {
  garden: Sprout,
  health: HeartPulse,
  turn: Hand,
  reservoir: Droplets,
  events: CloudLightning,
  neighbours: LayoutGrid,
  win: Trophy,
};

const SEEN_KEY = "tlg-tutorial-seen";

// Storage can be missing or throw (private browsing, blocked cookies).
// If we cannot read it, report "seen" so the tutorial never nags.
function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Nothing to do: the tutorial just shows again next visit.
  }
}

const noSubscribe = () => () => {};

export default function HowToPlay() {
  // The server has no localStorage, so it renders as "seen" (closed) and the
  // browser opens the dialog after hydration if this is a first visit.
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => true);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const open = choice ?? !seen;
  const last = TUTORIAL_STEPS.length - 1;
  const current = TUTORIAL_STEPS[step];
  const StepIcon = STEP_ICONS[current.icon];

  const setOpen = (next: boolean) => {
    if (next) setStep(0);
    else writeSeen();
    setChoice(next);
  };

  const goTo = (n: number) => setStep(Math.max(0, Math.min(last, n)));

  return (
    <>
      <button type="button" className="tlg-howto-btn" onClick={() => setOpen(true)}>
        <CircleHelp aria-hidden="true" />
        {TUTORIAL_LABELS.open}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="tlg-tutorial" initialFocus={nextRef}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") goTo(step + 1);
            if (e.key === "ArrowLeft") goTo(step - 1);
          }}>
          <div className="tlg-tut-top">
            <span className="tlg-tut-count">Step {step + 1} of {TUTORIAL_STEPS.length}</span>
            {step < last && (
              <Button variant="ghost" className="tlg-tut-skip" onClick={() => setOpen(false)}>
                {TUTORIAL_LABELS.skip}
              </Button>
            )}
          </div>

          <div className="tlg-tut-body" key={step}>
            <div className="tlg-tut-art" aria-hidden="true">
              <StepIcon strokeWidth={1.5} />
            </div>
            <DialogTitle className="tlg-tut-title">{current.title}</DialogTitle>
            <DialogDescription className="tlg-tut-text">{current.body}</DialogDescription>
          </div>

          <div className="tlg-tut-dots">
            {TUTORIAL_STEPS.map((s, i) => (
              <button key={i} type="button" className="tlg-tut-dot"
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => goTo(i)}>
                <span />
              </button>
            ))}
          </div>

          <div className="tlg-tut-nav">
            <Button variant="ghost" className="tlg-tut-back" disabled={step === 0}
              onClick={() => goTo(step - 1)}>
              <ChevronLeft aria-hidden="true" />
              {TUTORIAL_LABELS.back}
            </Button>
            {step < last ? (
              <Button ref={nextRef} className="tlg-tut-next" onClick={() => goTo(step + 1)}>
                {TUTORIAL_LABELS.next}
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : (
              <Button ref={nextRef} className="tlg-tut-next" onClick={() => setOpen(false)}>
                {TUTORIAL_LABELS.finish}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
