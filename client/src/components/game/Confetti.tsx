import { useEffect, useState } from "react";
import ReactConfetti from "react-confetti";

/** Lightweight full-viewport confetti for level-complete moments. */
export function Confetti() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!size.width) return null;

  return (
    <ReactConfetti
      width={size.width}
      height={size.height}
      numberOfPieces={140}
      recycle={false}
      gravity={0.28}
      style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" }}
    />
  );
}
