import { forwardRef, InputHTMLAttributes, useState } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showStrength?: boolean;
};

function scorePassword(pw: string): { score: number; label: string; hint: string } {
  if (!pw) return { score: 0, label: "", hint: "" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^\w\s]/.test(pw)) score += 1;
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong", "Very strong"];
  const hints = [
    "At least 8 characters required",
    "Add uppercase, digits, or symbols",
    "Add uppercase, digits, or symbols",
    "Add a symbol or make it longer",
    "Nice",
    "Excellent",
  ];
  return { score, label: labels[score] ?? "Weak", hint: hints[score] ?? "" };
}

const BAR_COLORS = [
  "bg-slate-200 dark:bg-slate-700",
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
];

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { showStrength = false, className, value, ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  const pwString = typeof value === "string" ? value : "";
  const strength = showStrength ? scorePassword(pwString) : null;

  return (
    <div>
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          value={value}
          type={show ? "text" : "password"}
          className={`w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908A3 3 0 0112 9c1.657 0 3 1.343 3 3 0 .512-.128.995-.354 1.417m1.855 1.855A10.05 10.05 0 0021.542 12c-1.274-4.057-5.064-7-9.542-7a9.97 9.97 0 00-1.85.171M3 3l18 18" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {strength && pwString.length > 0 && (
        <div className="mt-1.5">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < strength.score ? BAR_COLORS[strength.score] : BAR_COLORS[0]
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{strength.label}</span>
            {strength.hint && <> — {strength.hint}</>}
          </p>
        </div>
      )}
    </div>
  );
});

export default PasswordInput;
