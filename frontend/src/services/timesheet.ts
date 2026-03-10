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
  project_code?: string;
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

export interface EmployeeProject {
  mapping_id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  manager: { _id: string; full_name: string; email: string } | null;
  mapped_at: string;
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
  /** Get own timesheet for a month — returns { data: Timesheet|null, employee } */
  getOwn: async (month: number, year: number) => {
    const res = await api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeInfo }>(
      `/timesheet?month=${month}&year=${year}`
    );
    return res.data; // { data, employee }
  },

  /** Create new draft timesheet */
  create: async (month: number, year: number, entries: Omit<TimesheetEntry, '_id'>[]) => {
    const res = await api.post<{ success: boolean; data: Timesheet }>('/timesheet', { month, year, entries });
    return res.data; // { data }
  },

  /** Update entries (draft only) */
  update: async (id: string, entries: Omit<TimesheetEntry, '_id'>[]) => {
    const res = await api.put<{ success: boolean; data: Timesheet }>(`/timesheet/${id}`, { entries });
    return res.data; // { data }
  },

  /** Submit timesheet */
  submit: async (id: string) => {
    const res = await api.put<{ success: boolean; data: Timesheet; message: string }>(`/timesheet/${id}/submit`, {});
    return res.data; // { data, message }
  },
};

// ── Manager Team Timesheets API ────────────────────────────────────────────────

export const managerTimesheetService = {
  /** Get all mapped employees with their timesheet status */
  getTeam: async (month: number, year: number) => {
    const res = await api.get<{ success: boolean; data: TeamMember[] }>(
      `/timesheet/team?month=${month}&year=${year}`
    );
    return res.data; // { data }
  },

  /** View a specific employee's timesheet */
  getEmployeeTimesheet: async (employeeId: string, month: number, year: number) => {
    const res = await api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeMaster }>(
      `/timesheet/employee/${employeeId}?month=${month}&year=${year}`
    );
    return res.data; // { data, employee }
  },
};

// ── Employee: My Projects API ──────────────────────────────────────────────────

export const employeeProjectService = {
  getMyProjects: async () => {
    const res = await api.get<{ success: boolean; data: EmployeeProject[] }>('/employee-mapping/my-projects');
    return res.data;
  },
};

// ── Admin Employee Mapping API ─────────────────────────────────────────────────

export const employeeMappingService = {
  /** List all mappings */
  getAll: async () => {
    const res = await api.get<{ success: boolean; data: MappingRecord[] }>('/employee-mapping');
    return res.data; // { data }
  },

  /** Managers dropdown */
  getManagers: async () => {
    const res = await api.get<{ success: boolean; data: ManagerUser[] }>('/employee-mapping/managers');
    return res.data;
  },

  /** Employees dropdown */
  getEmployees: async () => {
    const res = await api.get<{ success: boolean; data: EmployeeMaster[] }>('/employee-mapping/employees');
    return res.data;
  },

  /** Projects dropdown — fetched from Streamline (port 5000) */
  getProjects: async () => {
    const res = await api.get<{ projects: ProjectMaster[]; pagination: any }>(
      '/streamline/projects?limit=500&page=1'
    );
    // Normalise to the same shape the rest of the code expects: { data: ProjectMaster[] }
    return { data: res.data.projects ?? [] };
  },

  /** Create/upsert mappings */
  create: async (manager_id: string, project_id: string, employee_ids: string[], project_name?: string, project_code?: string) => {
    const res = await api.post<{ success: boolean; data: { created: string[]; updated: string[]; errors: any[] } }>(
      '/employee-mapping',
      { manager_id, project_id, employee_ids, project_name, project_code }
    );
    return res.data;
  },

  /** Remove a mapping */
  remove: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/employee-mapping/${id}`);
    return res.data;
  },

  /** Reassign employee to different manager */
  update: async (id: string, manager_id: string) => {
    const res = await api.put<{ success: boolean; message: string }>(`/employee-mapping/${id}`, { manager_id });
    return res.data;
  },
};
