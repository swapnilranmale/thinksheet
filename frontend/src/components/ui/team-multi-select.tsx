import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { ChevronDown, Search, Check } from "lucide-react";

export interface TeamOption {
  _id: string;
  team_name: string;
  unique_id?: string;
  department_id?: { department_name?: string };
}

interface TeamMultiSelectProps {
  teams: TeamOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  placeholder?: string;
}

export function TeamMultiSelect({
  teams,
  selectedIds,
  onChange,
  error,
  placeholder = "Select teams...",
}: TeamMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position dropdown via portal
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, [open]);

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
  }, [open]);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  const filtered = query
    ? teams.filter((t) =>
        t.team_name.toLowerCase().includes(query.toLowerCase()) ||
        t.unique_id?.toLowerCase().includes(query.toLowerCase()) ||
        t.department_id?.department_name?.toLowerCase().includes(query.toLowerCase())
      )
    : teams;

  const selectedNames = teams
    .filter((t) => selectedIds.includes(t._id))
    .map((t) => t.team_name);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-[#217346]",
          error ? "border-red-400 bg-red-50" : "border-slate-300"
        )}
      >
        <span className="flex-1 text-left truncate">
          {selectedNames.length > 0 ? (
            <span className="text-slate-800">{selectedNames.join(", ")}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selectedIds.length > 0 && (
            <span className="text-xs bg-[#217346] text-white rounded-full px-1.5 py-0.5 font-medium leading-none">
              {selectedIds.length}
            </span>
          )}
          <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown via portal — renders outside dialog overflow */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded-md border border-slate-200 bg-white shadow-xl"
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams..."
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No teams found</p>
            ) : (
              filtered.map((team) => {
                const checked = selectedIds.includes(team._id);
                return (
                  <div
                    key={team._id}
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before toggle
                    onClick={() => toggle(team._id)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className={clsx(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      checked ? "bg-[#217346] border-[#217346]" : "border-slate-300 bg-white"
                    )}>
                      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.team_name}</p>
                      {(team.unique_id || team.department_id?.department_name) && (
                        <p className="text-xs text-slate-400">
                          {[team.unique_id, team.department_id?.department_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
