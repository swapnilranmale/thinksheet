import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayStatus = 'Working' | 'On leave' | 'Holiday' | 'Extra Working';

export interface TimesheetEntry {
  _id?: string;
  date: string;
  status: DayStatus;
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
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  entries: TimesheetEntry[];
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
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
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'not_started';
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
  project_start_date?: string;
  project_end_date?: string;
}

export interface StreamlineDepartment {
  _id: string;
  department_code: string;
  department_name: string;
  department_status: string;
}

export interface StreamlineTeam {
  _id: string;
  unique_id: string;
  team_name: string;
  department_id: {
    _id: string;
    department_code: string;
    department_name: string;
    department_status: string;
  };
  manager_ids: { _id: string; name: string; email: string }[];
  team_status: string;
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
  team_ids?: string[];
}

export interface EmployeeMaster {
  _id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation?: string;
  department_id?: string;
  team_id?: string;
  team_name?: string;
  // Streamline360 Resource Master fields
  profile_resource?: string;
  actual_resource?: string;
  resource_id?: string;
  synced_from_streamline?: boolean;
}

// ── Employee Timesheet API ────────────────────────────────────────────────────

export const timesheetService = {
  /** Get own timesheet for a month — returns { data: Timesheet|null, employee } */
  getOwn: async (month: number, year: number, projectId?: string | null) => {
    const qs = projectId ? `&projectId=${projectId}` : '';
    const res = await api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeInfo }>(
      `/timesheet?month=${month}&year=${year}${qs}`
    );
    return res.data; // { data, employee }
  },

  /** Create new draft timesheet */
  create: async (month: number, year: number, entries: Omit<TimesheetEntry, '_id'>[], projectId?: string | null) => {
    const res = await api.post<{ success: boolean; data: Timesheet }>('/timesheet', { month, year, entries, project_id: projectId ?? null });
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

  /** Recall a submitted timesheet back to draft */
  recall: async (id: string) => {
    const res = await api.put<{ success: boolean; data: Timesheet; message: string }>(`/timesheet/${id}/recall`, {});
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
  getEmployeeTimesheet: async (employeeId: string, month: number, year: number, projectId?: string) => {
    const qs = projectId ? `&projectId=${projectId}` : '';
    const res = await api.get<{ success: boolean; data: Timesheet | null; employee: EmployeeMaster }>(
      `/timesheet/employee/${employeeId}?month=${month}&year=${year}${qs}`
    );
    return res.data; // { data, employee }
  },

  /** Approve a submitted timesheet */
  approve: async (timesheetId: string) => {
    const res = await api.put<{ success: boolean; data: Timesheet; message: string }>(
      `/timesheet/${timesheetId}/approve`, {}
    );
    return res.data;
  },

  /** Reject a submitted timesheet with reason */
  reject: async (timesheetId: string, reason: string) => {
    const res = await api.put<{ success: boolean; data: Timesheet; message: string }>(
      `/timesheet/${timesheetId}/reject`, { reason }
    );
    return res.data;
  },
};

// ── Employee: My Projects API ──────────────────────────────────────────────────

export type EmployeeStats = {
  totalProjects: number;
  submitted: number;
  drafts: number;
  currentBillable: number;
  currentWorking: number;
  totalBillable: number;
  currentMonth: number;
  currentYear: number;
};

export const employeeProjectService = {
  getMyProjects: async () => {
    const res = await api.get<{ success: boolean; data: EmployeeProject[] }>('/employee-mapping/my-projects');
    return res.data;
  },
  getMyStats: async () => {
    const res = await api.get<{ success: boolean; data: EmployeeStats }>('/timesheet/my-stats');
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

  /** Projects with date ranges from resources */
  getProjectsWithDates: async () => {
    const res = await api.get<{ projects: ProjectMaster[]; pagination: any }>(
      '/streamline/projects-with-dates'
    );
    return { data: res.data.projects ?? [] };
  },
};

// ── Streamline Resource Master Types ────────────────────────────────────────

export interface ResourceMasterEmployee {
  name: string;
  email: string;
  emp_id: string;
  /** Streamline Resource ID, e.g. "UPID-26-18-1" */
  resource_id: string;
  designation: string;
  team_name: string;
  start_from: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface ResourceMasterProject {
  project_id: string;
  project_name: string;
  project_code: string;
  client_id: string;
  client_name: string;
  start_date: string | null;
  end_date: string | null;
  resource_count: number;
  resources: ResourceMasterEmployee[];
}

// ── Streamline Sync Types ────────────────────────────────────────────────────

export interface SyncResult {
  total_resources: number;
  employees_synced: number;
  new_employees_count: number;
  mappings_synced: number;
  errors: { resource_id: string; reason: string }[];
  synced_employees?: { name: string; email: string; unique_id: string }[];
  is_first_sync: boolean;
}

// ── Streamline Master Data API ──────────────────────────────────────────────

export const streamlineService = {
  getDepartments: async () => {
    const res = await api.get<{ departments: StreamlineDepartment[]; pagination: any }>(
      '/streamline/departments?page=1&limit=500'
    );
    return res.data.departments ?? [];
  },

  getTeams: async () => {
    const res = await api.get<{ teams: StreamlineTeam[]; pagination: any }>(
      '/streamline/teams?page=1&limit=500'
    );
    return res.data.teams ?? [];
  },

  /** Get only engineering teams (department_name contains "Engin") */
  getEngineeringTeams: async () => {
    const res = await api.get<{ teams: StreamlineTeam[]; pagination: any }>(
      '/streamline/teams?page=1&limit=500'
    );
    const teams = res.data.teams ?? [];
    return teams.filter(t =>
      t.department_id?.department_name?.toLowerCase().includes('engin')
    );
  },

  /**
   * Full sync from Streamline360 Resource Master into ThinkSheet.
   * Fetches the complete Client → Project → Resource Intimation → Resource hierarchy
   * and upserts employees + employee-project mappings.
   */
  syncResources: async () => {
    const res = await api.post<{ success: boolean; data: SyncResult }>('/streamline/sync', {});
    return res.data;
  },

  /**
   * Projects from Streamline360 Resource Master, grouped with their assigned employees.
   * Managers see only projects in their teams; Admins see all.
   */
  getMyResourceProjects: async () => {
    const res = await api.get<{ success: boolean; data: ResourceMasterProject[]; total: number }>(
      '/streamline/my-resource-projects'
    );
    return res.data;
  },
};

// ── Employee Management API ─────────────────────────────────────────────────

export const employeeService = {
  /** List Streamline-synced employees with pagination + search */
  getAll: async (params?: { teamId?: string; page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.teamId)  qs.set("team_id", params.teamId);
    if (params?.page)    qs.set("page",    String(params.page));
    if (params?.limit)   qs.set("limit",   String(params.limit));
    if (params?.search)  qs.set("search",  params.search);
    const q = qs.toString();
    const res = await api.get<{ success: boolean; data: EmployeeMaster[]; pagination?: { total: number; page: number; limit: number; pages: number } }>(`/employees${q ? `?${q}` : ""}`);
    const body = res.data;
    // Fallback for servers that haven't restarted yet (no pagination field)
    if (!body.pagination) {
      body.pagination = { total: body.data?.length ?? 0, page: 1, limit: 1000, pages: 1 };
    }
    return body;
  },

  /** Update employee metadata */
  update: async (id: string, data: { emp_name?: string; designation?: string; team_id?: string; team_name?: string }) => {
    const res = await api.put<{ success: boolean; data: EmployeeMaster }>(`/employees/${id}`, data);
    return res.data;
  },

  /** Delete employee (soft) */
  remove: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/employees/${id}`);
    return res.data;
  },
};

// ── Project Team Types & API ─────────────────────────────────────────────────

export interface ProjectTeamMember {
  employee_id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation: string;
  timesheet_id: string | null;
  status: 'submitted' | 'draft' | 'approved' | 'rejected' | 'not_started';
  submitted_at: string | null;
  entries_count: number;
  total_worked: number;
  total_billable: number;
}

export interface ProjectInfo {
  project_id: string;
  project_name: string;
  project_code: string;
  client_id: string | null;
  client_name: string;
}

export const projectTimesheetService = {
  getProjectTeam: async (projectId: string, month: number, year: number) => {
    const res = await api.get<{ success: boolean; project: ProjectInfo; data: ProjectTeamMember[] }>(
      `/timesheet/project/${projectId}?month=${month}&year=${year}`
    );
    return res.data;
  },
};

// ── Activity Log Types & API ─────────────────────────────────────────────────

export interface ActivityLog {
  _id: string;
  action: string;
  performed_by_name: string;
  performed_by_role: string;
  target_type: string;
  target_name: string;
  target_email: string;
  details: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Notification Types & API ─────────────────────────────────────────────────

// ── Project Submission Types & API ───────────────────────────────────────────

export interface ProjectSubmission {
  _id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  client_id: string | null;
  client_name: string;
  month: number;
  year: number;
  status: 'submitted' | 'acknowledged';
  submitted_by: { _id: string; full_name: string; email: string } | string;
  submitted_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  total_employees: number;
  total_billable_hours: number;
}

export const projectSubmissionService = {
  submit: async (projectId: string, month: number, year: number, meta: { project_name?: string; project_code?: string; client_id?: string; client_name?: string }) => {
    const res = await api.post<{ success: boolean; data: ProjectSubmission }>(
      `/timesheet/project/${projectId}/submit-project`,
      { month, year, ...meta }
    );
    return res.data;
  },

  getStatus: async (projectId: string, month: number, year: number) => {
    const res = await api.get<{ success: boolean; data: ProjectSubmission | null }>(
      `/timesheet/project/${projectId}/submission?month=${month}&year=${year}`
    );
    return res.data;
  },

  getAll: async (month?: number, year?: number) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', String(month));
    if (year) qs.set('year', String(year));
    const q = qs.toString();
    const res = await api.get<{ success: boolean; data: ProjectSubmission[] }>(
      `/timesheet/project-submissions${q ? `?${q}` : ''}`
    );
    return res.data;
  },
};

// ── Notification Types & API ─────────────────────────────────────────────────

export interface AppNotification {
  _id: string;
  type: 'timesheet_submitted' | 'timesheet_approved' | 'timesheet_rejected' | 'project_submitted';
  title: string;
  message: string;
  timesheet_id: string | null;
  metadata: {
    employee_id: string | null;
    employee_name: string | null;
    project_id: string | null;
    project_name: string | null;
    month: number | null;
    year: number | null;
  };
  is_read: boolean;
  read_at: string | null;
  createdAt: string;
}

export const notificationService = {
  getAll: async (page = 1, limit = 20) => {
    const res = await api.get<{
      success: boolean;
      data: AppNotification[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/notifications?page=${page}&limit=${limit}`);
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await api.get<{ success: boolean; unread: number }>('/notifications/count');
    return res.data;
  },

  markRead: async (id: string) => {
    const res = await api.put<{ success: boolean; data: AppNotification }>(`/notifications/${id}/read`, {});
    return res.data;
  },

  markAllRead: async () => {
    const res = await api.put<{ success: boolean; message: string }>('/notifications/read-all', {});
    return res.data;
  },
};

// ── Activity Log Types & API ─────────────────────────────────────────────────

export const activityLogService = {
  getAll: async (page = 1, limit = 50) => {
    const res = await api.get<{
      success: boolean;
      data: ActivityLog[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/logs?page=${page}&limit=${limit}`);
    return res.data;
  },
};
