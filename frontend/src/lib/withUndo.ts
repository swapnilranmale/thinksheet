import { toast } from "sonner";

// ── withUndo ──────────────────────────────────────────────────────────────────
// Optimistically updates the UI, then delays the actual API call by `duration` ms.
// If the user clicks "Undo" before the timer fires, the action is cancelled and
// `onUndo` is called to restore the UI.  On API failure, `onUndo` is also called.

export interface WithUndoOptions<T = void> {
  /** Toast message shown immediately, e.g. "Manager deleted" */
  label: string;
  /** Milliseconds before the API call fires. Default: 5000 */
  duration?: number;
  /** Restore the optimistic UI change (called on undo or API failure) */
  onUndo?: () => void | Promise<void>;
  /** The actual API call — executed after the delay */
  action: () => Promise<T>;
  /** Called after the action resolves successfully */
  onSuccess?: (result: T) => void;
  /** Called if the action throws (UI is already reverted via onUndo) */
  onError?: (err: unknown) => void;
}

export function withUndo<T = void>(options: WithUndoOptions<T>): void {
  const { label, duration = 5000, onUndo, action, onSuccess, onError } = options;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;

  const toastId = toast(label, {
    duration,
    action: onUndo
      ? {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            clearTimeout(timer);
            Promise.resolve(onUndo())
              .then(() => {
                toast.dismiss(toastId);
                toast.success("Action undone");
              })
              .catch(() => toast.error("Could not undo"));
          },
        }
      : undefined,
  });

  timer = setTimeout(async () => {
    if (cancelled) return;
    try {
      const result = await action();
      onSuccess?.(result);
    } catch (err) {
      // Revert optimistic UI on API failure
      try { await onUndo?.(); } catch { /* ignore */ }
      toast.dismiss(toastId);
      toast.error("Action failed — change reverted");
      onError?.(err);
    }
  }, duration);
}

// ── showUndoToast ─────────────────────────────────────────────────────────────
// For actions already executed server-side. Shows an undo toast; clicking "Undo"
// calls `onUndo` which should reverse the action (e.g. revert a status change).

export function showUndoToast(
  label: string,
  onUndo: () => void | Promise<void>,
  duration = 5000
): void {
  toast(label, {
    duration,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await onUndo();
          toast.success("Action undone");
        } catch {
          toast.error("Could not undo action");
        }
      },
    },
  });
}
