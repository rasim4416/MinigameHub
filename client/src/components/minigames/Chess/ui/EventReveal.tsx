import { useEffect, useRef, type CSSProperties } from "react";
import {
  getEventDescription,
  getEventFlavor,
  getEventName,
} from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import { EVENT_RARITY_META, type GameEvent } from "../events";
import "./chess-ui.css";

export function EventReveal({
  event,
  peaceTreatyLeft,
  onClose,
}: {
  event: GameEvent;
  peaceTreatyLeft: number;
  onClose: () => void;
}) {
  const lang = useChessLanguage();
  const tr = lang === "türkçe";
  const meta = EVENT_RARITY_META[event.rarity];
  const name = getEventName(event.id, lang);
  const description = getEventDescription(event.id, lang);
  const flavor = getEventFlavor(event.id, lang);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, [event.id]);

  const vars = {
    "--aug-border": meta.border,
    "--aug-glow": meta.glow,
    "--aug-text": meta.text,
    "--aug-badge": meta.badge,
  } as CSSProperties;

  return (
    <div className="augsel augsel--event" style={{ ...vars, zIndex: 95 }} role="dialog" aria-label={name}>
      <div className="augsel__floor" aria-hidden />
      <div className="augsel__head">
        <div className="augsel__badge augsel__badge--event">
          ⚡ {tr ? "Tahta olayı" : "Board event"}
        </div>
        <h2 className="augsel__title augsel__title--event">
          {tr ? "Kader zar attı" : "Fate rolled the dice"}
        </h2>
      </div>

      <div className={`aug aug--event aug--${event.rarity}`}>
        <div className="aug__flipper">
          <div className="aug__face aug__face--front">
            <span className="aug__foil" aria-hidden />
            <div className="aug__ribbon">{meta.label}</div>
            <div className="aug__medallion">
              <span className="aug__rays" aria-hidden />
              <span className="aug__icon">{event.icon}</span>
            </div>
            <h3 className="aug__name">{name}</h3>
            {flavor && <p className="aug__pun">“{flavor}”</p>}
            <span className="aug__divider" aria-hidden>
              ◆
            </span>
            <p className="aug__rules aug__rules--event">{description}</p>
            {event.id === "peace-treaty" && peaceTreatyLeft > 0 && (
              <span className="aug__counter">
                {peaceTreatyLeft} {tr ? "tur kaldı" : `round${peaceTreatyLeft === 1 ? "" : "s"} left`}
              </span>
            )}
          </div>
        </div>
      </div>

      <button ref={buttonRef} type="button" className="augsel__continue" onClick={onClose}>
        {tr ? "Devam" : "Bring it on"}
      </button>
    </div>
  );
}
