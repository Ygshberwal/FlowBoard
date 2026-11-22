import type { CSSProperties } from "react";

const COLORS = ["#6366f1", "#10b981", "#a78bfa", "#34d399"];
const PIECES = Array.from({ length: 20 }, (_, index) => ({
  left: `${5 + (index * 37) % 90}%`,
  backgroundColor: COLORS[index % COLORS.length],
  animationDelay: `${(index % 5) * 70}ms`,
  "--confetti-drift": `${(index % 2 ? 1 : -1) * (16 + index % 4 * 12)}px`,
  "--confetti-spin": `${(index % 2 ? 1 : -1) * (140 + index * 19)}deg`,
}) as CSSProperties);

// A short, local celebration: no overlay, sound, dependency, or focus changes.
export default function HabitCelebration() {
  return (
    <div aria-hidden="true" className="habit-confetti">
      {PIECES.map((style, index) => <span key={index} className="habit-confetti-piece" style={style} />)}
    </div>
  );
}
