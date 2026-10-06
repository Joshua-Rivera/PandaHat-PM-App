"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import * as api from "@/lib/api/endpoints";
import type { AvailabilityBlock, ProjectInput, Task, TaskInput, TaskStatus, UserRef } from "@/lib/api/types";

export const keys = {
  me: ["me"] as const,
  users: ["users"] as const,
  researchers: ["team", "researchers"] as const,
  researcher: (id: string) => ["team", "researcher", id] as const,
  projects: (archived: boolean) => ["projects", "list", archived] as const,
  project: (id: string) => ["projects", "detail", id] as const,
  projectActivity: (id: string) => ["projects", "activity", id] as const,
  tasks: (filters: api.TaskFilters) => ["tasks", "list", filters] as const,
  task: (id: string) => ["tasks", "detail", id] as const,
  availability: ["availability"] as const,
  teamAvailability: ["availability", "team"] as const,
  pendingMembers: ["team", "pending"] as const,
  myLearning: ["learning", "me"] as const,
  learningPaths: ["learning", "paths"] as const,
  learningPath: (id: string) => ["learning", "path", id] as const,
  dashboard: ["dashboard"] as const,
  overview: ["overview"] as const,
};

/** Work data is interlinked (a task changes a project's progress, a person's
 * capacity, both dashboards), so a work mutation refreshes all of it. */
export function invalidateWork(qc: QueryClient) {
  for (const key of [["tasks"], ["projects"], ["team"], ["dashboard"], ["overview"], ["availability"], ["learning"], ["notifications"]]) {
    qc.invalidateQueries({ queryKey: key });
  }
}

// ── Reads ──
export const useMe = (enabled = true) => useQuery({ queryKey: keys.me, queryFn: api.getMe, enabled, retry: 1 });
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: () => api.listUsers() });
export const useResearchers = (enabled = true) =>
  useQuery({ queryKey: keys.researchers, queryFn: api.listResearchers, enabled });
export const useResearcher = (id: string) => useQuery({ queryKey: keys.researcher(id), queryFn: () => api.getResearcher(id) });
export const useProjects = (includeArchived = false) =>
  useQuery({ queryKey: keys.projects(includeArchived), queryFn: () => api.listProjects(includeArchived) });
export const useProject = (id: string) => useQuery({ queryKey: keys.project(id), queryFn: () => api.getProject(id) });
export const useProjectActivity = (id: string) =>
  useQuery({ queryKey: keys.projectActivity(id), queryFn: () => api.listProjectActivity(id) });
export const useTasks = (filters: api.TaskFilters) => useQuery({ queryKey: keys.tasks(filters), queryFn: () => api.listTasks(filters) });
export const useTask = (id: string) => useQuery({ queryKey: keys.task(id), queryFn: () => api.getTask(id) });
export const useMyAvailability = () => useQuery({ queryKey: keys.availability, queryFn: api.getMyAvailability });
export const useTeamAvailability = () => useQuery({ queryKey: keys.teamAvailability, queryFn: api.getTeamAvailability });
export const usePendingMembers = (enabled = true) =>
  useQuery({ queryKey: keys.pendingMembers, queryFn: api.listPendingMembers, enabled });
export const useMyLearningPath = () => useQuery({ queryKey: keys.myLearning, queryFn: api.getMyLearningPath });
export const useLearningPaths = () => useQuery({ queryKey: keys.learningPaths, queryFn: api.listLearningPaths });
export const useLearningPath = (id: string | null) =>
  useQuery({ queryKey: keys.learningPath(id ?? ""), queryFn: () => api.getLearningPath(id!), enabled: !!id });
export const useMyDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.getMyDashboard });
export const useTeamOverview = () => useQuery({ queryKey: keys.overview, queryFn: api.getTeamOverview });

// ── Writes ──
function useWorkMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateWork(qc) });
}

export const useCreateProject = () => useWorkMutation((body: ProjectInput) => api.createProject(body));
export const useUpdateProject = () =>
  useWorkMutation(({ id, body }: { id: string; body: Partial<ProjectInput> & { is_archived?: boolean } }) =>
    api.updateProject(id, body),
  );
export const useAddProjectMember = () =>
  useWorkMutation(({ projectId, userId }: { projectId: string; userId: string }) => api.addProjectMember(projectId, userId));
export const useRemoveProjectMember = () =>
  useWorkMutation(({ projectId, userId }: { projectId: string; userId: string }) =>
    api.removeProjectMember(projectId, userId),
  );
export const useCreateTask = () => useWorkMutation((body: TaskInput) => api.createTask(body));
export const useUpdateTask = () =>
  useWorkMutation(({ id, body }: { id: string; body: Partial<TaskInput> }) => api.updateTask(id, body));
export const useArchiveTask = () => useWorkMutation((id: string) => api.archiveTask(id));
export const useReplaceAvailability = () => useWorkMutation((blocks: AvailabilityBlock[]) => api.replaceMyAvailability(blocks));
export const useCreateUser = () =>
  useWorkMutation((body: Parameters<typeof api.createUser>[0]) => api.createUser(body));
export const useUpdateResearcher = () =>
  useWorkMutation(({ id, body }: { id: string; body: Parameters<typeof api.updateResearcher>[1] }) =>
    api.updateResearcher(id, body),
  );
export const useAssignLearningPath = () =>
  useWorkMutation(({ userId, body }: { userId: string; body: Parameters<typeof api.assignLearningPath>[1] }) =>
    api.assignLearningPath(userId, body),
  );
export const useSetLearningTaskCompletion = () =>
  useWorkMutation(({ id, done }: { id: string; done: boolean }) => api.setMyLearningTaskCompletion(id, done));
export const useCreateLearningPath = () =>
  useWorkMutation((body: Parameters<typeof api.createLearningPath>[0]) => api.createLearningPath(body));
export const useAddLearningModule = () =>
  useWorkMutation(({ id, body }: { id: string; body: Parameters<typeof api.addLearningModule>[1] }) =>
    api.addLearningModule(id, body),
  );
export const useUpdateMe = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (me) => {
      qc.setQueryData(keys.me, me);
      invalidateWork(qc);
    },
  });
};
export const useCreateAnnouncement = () => useWorkMutation(api.createAnnouncement);
export const useApproveMember = () =>
  useWorkMutation(({ id, body }: { id: string; body: Parameters<typeof api.approveMember>[1] }) => api.approveMember(id, body));
export const useRejectMember = () => useWorkMutation((id: string) => api.rejectMember(id));

export type TaskMove = { task: Task; status?: TaskStatus; assignee?: UserRef | null };

/** Board drag-and-drop: moves the card in every cached task list at once, rolls back if the server refuses. */
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, status, assignee }: TaskMove) =>
      api.updateTask(task.task_id, {
        ...(status ? { status } : {}),
        ...(assignee !== undefined ? { assignee_user_id: assignee?.user_id ?? null } : {}),
      } as Partial<TaskInput>),
    onMutate: async ({ task, status, assignee }: TaskMove) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: ["tasks", "list"] });
      qc.setQueriesData<Task[]>({ queryKey: ["tasks", "list"] }, (list) =>
        list?.map((t) =>
          t.task_id !== task.task_id
            ? t
            : {
                ...t,
                ...(status ? { status } : {}),
                ...(assignee !== undefined ? { assignee, assignee_user_id: assignee?.user_id ?? null } : {}),
              },
        ),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => invalidateWork(qc),
  });
}
