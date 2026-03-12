// ── Shared UI utilities ────────────────────────────────────────────────────────

import type { DayStatus } from "@/services/timesheet";

// ── Name helpers ──────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-green-600",
  "bg-rose-500", "bg-amber-500", "bg-teal-500",
  "bg-indigo-500", "bg-pink-500",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
  return days;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function statusBadgeClass(status: DayStatus | string): string {
  switch (status) {
    case "Working":      return "bg-green-100 text-green-700 border-green-200";
    case "Holiday":      return "bg-red-100 text-red-600 border-red-200";
    case "On leave":     return "bg-orange-100 text-orange-600 border-orange-200";
    case "Extra Working":return "bg-blue-100 text-blue-600 border-blue-200";
    default:             return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function statusRowBg(status: DayStatus | string, today: boolean): string {
  if (today) return "bg-amber-50";
  switch (status) {
    case "Holiday":      return "bg-red-50";
    case "On leave":     return "bg-orange-50";
    case "Extra Working":return "bg-blue-50";
    default:             return "bg-white";
  }
}

// ── Table cell styles ─────────────────────────────────────────────────────────

import type { CSSProperties } from "react";

export const tableTh: CSSProperties = {
  border: "1px solid #1a5c38",
  padding: "8px 10px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export const tableTd: CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "4px 8px",
  verticalAlign: "middle",
};

export const tableThTotal: CSSProperties = {
  border: "1px solid #1a5c38",
  padding: "8px 10px",
  fontWeight: 700,
};
