import { useState } from "react";

/** Renders mercenary art with PNG→SVG fallback if a file is missing. */
export function MercenaryPieceImg({
  candidates,
  size,
}: {
  candidates: string[];
  size: number;
}) {
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      decoding="async"
      onError={() => {
        setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
      }}
      style={{
        width: size * 0.78,
        height: size * 0.78,
        objectFit: "contain",
        pointerEvents: "none",
        position: "relative",
        zIndex: 1,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
      }}
    />
  );
}
