import { ReactNode, useEffect, useRef } from "react";

interface Props {
  children: ReactNode;
  labelledBy: string;
  describedBy?: string;
  onDismiss: () => void;
  busy?: boolean;
  panel?: boolean;
  className?: string;
}

// Native dialogs provide focus containment, Escape and focus restoration without
// an additional dependency. Panels stay alongside the board on wider screens.
export default function Dialog({ children, labelledBy, describedBy, onDismiss, busy = false, panel = false, className = "" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const media = window.matchMedia("(min-width: 768px)");
    const open = () => {
      if (dialog.open) dialog.close();
      if (panel && media.matches) dialog.show();
      else dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    };
    open();
    if (panel) media.addEventListener("change", open);
    return () => {
      media.removeEventListener("change", open);
      dialog.close();
    };
  }, [panel]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`app-dialog ${panel ? "app-panel" : ""} ${className}`}
      onKeyDown={(event) => {
        const dialog = event.currentTarget;
        if (event.key === "Escape" && !dialog.matches(":modal") && (event.target as HTMLElement).closest("dialog") === dialog) {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onDismiss();
          return;
        }
        if (event.key !== "Tab" || !dialog.matches(":modal") || (event.target as HTMLElement).closest("dialog") !== dialog) return;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'))
          .filter((element) => element.closest("dialog") === dialog && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onDismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
