import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimesheetEntry {
  _id?: string;
  date: string;
  tasks: string[];
  worked_hours: number;
  billable_hours: number;
  completed_task: boolean;
  completed_task_description: string;
  unplanned_task: boolean;
  actual_hours: number;
  comments: string;
}

export interface Timesheet {
  _id: string;
  employee_id: string;
  user_id: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted';
  entries: TimesheetEntry[];
  submitted_at: string | null;
  tenant_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeInfo {
  _id: string;
  employee_name: string;
  unique_id: string;
  designation: string;
  official_email: string;
}

export interface TeamMember {
  mapping_id: string;
  employee_id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation: string;
  department_id: string | null;
  manager_id: string | object;
  timesheet_id: string | null;
  status: 'draft' | 'submitted' | 'not_started';
  submitted_at: string | null;
  entries_count: number;
  total_worked: number;
  total_billable: number;
}

export interface ProjectMaster {
  _id: string;
  project_name: string;
  unique_id?: string;
  project_status?: string;
}

export interface MappingRecord {
  _id: string;
  project_id: { _id: string; project_name: string; unique_id?: string };
  manager_id: { _id: string; full_name: string; email: string; designation?: string };
  employee_id: { _id: string; employee_name: string; official_email: string; unique_id: string; designation?: string };
  mapped_at: string;
  is_active: boolean;
}

export interface ManagerUser {
  _id: string;
  full_name: string;
  email: string;
  designation?: string;
}

export interface EmployeeMaster {
  _id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation?: string;
  department_id?: string;
}

// ── Employee Timesheet API ────────────────────────────────────────────────────

export const timesheetService = {
  /** Get own timesheet for a month */
  getOwn: (month: number, year: number) =>
    api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeInfo }>(
      `/timesheet?month=${month}&year=${year}`
    ),

  /** Create new draft timesheet */
  create: (month: number, year: number, entries: Omit<TimesheetEntry, '_id'>[]) =>
    api.post<{ success: boolean; data: Timesheet }>('/timesheet', { month, year, entries }),

  /** Update entries (draft only) */
  update: (id: string, entries: Omit<TimesheetEntry, '_id'>[]) =>
    api.put<{ success: boolean; data: Timesheet }>(`/timesheet/${id}`, { entries }),

  /** Submit timesheet */
  submit: (id: string) =>
    api.put<{ success: boolean; data: Timesheet; message: string }>(`/timesheet/${id}/submit`, {}),
};

// ── Manager Team Timesheets API ────────────────────────────────────────────────

export const managerTimesheetService = {
  /** Get all mapped employees with their timesheet status */
  getTeam: (month: number, year: number) =>
    api.get<{ success: boolean; data: TeamMember[] }>(
      `/timesheet/team?month=${month}&year=${year}`
    ),

  /** View a specific employee's timesheet */
  getEmployeeTimesheet: (employeeId: string, month: number, year: number) =>
    api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeMaster }>(
      `/timesheet/employee/${employeeId}?month=${month}&year=${year}`
    ),
};

// ── Admin Employee Mapping API ─────────────────────────────────────────────────

export const employeeMappingService = {
  /** List all mappings */
  getAll: () =>
    api.get<{ success: boolean; data: MappingRecord[] }>('/employee-mapping'),

  /** Managers dropdown */
  getManagers: () =>
    api.get<{ success: boolean; data: ManagerUser[] }>('/employee-mapping/managers'),

  /** Employees dropdown */
  getEmployees: () =>
    api.get<{ success: boolean; data: EmployeeMaster[] }>('/employee-mapping/employees'),

  /** Projects dropdown */
  getProjects: () =>
    api.get<{ success: boolean; data: ProjectMaster[] }>('/employee-mapping/projects'),

  /** Create/upsert mappings */
  create: (manager_id: string, project_id: string, employee_ids: string[]) =>
    api.post<{ success: boolean; data: { created: string[]; updated: string[]; errors: any[] } }>(
      '/employee-mapping',
      { manager_id, project_id, employee_ids }
    ),

  /** Remove a mapping */
  remove: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/employee-mapping/${id}`),

  /** Reassign employee to different manager */
  update: (id: string, manager_id: string) =>
    api.put<{ success: boolean; message: string }>(`/employee-mapping/${id}`, { manager_id }),
};
