import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { Search } from "lucide-react";

// ── Select component ───────────────────────────────────────────────────────────
// Controlled custom select. SelectContent renders via portal so it is never
// clipped by overflow:hidden/auto on parent dialogs or scroll containers.

interface SelectCtx {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  disabled: boolean;
  registerLabel: (value: string, label: string) => void;
  labels: Record<string, string>;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const Ctx = createContext<SelectCtx>({
  value: "",
  onChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
  registerLabel: () => {},
  labels: {},
  triggerRef: { current: null },
});

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function Select({ value = "", onValueChange, disabled = false, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const registerLabel = useCallback((v: string, label: string) => {
    setLabels((prev) => (prev[v] === label ? prev : { ...prev, [v]: label }));
  }, []);

  return (
    <Ctx.Provider value={{ value, onChange: onValueChange ?? (() => {}), open, setOpen, disabled, registerLabel, labels, triggerRef }}>
      <div className="relative">{children}</div>
    </Ctx.Provider>
  );
}

export function SelectTrigger({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { open, setOpen, disabled, triggerRef } = useContext(Ctx);
  return (
    <button
      ref={triggerRef}
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
      <svg className="h-4 w-4 opacity-50 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = useContext(Ctx);
  const display = value ? (labels[value] ?? value) : null;
  return (
    <span className="flex-1 text-left truncate">
      {display ?? <span className="text-slate-400">{placeholder}</span>}
    </span>
  );
}

interface SelectContentProps {
  children?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function SelectContent({ children, searchable = false, searchPlaceholder = "Search..." }: SelectContentProps) {
  const { open, setOpen, triggerRef } = useContext(Ctx);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<React.CSSProperties>({});

  // Position under trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 9999,
    });
  }, [open, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  const filtered = searchable && query ? filterSelectItems(children, query) : children;

  return createPortal(
    <div
      ref={dropdownRef}
      style={style}
      className="rounded-md border border-slate-200 bg-white shadow-xl"
    >
      {searchable && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      )}
      <div className="max-h-52 overflow-auto">
        {filtered}
      </div>
    </div>,
    document.body
  );
}

// Helper: filter SelectItem children by text match
function filterSelectItems(children: React.ReactNode, query: string): React.ReactNode {
  const q = query.toLowerCase();
  return (
    <>
      {(Array.isArray(children) ? children : [children]).filter((child) => {
        if (!child || typeof child !== "object") return true;
        const c = child as React.ReactElement<{ children?: React.ReactNode }>;
        const label = extractText(c.props?.children);
        return label.toLowerCase().includes(q);
      })}
    </>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node && typeof node === "object" && "props" in (node as object)) {
    return extractText((node as React.ReactElement).props?.children);
  }
  return "";
}

interface SelectItemProps {
  value: string;
  children?: React.ReactNode;
}

export function SelectItem({ value, children }: SelectItemProps) {
  const { value: selected, onChange, setOpen, registerLabel } = useContext(Ctx);
  const isSelected = selected === value;

  useEffect(() => {
    const label = extractText(children);
    if (label) registerLabel(value, label);
  }, [value, children, registerLabel]);

  return (
    <div
      onClick={() => { onChange(value); setOpen(false); }}
      className={clsx(
        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors",
        isSelected && "bg-[#217346]/10 text-[#217346] font-medium"
      )}
    >
      {isSelected && (
        <svg className="w-3.5 h-3.5 shrink-0 text-[#217346]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {!isSelected && <span className="w-3.5 shrink-0" />}
      {children}
    </div>
  );
}
