import { useEffect, useState } from "react";
import { useTutorial } from "./TutorialContext";
import { AugmentGuide } from "./AugmentGuide";
import { useChessLanguage } from "../ChessLanguageContext";

function TutorialUiHighlight({ target }: { target: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(`[data-tutorial-id="${target}"]`);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    update();
    const ro = new ResizeObserver(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const interval = window.setInterval(update, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(interval);
    };
  }, [target]);

  if (!rect) return null;

  const pad = 4;
  return (
    <div
      className="pointer-events-none fixed z-[95] rounded-lg border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse"
      style={{
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }}
    />
  );
}

export function TutorialOverlay() {
  const language = useChessLanguage();
  const tr = language === "türkçe";
  const {
    active,
    dialogueText,
    titleText,
    showNext,
    advanceDialogue,
    skipTutorial,
    highlightUi,
    step,
    stepIndex,
  } = useTutorial();
  const [visible, setVisible] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(t);
  }, [step?.id, dialogueText]);

  if (!active || !step) return null;

  return (
    <>
      {highlightUi?.map((t) => (
        <TutorialUiHighlight key={t} target={t} />
      ))}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[92] flex justify-center p-3 md:inset-y-0 md:mx-auto md:max-w-5xl md:items-center md:justify-end md:p-4">
        <div
          className={`pointer-events-auto max-h-[45dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-400/30 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur-sm transition-all duration-300 md:max-h-[80dvh] md:w-[19rem] lg:w-[21rem] ${
            visible
              ? "translate-y-0 opacity-100 md:translate-x-0"
              : "translate-y-4 opacity-0 md:translate-y-0 md:translate-x-4"
          }`}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-300">{tr ? "Ders" : "Field lesson"} {String(stepIndex + 1).padStart(2, "0")} · {titleText ?? (tr ? "Temeller" : "Fundamentals")}</span>
            <button type="button" onClick={() => setGuideOpen((open) => !open)} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:border-amber-400 hover:text-amber-200" aria-expanded={guideOpen}>{tr ? "Augment rehberi" : "Augment guide"}</button>
          </div>
          {guideOpen && <div className="mb-3"><AugmentGuide /></div>}
          {dialogueText && (
            <p className="m-0 text-sm leading-relaxed text-slate-200">
              {dialogueText}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {showNext && (
                <button
                  type="button"
                  onClick={advanceDialogue}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
                >
                  {tr ? "Devam et" : "Continue"}
                </button>
              )}
            </div>
            {skipConfirm ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{tr ? "Eğitim atlanacak mı?" : "Skip tutorial?"}</span>
                <button
                  type="button"
                  onClick={skipTutorial}
                  className="font-bold text-rose-400 hover:text-rose-300"
                >
                  {tr ? "Evet" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setSkipConfirm(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  {tr ? "Hayır" : "No"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSkipConfirm(true)}
                className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300"
              >
                {tr ? "Eğitimi atla" : "Skip tutorial"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
