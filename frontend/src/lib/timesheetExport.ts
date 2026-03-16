import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportFormat = "xlsx" | "csv" | "pdf";

// ── Admin multi-project export ────────────────────────────────────────────────

export interface AdminTimesheetEntry {
  date: string;       // "YYYY-MM-DD"
  status: string;
  tasks: string;
  billable_hours: number;
}

export interface AdminExportResource {
  name: string;
  email: string;
  designation: string;
  team_name: string;
  resource_id?: string;
  project_name?: string;
  client_name?: string;
  entries?: AdminTimesheetEntry[];  // per-day timesheet data if available
}

export interface AdminExportProject {
  project_name: string;
  project_code?: string;
  client_name: string;
  resources: AdminExportResource[];
}

const DAY_NAMES_ADMIN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_ADMIN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDateAdmin(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ADMIN[d.getMonth()]} ${d.getFullYear()}`;
}

function uniqueSheetName(base: string, used: Record<string, number>): string {
  const raw = base.substring(0, 28).trim();
  used[raw] = (used[raw] || 0) + 1;
  return used[raw] > 1 ? `${raw} (${used[raw]})` : raw;
}

function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/**
 * Export one or many projects to a multi-sheet XLSX.
 * Sheet 1 : Summary  — one row per resource with project, client, designation
 * Sheet N : one sheet per resource named by resource name,
 *           showing their timesheet entries (if provided) or just metadata
 */
export function exportAdminProjectsXLSX(
  projects: AdminExportProject[],
  fromDate: Date,
  toDate: Date,
  filename: string
) {
  const wb = new ExcelJS.Workbook();

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const period = `${fmt(fromDate)} – ${fmt(toDate)}`;

  // ── Flatten all resources (deduplicated by email, keeping project_name) ─────
  const allResources: (AdminExportResource & { project_name: string; client_name: string })[] = [];
  const seenEmails = new Set<string>();
  for (const proj of projects) {
    for (const r of proj.resources) {
      if (!seenEmails.has(r.email)) {
        seenEmails.add(r.email);
        allResources.push({
          ...r,
          project_name: r.project_name ?? proj.project_name,
          client_name: r.client_name ?? proj.client_name,
        });
      }
    }
  }

  // ── Sheet 1: Summary (one block per project) ─
  const projectGroups: Record<string, {
    client_name: string;
    project_name: string;
    project_code: string;
    resources: typeof allResources;
  }> = {};
  for (const r of allResources) {
    const key = r.project_name;
    if (!projectGroups[key]) {
      projectGroups[key] = {
        client_name: r.client_name,
        project_name: r.project_name,
        project_code: projects.find(p => p.project_name === r.project_name)?.project_code || "",
        resources: [],
      };
    }
    projectGroups[key].resources.push(r);
  }

  const summaryWs = wb.addWorksheet("Summary");
  summaryWs.columns = [
    { width: 22 }, { width: 28 }, { width: 20 },
  ];

  let firstBlock = true;
  for (const pg of Object.values(projectGroups)) {
    if (!firstBlock) { summaryWs.addRow([]); summaryWs.addRow([]); }
    firstBlock = false;

    const totalHours = pg.resources.reduce((s, r) => {
      const hrs = r.entries
        ? r.entries.reduce((sum, e) => sum + (e.billable_hours || 0), 0)
        : 0;
      return s + hrs;
    }, 0);

    summaryWs.addRow(["Client Company Name", pg.client_name]);
    summaryWs.addRow(["Project Name", pg.project_name]);
    summaryWs.addRow(["Project Id", pg.project_code || "—"]);
    summaryWs.addRow([]);
    summaryWs.addRow(["", "TOTAL HOURS", "", totalHours || ""]);
    summaryWs.addRow([]);
    summaryWs.addRow(["Resource ID", "Profile Name", "Total Billable Hours"]);

    for (const r of pg.resources) {
      const hrs = r.entries
        ? r.entries.reduce((s, e) => s + (e.billable_hours || 0), 0)
        : 0;
      summaryWs.addRow([r.resource_id || "—", r.name, hrs || ""]);
    }
  }

  // ── One sheet per resource ─────
  const usedSheetNames: Record<string, number> = {};
  for (const r of allResources) {
    const sheetName = uniqueSheetName(r.name || "Resource", usedSheetNames);
    const ws = wb.addWorksheet(sheetName);

    ws.addRow([r.name]);
    ws.addRow([`Project: ${r.project_name}  |  Client: ${r.client_name}`]);
    ws.addRow([`Designation: ${r.designation}  |  Team: ${r.team_name}`]);
    ws.addRow([`Period: ${period}`]);
    ws.addRow([]);

    if (r.entries && r.entries.length > 0) {
      ws.columns = [
        { width: 5 }, { width: 18 }, { width: 12 }, { width: 16 }, { width: 50 }, { width: 16 },
      ];

      const from = fromDate.getTime();
      const to = toDate.getTime();
      const filtered = r.entries.filter(e => {
        const t = new Date(e.date).getTime();
        return t >= from && t <= to;
      });

      ws.addRow(["#", "Date", "Day", "Status", "Task Description", "Billable Hours"]);
      filtered.forEach((e, idx) => {
        const d = new Date(e.date);
        ws.addRow([
          idx + 1,
          fmtDateAdmin(e.date),
          DAY_NAMES_ADMIN[d.getDay()],
          e.status,
          e.tasks || "",
          e.billable_hours,
        ]);
      });
      const totalBillable = filtered.reduce((s, e) => s + (e.billable_hours || 0), 0);
      ws.addRow(["", "", "", "", "Total Billable Hours", totalBillable]);
    } else {
      ws.columns = [{ width: 18 }, { width: 35 }];
      ws.addRow(["Field", "Value"]);
      ws.addRow(["Name", r.name]);
      ws.addRow(["Email", r.email]);
      ws.addRow(["Designation", r.designation]);
      ws.addRow(["Team", r.team_name]);
      ws.addRow(["Project", r.project_name]);
      ws.addRow(["Client", r.client_name]);
      ws.addRow(["Resource ID", r.resource_id || "—"]);
    }
  }

  saveWorkbook(wb, filename);
}

export interface ExportRow {
  srNo: number;
  date: string;
  day: string;
  status: string;
  taskDescription: string;
  billableHours: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function buildExportRows(
  cells: Record<string, {
    status: string;
    tasks: string;
    billable_hours: number;
  }>,
  fromDate: Date,
  toDate: Date
): ExportRow[] {
  const rows: ExportRow[] = [];
  let srNo = 1;

  // Iterate day by day from fromDate to toDate
  const cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    const cell = cells[key];

    if (cell) {
      rows.push({
        srNo: srNo++,
        date: `${cur.getDate()} ${MONTHS[cur.getMonth()]} ${y}`,
        day: DAY_NAMES[cur.getDay()],
        status: cell.status,
        taskDescription: cell.tasks || "",
        billableHours: cell.billable_hours,
      });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return rows;
}

function getHeaders() {
  return ["Sr No", "Date", "Day", "Status", "Task Description", "Billable Hours"];
}

function rowsToArray(rows: ExportRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.srNo,
    r.date,
    r.day,
    r.status,
    r.taskDescription,
    r.billableHours,
  ]);
}

export function exportToXLSX(rows: ExportRow[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Timesheet");

  ws.columns = [
    { width: 6 },   // Sr No
    { width: 18 },  // Date
    { width: 12 },  // Day
    { width: 14 },  // Status
    { width: 50 },  // Task Description
    { width: 14 },  // Billable Hours
  ];

  ws.addRow(getHeaders());
  for (const row of rowsToArray(rows)) {
    ws.addRow(row);
  }

  saveWorkbook(wb, filename);
}

export function exportToCSV(rows: ExportRow[], filename: string) {
  const data = [getHeaders(), ...rowsToArray(rows)];
  const csv = data
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Wrap in quotes if contains comma, newline, or quote
          return str.includes(",") || str.includes("\n") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  rows: ExportRow[],
  filename: string,
  meta: { projectName: string; monthLabel: string; totalBillable: number }
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(14);
  doc.setTextColor(33, 115, 70); // #217346
  doc.text("Timesheet Report", 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Project: ${meta.projectName}`, 14, 23);
  doc.text(`Period: ${meta.monthLabel}`, 14, 28);
  doc.text(`Total Billable Hours: ${meta.totalBillable}h`, 14, 33);

  autoTable(doc, {
    startY: 38,
    head: [getHeaders()],
    body: rowsToArray(rows),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [33, 115, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: "auto" },
      5: { halign: "center", cellWidth: 26 },
    },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    didParseCell(data) {
      if (data.column.index === 3 && data.section === "body") {
        const row = data.row.raw as (string | number)[];
        const status = row?.[3];
        if (status === "Holiday") data.cell.styles.textColor = [220, 38, 38];
        else if (status === "On leave") data.cell.styles.textColor = [234, 88, 12];
        else if (status === "Extra Working") data.cell.styles.textColor = [37, 99, 235];
        else data.cell.styles.textColor = [22, 101, 52];
      }
    },
  });

  doc.save(`${filename}.pdf`);
}
