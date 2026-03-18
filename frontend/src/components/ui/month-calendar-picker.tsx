/**
 * MonthCalendarPicker
 * A full date-grid calendar picker for selecting a month+year period.
 * month prop is 0-indexed (0 = January, 11 = December) to match JS Date.
 * Shows a full 7-column calendar grid; clicking any day selects that month+year.
 */
import { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

const MONTHS_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

const NOW = new Date();
const TODAY_D = NOW.getDate();
const TODAY_M = NOW.getMonth();   // 0-indexed
const TODAY_Y = NOW.getFullYear();

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns the weekday index (0=Mon, 6=Sun) for the 1st of the given month */
function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // convert to Mon=0
}

interface MonthCalendarPickerProps {
  /** 0-indexed month (0 = Jan, 11 = Dec) */
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  disabled?: boolean;
  /** optional max year limit (defaults to current year + 1) */
  maxYear?: number;
  /** placement of the dropdown */
  align?: "left" | "right";
}

export function MonthCalendarPicker({
  month, year, onChange, disabled, maxYear, align = "right",
}: MonthCalendarPickerProps) {
  const [open, setOpen] = useState(false);
  // viewMonth/Year = what the calendar is currently showing (navigation)
  const [viewMonth, setViewMonth] = useState(month);
  const [viewYear, setViewYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  const maxY = maxYear ?? TODAY_Y + 1;

  // Sync view when external month/year changes
  useEffect(() => {
    if (open) { setViewMonth(month); setViewYear(year); }
  }, [open, month, year]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewYear >= maxY && viewMonth >= 11) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number, mOffset: number) {
    let m = viewMonth + mOffset;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    onChange(m, y);
    setOpen(false);
  }

  function selectThisMonth() { onChange(TODAY_M, TODAY_Y); setOpen(false); }
  function selectLastMonth() {
    const lm = TODAY_M === 0 ? 11 : TODAY_M - 1;
    const ly = TODAY_M === 0 ? TODAY_Y - 1 : TODAY_Y;
    onChange(lm, ly); setOpen(false);
  }

  // Build calendar cells
  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const startPad = firstWeekday(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  // cells: each is { day, mOffset } where mOffset: -1=prev, 0=cur, 1=next
  const cells: { day: number; mOffset: number }[] = [];
  for (let i = startPad - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, mOffset: -1 });
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, mOffset: 0 });
  const remaining = 42 - cells.length; // always 6 rows = 42 cells
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, mOffset: 1 });

  const isSelectedMonth = viewMonth === month && viewYear === year;
  const isNavPrevDisabled = false; // allow going back freely
  const isNavNextDisabled = viewYear >= maxY && viewMonth >= 11;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "flex items-center gap-2 h-9 px-3.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-40",
          open
            ? "border-[#217346] bg-[#217346]/5 text-[#217346] shadow-sm"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-xs"
        )}
      >
        <CalendarDays className="w-4 h-4 shrink-0" />
        <span>{MONTHS_FULL[month]} {year}</span>
        <ChevronRight className={clsx("w-3.5 h-3.5 text-slate-400 ml-0.5 transition-transform duration-200", open && "rotate-90")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={clsx(
          "absolute top-11 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden",
          "w-[300px]",
          align === "right" ? "right-0" : "left-0"
        )}>
          {/* ── Header: month + year navigation ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <button
              onClick={prevMonth}
              disabled={isNavPrevDisabled}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200/80 text-slate-500 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 leading-tight">{MONTHS_FULL[viewMonth]}</p>
              <p className="text-xs text-slate-500 leading-tight">{viewYear}</p>
            </div>

            <button
              onClick={nextMonth}
              disabled={isNavNextDisabled}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200/80 text-slate-500 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ── Day-of-week labels ── */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* ── Day cells ── */}
          <div className="grid grid-cols-7 gap-px px-3 pb-3">
            {cells.map((cell, idx) => {
              const isOtherMonth = cell.mOffset !== 0;

              // Resolve actual month/year for this cell
              let cellM = viewMonth + cell.mOffset;
              let cellY = viewYear;
              if (cellM < 0) { cellM = 11; cellY -= 1; }
              if (cellM > 11) { cellM = 0; cellY += 1; }

              const isToday = cell.day === TODAY_D && cellM === TODAY_M && cellY === TODAY_Y;
              const isInSelectedMonth = cellM === month && cellY === year;

              return (
                <button
                  key={idx}
                  onClick={() => selectDay(cell.day, cell.mOffset)}
                  className={clsx(
                    "aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                    isOtherMonth
                      ? "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
                      : isToday && isInSelectedMonth
                      ? "bg-[#217346] text-white ring-2 ring-[#217346]/30 font-bold shadow-sm"
                      : isInSelectedMonth
                      ? "bg-[#217346]/12 text-[#217346] font-semibold hover:bg-[#217346]/20"
                      : isToday
                      ? "ring-2 ring-[#217346]/50 text-[#217346] font-bold hover:bg-[#217346]/5"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* ── Selected month indicator ── */}
          {isSelectedMonth && (
            <div className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-[#217346]/8 text-center">
              <span className="text-xs font-semibold text-[#217346]">
                {MONTHS_FULL[month]} {year} selected
              </span>
            </div>
          )}

          {/* ── Quick shortcuts ── */}
          <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
            <button
              onClick={selectThisMonth}
              className="py-2.5 text-xs font-semibold text-[#217346] hover:bg-[#217346]/5 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={selectLastMonth}
              className="py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Last Month
            </button>
          </div>

          {/* ── Month quick-select strip ── */}
          <div className="border-t border-slate-100 px-3 py-2.5 grid grid-cols-6 gap-1">
            {MONTH_SHORT.map((ms, mi) => {
              const isActive = mi === viewMonth && !isNavNextDisabled;
              const isThisMonth = mi === month && viewYear === year;
              return (
                <button
                  key={mi}
                  onClick={() => { setViewMonth(mi); }}
                  className={clsx(
                    "py-1 rounded-md text-[10px] font-medium transition-colors",
                    isThisMonth
                      ? "bg-[#217346] text-white"
                      : isActive
                      ? "bg-slate-200 text-slate-800"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  {ms}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
