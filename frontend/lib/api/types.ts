// Mirrors the FastAPI response models (backend/app/**/schemas.py).

export type Role = "researcher" | "pm" | "admin";
/** The track tag a PM gives each member. */
export type ResearchStatus = "LEARNING_PATH" | "RESEARCH";
/** Shadow researcher = 5 h/week, Full-time researcher = 10 h/week. */
export type Commitment = "SHADOW" | "FULL_TIME";
export type AccessStatus = "PENDING" | "APPROVED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskSource = "LOCAL" | "GITHUB_LINKED";
export type ProjectStage =
  | "PLANNING"
  | "LITERATURE_REVIEW"
  | "EXPERIMENT_DESIGN"
  | "EXPERIMENT_VALIDATION"
  | "ANALYSIS"
  | "WRITING"
  | "COMPLETE";
export type CapacityState = "NO_AVAILABILITY" | "AVAILABLE" | "AT_CAPACITY" | "OVERLOADED";

export interface UserRef {
  user_id: string;
  display_name: string;
}

export interface UserListItem extends UserRef {
  role: Role;
  research_status: ResearchStatus;
  commitment: Commitment;
}

export interface Me extends UserListItem {
  email: string;
  committed_hours: number;
  access_status: AccessStatus;
  avatar_url: string | null;
  skills: string[];
  is_manager: boolean;
}

export interface Workload {
  capacity_hours: number;
  assigned_hours: number;
  open_task_count: number;
  capacity_state: CapacityState;
  committed_hours: number;
  below_commitment: boolean;
}

export interface ProjectRef {
  project_id: string;
  name: string;
}

export interface LearningProgressRef {
  learning_path_id: string;
  name: string;
  progress_percent: number;
  completed_task_count: number;
  total_task_count: number;
}

export interface ResearcherSummary extends UserListItem {
  email: string;
  skills: string[];
  workload: Workload;
  projects: ProjectRef[];
  learning: LearningProgressRef | null;
}

export interface ProjectStats {
  member_count: number;
  open_task_count: number;
  completed_task_count: number;
  blocked_task_count: number;
  overdue_task_count: number;
  progress_percent: number;
  next_deadline_at: string | null;
}

export interface ProjectSummary {
  project_id: string;
  name: string;
  description: string;
  research_track: string;
  stage: ProjectStage;
  target_date: string | null;
  is_archived: boolean;
  project_manager: UserRef | null;
  stats: ProjectStats;
}

export interface ProjectMember {
  user_id: string;
  display_name: string;
  research_status: ResearchStatus;
  commitment: Commitment;
  open_task_count: number;
  added_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  research_question: string;
  hypothesis: string;
  research_lead: UserRef | null;
  start_date: string | null;
  github_repository: string | null;
  github_project_url: string | null;
  created_at: string;
  members: ProjectMember[];
  viewer_can_manage: boolean;
}

export interface ProjectInput {
  name: string;
  description: string;
  research_question: string;
  hypothesis: string;
  research_track: string;
  stage: ProjectStage;
  project_manager_user_id: string | null;
  research_lead_user_id: string | null;
  start_date: string | null;
  target_date: string | null;
  github_repository: string | null;
  github_project_url: string | null;
}

export interface Task {
  task_id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  github_issue_url: string | null;
  estimated_hours: number | null;
  deadline_at: string | null;
  required_skills: string[];
  assignee: UserRef | null;
  assignee_user_id: string | null;
  assignment_version: number;
  is_archived: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  viewer_can_manage: boolean;
  viewer_can_update_status: boolean;
}

export interface TaskInput {
  title: string;
  description: string;
  project_id: string;
  assignee_user_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimated_hours: number | null;
  deadline_at: string | null;
  required_skills: string[];
  github_issue_url: string | null;
}

export interface ActivityItem {
  occurred_at: string;
  kind: "task_created" | "task_completed" | "project_created";
  text: string;
  link: string | null;
}

export interface AvailabilityBlock {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TeamMemberAvailability {
  user_id: string;
  display_name: string;
  role: Role;
  research_status: ResearchStatus;
  commitment: Commitment;
  committed_hours: number;
  weekly_capacity_hours: number;
  assigned_hours: number;
  blocks: AvailabilityBlock[];
}

export interface PendingMember {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  github_login: string | null;
  requested_at: string;
}

export interface Availability {
  blocks: AvailabilityBlock[];
  weekly_capacity_hours: number;
  assigned_hours: number;
}

export interface LearningTask {
  learning_task_id: string;
  title: string;
  description: string;
  resource_url: string | null;
  estimated_hours: number | null;
  is_completed: boolean;
  completed_at: string | null;
}

export interface LearningModule {
  learning_module_id: string;
  title: string;
  position: number;
  tasks: LearningTask[];
  completed_task_count: number;
  total_task_count: number;
  state: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED";
}

export interface LearningProgress {
  learning_path_id: string;
  name: string;
  description: string;
  modules: LearningModule[];
  completed_task_count: number;
  total_task_count: number;
  progress_percent: number;
  current_task: (LearningTask & { module_title: string }) | null;
  target_date: string | null;
  assigned_at: string;
  completed_at: string | null;
}

export interface LearningPathListItem {
  learning_path_id: string;
  name: string;
  description: string;
  module_count: number;
  task_count: number;
  enrolled_count: number;
}

export interface LearningPathDetail {
  learning_path_id: string;
  name: string;
  description: string;
  modules: LearningModule[];
  total_task_count: number;
  enrollments: { researcher: UserRef; progress_percent: number; completed_at: string | null; target_date: string | null }[];
}

export interface LearningTaskInput {
  title: string;
  description: string;
  resource_url: string | null;
  estimated_hours: number | null;
}

export interface LearningModuleInput {
  title: string;
  tasks: LearningTaskInput[];
}

export interface ResearcherDetail {
  researcher: ResearcherSummary;
  availability: Availability;
  open_tasks: Task[];
  recently_completed_tasks: Task[];
  projects: ProjectSummary[];
  learning: LearningProgress | null;
  viewer_can_manage: boolean;
}

export interface UpcomingItem {
  due: string;
  label: string;
  kind: "task_deadline" | "project_target" | "learning_target";
  link: string | null;
}

export interface MyDashboard {
  display_name: string;
  research_status: ResearchStatus;
  workload: Workload;
  tasks_due_this_week: number;
  overdue_task_count: number;
  current_project: ProjectSummary | null;
  open_tasks: Task[];
  recently_completed_tasks: Task[];
  upcoming: UpcomingItem[];
  learning: LearningProgressRef | null;
}

export interface TeamOverview {
  researcher_count: number;
  learning_path_count: number;
  research_count: number;
  shadow_count: number;
  full_time_count: number;
  committed_hours_total: number;
  capacity_hours_total: number;
  assigned_hours_total: number;
  team: ResearcherSummary[];
  projects: ProjectSummary[];
  needs_attention: {
    overloaded_researchers: UserRef[];
    researchers_without_availability: UserRef[];
    overdue_tasks: Task[];
    blocked_tasks: Task[];
    unassigned_open_task_count: number;
  };
  recent_activity: ActivityItem[];
}
