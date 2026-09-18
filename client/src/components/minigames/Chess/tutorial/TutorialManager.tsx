import type { ReactNode } from "react";
import { TutorialProvider } from "./TutorialContext";
import { TutorialOverlay } from "./TutorialOverlay";
import { TUTORIAL_STEPS } from "./tutorialSteps";

export function TutorialManager({
  children,
  onExit,
}: {
  children: ReactNode;
  onExit: () => void;
}) {
  return (
    <TutorialProvider steps={TUTORIAL_STEPS} onExit={onExit}>
      {/* Reserve the side panel's width so the lesson card never sits on the board. */}
      <div className="flex w-full flex-col md:pr-[20.5rem] lg:pr-[22.5rem]">
        {children}
      </div>
      <TutorialOverlay />
    </TutorialProvider>
  );
}
