import { useToastStore } from "../../store/toastStore";

const KIND_STYLES: Record<string, string> = {
  success:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 ring-emerald-200 dark:ring-emerald-500/20",
  error:
    "bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-200 ring-red-200 dark:ring-red-500/20",
  info:
    "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 ring-slate-200 dark:ring-white/10",
};

const KIND_ICONS: Record<string, string> = {
  success: "M5 13l4 4L19 7",
  error: "M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.72-3L13.86 4a2 2 0 00-3.72 0L3.21 16a2 2 0 001.72 3z",
  info: "M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z",
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-50 top-4 right-4 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-xl ring-1 shadow-card px-3.5 py-2.5 min-w-[240px] max-w-sm animate-fade-in-up ${KIND_STYLES[t.kind]}`}
          role="status"
        >
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={KIND_ICONS[t.kind]}
            />
          </svg>
          <p className="text-sm font-medium flex-1 leading-snug break-words">
            {t.message}
          </p>
          <button
            onClick={() => dismiss(t.id)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
