// Typed API client. Function names match the FastAPI operation_ids.
import { apiFetch } from "./client";
import type {
  ActivityItem,
  Availability,
  AvailabilityBlock,
  LearningModuleInput,
  LearningPathDetail,
  LearningPathListItem,
  LearningProgress,
  Me,
  PendingMember,
  MyDashboard,
  ProjectDetail,
  ProjectInput,
  ProjectSummary,
  ResearcherDetail,
  ResearcherSummary,
  ResearchStatus,
  Commitment,
  Role,
  Task,
  TaskInput,
  TaskStatus,
  TeamMemberAvailability,
  TeamOverview,
  UserListItem,
} from "./types";

const V1 = "/api/v1";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// ── Me / users ──
export const getMe = () => apiFetch<Me>(`${V1}/me`);
export const updateMe = (body: { display_name?: string; skills?: string[] }) => apiFetch<Me>(`${V1}/me`, json("PATCH", body));
export const listUsers = (role?: Role) => apiFetch<UserListItem[]>(`${V1}/users${role ? `?role=${role}` : ""}`);
export const createUser = (body: {
  display_name: string;
  email: string;
  role: Role;
  research_status: ResearchStatus;
  commitment: Commitment;
  skills: string[];
}) => apiFetch<UserListItem>(`${V1}/users`, json("POST", body));

// ── Sign-in & approvals ──
export const recordGithubLogin = (login: string) => apiFetch<void>(`${V1}/auth/github-login`, json("POST", { login }));
export const listPendingMembers = () => apiFetch<PendingMember[]>(`${V1}/users/pending`);
export const approveMember = (
  userId: string,
  body: { role: Role; research_status: ResearchStatus; commitment: Commitment },
) => apiFetch<void>(`${V1}/users/${userId}/approve`, json("POST", body));
export const rejectMember = (userId: string) => apiFetch<void>(`${V1}/users/${userId}/reject`, { method: "POST" });

// ── Team ──
export const listResearchers = () => apiFetch<ResearcherSummary[]>(`${V1}/researchers`);
export const getResearcher = (userId: string) => apiFetch<ResearcherDetail>(`${V1}/researchers/${userId}`);
export const updateResearcher = (
  userId: string,
  body: { research_status?: ResearchStatus; commitment?: Commitment; skills?: string[] },
) =>
  apiFetch<ResearcherDetail>(`${V1}/researchers/${userId}`, json("PATCH", body));
export const assignLearningPath = (userId: string, body: { learning_path_id: string; target_date: string | null }) =>
  apiFetch<LearningProgress>(`${V1}/researchers/${userId}/learning-path`, json("PUT", body));

// ── Projects ──
export const listProjects = (includeArchived = false) =>
  apiFetch<ProjectSummary[]>(`${V1}/projects${includeArchived ? "?include_archived=true" : ""}`);
export const getProject = (projectId: string) => apiFetch<ProjectDetail>(`${V1}/projects/${projectId}`);
export const createProject = (body: ProjectInput) => apiFetch<ProjectDetail>(`${V1}/projects`, json("POST", body));
export const updateProject = (projectId: string, body: Partial<ProjectInput> & { is_archived?: boolean }) =>
  apiFetch<ProjectDetail>(`${V1}/projects/${projectId}`, json("PATCH", body));
export const listProjectActivity = (projectId: string) => apiFetch<ActivityItem[]>(`${V1}/projects/${projectId}/activity`);
export const addProjectMember = (projectId: string, userId: string) =>
  apiFetch<ProjectDetail>(`${V1}/projects/${projectId}/members`, json("POST", { user_id: userId }));
export const removeProjectMember = (projectId: string, userId: string) =>
  apiFetch<ProjectDetail>(`${V1}/projects/${projectId}/members/${userId}`, { method: "DELETE" });

// ── Tasks ──
export interface TaskFilters {
  project_id?: string;
  assignee?: "me" | string;
  status?: TaskStatus[];
}
export function listTasks(filters: TaskFilters = {}) {
  const q = new URLSearchParams();
  if (filters.project_id) q.set("project_id", filters.project_id);
  if (filters.assignee) q.set("assignee", filters.assignee);
  filters.status?.forEach((s) => q.append("status", s));
  return apiFetch<Task[]>(`${V1}/tasks?${q}`);
}
export const getTask = (taskId: string) => apiFetch<Task>(`${V1}/tasks/${taskId}`);
export const createTask = (body: TaskInput) => apiFetch<Task>(`${V1}/tasks`, json("POST", body));
export const updateTask = (taskId: string, body: Partial<TaskInput>) => apiFetch<Task>(`${V1}/tasks/${taskId}`, json("PATCH", body));
export const archiveTask = (taskId: string) => apiFetch<void>(`${V1}/tasks/${taskId}`, { method: "DELETE" });

// ── Availability ──
export const getMyAvailability = () => apiFetch<Availability>(`${V1}/me/availability`);
export const getTeamAvailability = () => apiFetch<TeamMemberAvailability[]>(`${V1}/availability/team`);
export const replaceMyAvailability = (blocks: AvailabilityBlock[]) =>
  apiFetch<Availability>(`${V1}/me/availability`, json("PUT", { blocks }));

// ── Learning ──
export const getMyLearningPath = () => apiFetch<{ enrollment: LearningProgress | null }>(`${V1}/me/learning-path`);
export const setMyLearningTaskCompletion = (learningTaskId: string, isCompleted: boolean) =>
  apiFetch<{ enrollment: LearningProgress | null }>(
    `${V1}/me/learning-tasks/${learningTaskId}/completion`,
    json("PUT", { is_completed: isCompleted }),
  );
export const listLearningPaths = () => apiFetch<LearningPathListItem[]>(`${V1}/learning-paths`);
export const getLearningPath = (id: string) => apiFetch<LearningPathDetail>(`${V1}/learning-paths/${id}`);
export const createLearningPath = (body: { name: string; description: string; modules: LearningModuleInput[] }) =>
  apiFetch<LearningPathDetail>(`${V1}/learning-paths`, json("POST", body));
export const addLearningModule = (id: string, body: LearningModuleInput) =>
  apiFetch<LearningPathDetail>(`${V1}/learning-paths/${id}/modules`, json("POST", body));

// ── Dashboards ──
export const getMyDashboard = () => apiFetch<MyDashboard>(`${V1}/me/dashboard`);
export const getTeamOverview = () => apiFetch<TeamOverview>(`${V1}/overview`);

// ── Announcements ──
export const createAnnouncement = (body: {
  title: string;
  message: string;
  audience: "ALL" | "PROJECT";
  project_id: string | null;
  is_urgent: boolean;
}) => apiFetch<{ recipient_count: number }>(`${V1}/announcements`, json("POST", body));

// ── Dev only ──
export const listDevIdentities = () => apiFetch<UserListItem[]>(`${V1}/dev/identities`);
export const bootstrapDevAdmin = (body: { display_name: string; email: string }) =>
  apiFetch<UserListItem>(`${V1}/dev/bootstrap`, json("POST", body));
