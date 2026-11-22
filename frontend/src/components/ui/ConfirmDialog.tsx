import { ReactNode, useId } from "react";
import Dialog from "./Dialog";

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  error,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-500 shadow-red-500/20"
      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20";

  return (
    <Dialog labelledBy={titleId} describedBy={description ? descriptionId : undefined} onDismiss={onCancel} busy={busy}>
      <div className="p-6">
        <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </div>
        )}
        {children && <div className="mt-3">{children}</div>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            autoFocus
            data-autofocus
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
