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
      {children}
      <TutorialOverlay />
    </TutorialProvider>
  );
}
