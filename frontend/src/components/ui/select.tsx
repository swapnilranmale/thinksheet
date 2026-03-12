import { clsx } from "clsx";

// ── Minimal Select wrapper ─────────────────────────────────────────────────────
// Pages use the Shadcn pattern: <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem /></SelectContent></Select>
// We implement this as a controlled native <select> wrapped in the same component API.

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

// Context to pass value/onValueChange down
import { createContext, useContext, useState, useRef, useEffect } from "react";

interface SelectCtx {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  disabled: boolean;
  label: string;
  setLabel: (l: string) => void;
}
const Ctx = createContext<SelectCtx>({ value: "", onChange: () => {}, open: false, setOpen: () => {}, disabled: false, label: "", setLabel: () => {} });

export function Select({ value = "", onValueChange, disabled = false, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  return (
    <Ctx.Provider value={{ value, onChange: onValueChange ?? (() => {}), open, setOpen, disabled, label, setLabel }}>
      <div className="relative">{children}</div>
    </Ctx.Provider>
  );
}

export function SelectTrigger({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { open, setOpen, disabled } = useContext(Ctx);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      className={clsx(
        "flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-slate-400",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
      <svg className="h-4 w-4 opacity-50 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, label } = useContext(Ctx);
  const display = label || value;
  return (
    <span className="flex-1 text-left truncate">
      {display ? display : <span className="text-slate-400">{placeholder}</span>}
    </span>
  );
}

interface SelectContentProps { children?: React.ReactNode }
export function SelectContent({ children }: SelectContentProps) {
  const { open, setOpen } = useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  // Always render items (hidden when closed) so SelectItem useEffects can sync labels
  return (
    <>
      {/* Hidden item registry — always mounted so labels can be resolved */}
      <div className="hidden">{children}</div>
      {open && (
        <div
          ref={ref}
          className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto"
        >
          {children}
        </div>
      )}
    </>
  );
}

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
}
export function SelectItem({ value, children }: SelectItemProps) {
  const { value: selected, onChange, setOpen, setLabel } = useContext(Ctx);
  const isSelected = selected === value;
  const labelText = typeof children === "string" ? children : "";

  // Sync label for pre-selected value (e.g. edit dialogs opening with existing data)
  useEffect(() => {
    if (isSelected && labelText) setLabel(labelText);
  }, [isSelected, labelText]);

  return (
    <div
      onClick={() => {
        onChange(value);
        setLabel(labelText);
        setOpen(false);
      }}
      className={clsx(
        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors",
        isSelected && "bg-[#217346]/8 text-[#217346] font-medium"
      )}
    >
      {isSelected && (
        <svg className="w-3.5 h-3.5 shrink-0 text-[#217346]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
      )}
      {!isSelected && <span className="w-3.5 shrink-0" />}
      {children}
    </div>
  );
}
