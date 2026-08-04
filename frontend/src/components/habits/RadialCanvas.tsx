import { useRef, useEffect, useCallback } from "react";
import type { Habit } from "../../types/habit";
import { useHabitStore, isoDate } from "../../store/habitStore";

interface Props {
  habits: Habit[];
  logs: Record<string, string[]>;
  serverLogs: Record<string, string[]>;
  year: number;
  month: number;
  onToggled?: () => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function hitTest(
  x: number, y: number,
  innerR: number, outerR: number,
  ringWidth: number,
  totalDays: number,
  habitCount: number
): { habitIndex: number; day: number } | null {
  const r = Math.sqrt(x * x + y * y);
  if (r < innerR || r > outerR) return null;
  const habitIndex = Math.min(Math.floor((r - innerR) / ringWidth), habitCount - 1);
  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI + 90;
  if (angleDeg < 0) angleDeg += 360;
  if (angleDeg >= 360) angleDeg -= 360;
  const day = Math.min(Math.floor((angleDeg / 360) * totalDays) + 1, totalDays);
  return { habitIndex, day };
}

export default function RadialCanvas({ habits, logs, serverLogs, year, month, onToggled }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const tooltipRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef     = useRef(0);
  const { toggleLog } = useHabitStore();

  const totalDays = getDaysInMonth(year, month);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay  = isCurrentMonth ? today.getDate() : -1;
  // For future-day blocking: last allowed day
  const maxAllowedDay = isCurrentMonth
    ? today.getDate()
    : year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth())
      ? totalDays   // past month — all days allowed
      : 0;          // future month — no days allowed

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = sizeRef.current;
    if (size === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, size * dpr, size * dpr);

    const cx = (size / 2) * dpr;
    const cy = (size / 2) * dpr;
    const s  = dpr; // scale factor shorthand

    const labelGap   = 20 * s;
    const outerRadius = (size / 2) * s - labelGap - 4 * s;
    const innerRadius = outerRadius * 0.28;

    if (habits.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${13 * s}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add habits to start tracking", cx, cy);
      return;
    }

    const ringWidth = (outerRadius - innerRadius) / habits.length;

    // Radial grid lines
    for (let d = 0; d <= totalDays; d++) {
      const rad = toRad(-90 + (d / totalDays) * 360);
      ctx.beginPath();
      ctx.moveTo(cx + innerRadius * Math.cos(rad), cy + innerRadius * Math.sin(rad));
      ctx.lineTo(cx + (outerRadius + 2 * s) * Math.cos(rad), cy + (outerRadius + 2 * s) * Math.sin(rad));
      ctx.strokeStyle = "rgba(148,163,184,0.2)";
      ctx.lineWidth = 0.5 * s;
      ctx.stroke();
    }

    habits.forEach((habit, hi) => {
      const habitLogs = new Set(logs[habit.id] || []);
      const r1 = innerRadius + hi * ringWidth + 1.5 * s;
      const r2 = innerRadius + (hi + 1) * ringWidth - 1.5 * s;

      for (let d = 1; d <= totalDays; d++) {
        const isLogged  = habitLogs.has(isoDate(year, month, d));
        const isToday   = d === todayDay;
        const isFuture  = d > maxAllowedDay;

        const startAngle = toRad(-90 + ((d - 1) / totalDays) * 360);
        const endAngle   = toRad(-90 + (d / totalDays) * 360 - 0.6);

        ctx.beginPath();
        ctx.arc(cx, cy, r2, startAngle, endAngle);
        ctx.arc(cx, cy, r1, endAngle, startAngle, true);
        ctx.closePath();

        if (isFuture) {
          // Future: very faint grey, no color hint
          ctx.fillStyle = "rgba(226,232,240,0.4)";
        } else if (isLogged) {
          ctx.fillStyle = habit.color;
        } else {
          ctx.fillStyle = habit.color + "22";
        }
        ctx.fill();

        // Today ring highlight
        if (isToday) {
          ctx.strokeStyle = habit.color;
          ctx.lineWidth = 1.5 * s;
          ctx.stroke();
        }
      }
    });

    // Day number labels
    const labelR  = outerRadius + 11 * s;
    const fontSize = Math.max(8, Math.min(11, size * 0.028)) * s;

    for (let d = 1; d <= totalDays; d++) {
      const isFuture = d > maxAllowedDay;
      // Skip every other label on 30/31-day months to avoid crowding, but always show today
      if (totalDays > 28 && d % 2 === 0 && d !== todayDay) continue;

      const rad = toRad(-90 + ((d - 0.5) / totalDays) * 360);
      const x = cx + labelR * Math.cos(rad);
      const y = cy + labelR * Math.sin(rad);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (d === todayDay) {
        ctx.fillStyle = "#6366f1";
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      } else if (isFuture) {
        ctx.fillStyle = "rgba(148,163,184,0.35)";
        ctx.font = `${fontSize}px Inter, sans-serif`;
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = `${fontSize}px Inter, sans-serif`;
      }
      ctx.fillText(String(d), x, y);
    }

    // Center month/year
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${Math.round(size * 0.07 * s)}px Inter, sans-serif`;
    ctx.fillText(monthNames[month], cx, cy - size * 0.045 * s);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.round(size * 0.045 * s)}px Inter, sans-serif`;
    ctx.fillText(String(year), cx, cy + size * 0.045 * s);

  }, [habits, logs, year, month, totalDays, todayDay, maxAllowedDay]);

  // Resize observer — reset transform each time, never stack scale
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const logical = Math.min(container.clientWidth, container.clientHeight) - 8;
      if (logical <= 0) return;
      sizeRef.current = logical;
      canvas.width  = logical * dpr;
      canvas.height = logical * dpr;
      canvas.style.width  = `${logical}px`;
      canvas.style.height = `${logical}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
      draw();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw on data change
  useEffect(() => {
    if (sizeRef.current > 0) draw();
  }, [draw]);

  // Shared geometry for hit-test (CSS px)
  const getGeometry = useCallback(() => {
    const size = sizeRef.current;
    if (size === 0 || habits.length === 0) return null;
    const labelGap   = 20;
    const outerRadius = size / 2 - labelGap - 4;
    const innerRadius = outerRadius * 0.28;
    const ringWidth   = (outerRadius - innerRadius) / habits.length;
    return { size, outerRadius, innerRadius, ringWidth };
  }, [habits.length]);

  const getHit = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const geo = getGeometry();
      if (!canvas || !geo) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - geo.size / 2;
      const y = clientY - rect.top  - geo.size / 2;
      return hitTest(x, y, geo.innerRadius, geo.outerRadius, geo.ringWidth, totalDays, habits.length);
    },
    [getGeometry, totalDays, habits.length]
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const hit = getHit(e.clientX, e.clientY);
      if (!hit) return;

      // Block future days
      if (hit.day > maxAllowedDay) return;

      const habit = habits[hit.habitIndex];
      if (!habit) return;

      await toggleLog(habit.id, hit.day, serverLogs);
      onToggled?.();
    },
    [getHit, habits, toggleLog, serverLogs, maxAllowedDay, onToggled]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const hit = getHit(e.clientX, e.clientY);
      if (!hit) { tooltip.style.display = "none"; return; }

      const habit = habits[hit.habitIndex];
      if (!habit) { tooltip.style.display = "none"; return; }

      const isFuture = hit.day > maxAllowedDay;
      const isDone   = (logs[habit.id] || []).includes(isoDate(year, month, hit.day));

      tooltip.style.display = "block";
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top  = `${e.clientY - 36}px`;

      if (isFuture) {
        tooltip.innerHTML = `<span style="opacity:0.6">${habit.name} · Day ${hit.day} · Future date</span>`;
      } else {
        tooltip.innerHTML = `<strong>${habit.name}</strong> · Day ${hit.day} · ${isDone ? "✓ Done — click to undo" : "Click to mark done"}`;
      }
    },
    [getHit, habits, logs, maxAllowedDay]
  );

  const handleMouseLeave = useCallback(() => {
    const t = tooltipRef.current;
    if (t) t.style.display = "none";
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Hint */}
      <div className="flex-shrink-0 flex items-center justify-center pt-2 pb-1 gap-3">
        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          Click a ring segment to mark a habit done · Future days are disabled
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 p-2">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-pointer"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Legend */}
      {habits.length > 0 && (
        <div className="flex-shrink-0 flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-3">
          {habits.map((h, i) => (
            <div key={h.id} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
              <span className="text-[10px] text-slate-500">{i + 1}. {h.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
        style={{ display: "none" }}
      />
    </div>
  );
}
