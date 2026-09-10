import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  TutorialBridge,
  TutorialEvent,
  TutorialRestrictions,
  TutorialStep,
} from "./types";
import { EMPTY_RESTRICTIONS } from "./types";
import {
  BLACK_PASS_FROM,
  BLACK_PASS_TO,
  BLACK_SECOND_PASS_FROM,
  BLACK_SECOND_PASS_TO,
} from "./tutorialSteps";
import { useChessLanguage } from "../ChessLanguageContext";

type TutorialContextValue = {
  active: boolean;
  stepIndex: number;
  step: TutorialStep | null;
  restrictions: TutorialRestrictions;
  dialogueText: string | null;
  titleText: string | null;
  dialoguePage: number;
  dialoguePageCount: number;
  showNext: boolean;
  registerBridge: (bridge: TutorialBridge | null) => void;
  emitEvent: (event: TutorialEvent) => void;
  advanceDialogue: () => void;
  skipTutorial: () => void;
  highlightUi: TutorialRestrictions["highlightUi"];
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({
  children,
  steps,
  onExit,
}: {
  children: ReactNode;
  steps: TutorialStep[];
  onExit: () => void;
}) {
  const language = useChessLanguage();
  const bridgeRef = useRef<TutorialBridge | null>(null);
  // ChessGame recreates its bridge as live game state changes. A tutorial
  // chapter must only run its entry script once, otherwise scripted black
  // replies are applied repeatedly.
  const enteredStepRef = useRef(-1);
  const autoPassPendingRef = useRef(false);
  const scriptedPassIndexRef = useRef(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [dialoguePage, setDialoguePage] = useState(0);
  const [dynamicRestrictions, setDynamicRestrictions] =
    useState<Partial<TutorialRestrictions>>({});

  const step = steps[stepIndex] ?? null;

  const restrictions = useMemo((): TutorialRestrictions => {
    if (!step) return EMPTY_RESTRICTIONS;
    return { ...step.restrictions, ...dynamicRestrictions };
  }, [step, dynamicRestrictions]);

  const dialogueLines = useMemo(() => {
    if (!step?.dialogue) return [];
    const localized = typeof step.dialogue === "object" && !Array.isArray(step.dialogue)
      ? step.dialogue[language] ?? step.dialogue.english ?? [] : step.dialogue;
    return Array.isArray(localized) ? localized : [localized];
  }, [step, language]);

  const dialogueText = dialogueLines[dialoguePage] ?? null;
  const title = step?.title;
  const localizedTitle = title && typeof title === "object" && !Array.isArray(title)
    ? title[language] ?? title.english ?? null : title ?? null;
  const titleText = Array.isArray(localizedTitle) ? localizedTitle[0] ?? null : localizedTitle;
  const dialoguePageCount = dialogueLines.length;
  const hasMoreDialogue = dialoguePage < dialoguePageCount - 1;

  const applyDynamicForStep = useCallback((s: TutorialStep) => {
    if (s.id === "use-what") {
      const bridge = bridgeRef.current;
      const sq = bridge?.findWhiteDPawnSquare() ?? ([5, 3] as [number, number]);
      setDynamicRestrictions({
        highlightSquares: [sq],
        allowSpellIds: ["what"],
        blockAllBoardInput: false,
        blockShopToggle: true,
      });
    } else {
      setDynamicRestrictions({});
    }
  }, []);

  const ensureWhiteTurn = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge || bridge.getTurn() === "white") return;
    bridge.executeScriptedMove(BLACK_PASS_FROM, BLACK_PASS_TO);
  }, []);

  const enterStep = useCallback(
    (index: number) => {
      const s = steps[index];
      if (!s) return;
      if (enteredStepRef.current === index) return;
      enteredStepRef.current = index;
      setDialoguePage(0);
      applyDynamicForStep(s);
      const bridge = bridgeRef.current;
      if (!bridge) return;

      const runOnEnter = () => {
        s.onEnter?.(bridge);
        if (s.id === "use-what") applyDynamicForStep(s);
      };

      if (s.ensureWhiteTurn) {
        // Completion events are emitted in the same call stack as a move. Let
        // React commit that move first, then inspect the freshly registered
        // bridge before making the tutorial's harmless black reply.
        if (autoPassPendingRef.current) return;
        autoPassPendingRef.current = true;
        window.setTimeout(() => {
          const currentBridge = bridgeRef.current;
          if (!currentBridge) {
            autoPassPendingRef.current = false;
            return;
          }
          if (currentBridge.getTurn() !== "white") {
            const isSecondPass = scriptedPassIndexRef.current > 0;
            scriptedPassIndexRef.current += 1;
            currentBridge.executeScriptedMove(
              isSecondPass ? BLACK_SECOND_PASS_FROM : BLACK_PASS_FROM,
              isSecondPass ? BLACK_SECOND_PASS_TO : BLACK_PASS_TO,
            );
            window.setTimeout(() => {
              autoPassPendingRef.current = false;
              if (bridgeRef.current) runOnEnter();
            }, 200);
            return;
          }
          autoPassPendingRef.current = false;
          runOnEnter();
        }, 0);
        return;
      }
      runOnEnter();
    },
    [steps, applyDynamicForStep],
  );

  const goToNextStep = useCallback(() => {
    const next = stepIndex + 1;
    if (next >= steps.length) {
      onExit();
      return;
    }
    setStepIndex(next);
    enterStep(next);
  }, [stepIndex, steps.length, onExit, enterStep]);

  const completeStep = useCallback(() => {
    goToNextStep();
  }, [goToNextStep]);

  const registerBridge = useCallback(
    (bridge: TutorialBridge | null) => {
      bridgeRef.current = bridge;
      if (bridge) enterStep(stepIndex);
    },
    [enterStep, stepIndex],
  );

  useEffect(() => {
    if (bridgeRef.current) enterStep(stepIndex);
  }, [stepIndex, enterStep]);

  const emitEvent = useCallback(
    (event: TutorialEvent) => {
      if (!step) return;
      const { completion } = step;
      if (completion.type === "move" && event.type === "move") completeStep();
      if (completion.type === "augment" && event.type === "augment") completeStep();
      if (completion.type === "spell" && event.type === "spell") completeStep();
      if (completion.type === "shop-buy" && event.type === "shop-buy")
        completeStep();
    },
    [step, completeStep],
  );

  const advanceDialogue = useCallback(() => {
    if (!step) return;
    if (hasMoreDialogue) {
      setDialoguePage((p) => p + 1);
      return;
    }
    if (step.completion.type === "next") {
      if (step.ensureWhiteTurn) {
        ensureWhiteTurn();
        window.setTimeout(completeStep, 100);
      } else {
        completeStep();
      }
    }
  }, [step, hasMoreDialogue, completeStep, ensureWhiteTurn]);

  const skipTutorial = useCallback(() => {
    onExit();
  }, [onExit]);

  useEffect(() => {
    if (step?.completion.type === "auto") {
      const t = window.setTimeout(onExit, 1800);
      return () => window.clearTimeout(t);
    }
  }, [step, onExit]);

  const showNext =
    !!step &&
    (hasMoreDialogue ||
      (step.advanceOn === "next" && step.completion.type === "next"));

  const value: TutorialContextValue = {
    active: true,
    stepIndex,
    step,
    restrictions,
    dialogueText,
    titleText,
    dialoguePage,
    dialoguePageCount,
    showNext,
    registerBridge,
    emitEvent,
    advanceDialogue,
    skipTutorial,
    highlightUi: restrictions.highlightUi,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    return {
      active: false,
      stepIndex: 0,
      step: null,
      restrictions: EMPTY_RESTRICTIONS,
      dialogueText: null,
      titleText: null,
      dialoguePage: 0,
      dialoguePageCount: 0,
      showNext: false,
      registerBridge: () => {},
      emitEvent: () => {},
      advanceDialogue: () => {},
      skipTutorial: () => {},
      highlightUi: undefined,
    };
  }
  return ctx;
}

export function useTutorialRestrictions(): TutorialRestrictions | null {
  const ctx = useContext(TutorialContext);
  if (!ctx?.active || !ctx.step) return null;
  return ctx.restrictions;
}

export function useTutorialEmit(): ((e: TutorialEvent) => void) | null {
  const ctx = useContext(TutorialContext);
  if (!ctx?.active) return null;
  return ctx.emitEvent;
}

export function useTutorialActive(): boolean {
  const ctx = useContext(TutorialContext);
  return !!ctx?.active;
}
