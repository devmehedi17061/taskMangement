import axios, { AxiosError } from 'axios';
import type { MeResponse, OwnerStatus, Project, ProjectInput, Task, TaskInput, User } from '../lib/types';

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
});

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

apiClient.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string }>) => {
    const status = err.response?.status ?? 0;
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new ApiError(status, message));
  },
);

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(err);
  },
);

const enc = encodeURIComponent;

export const api = {
  async me(): Promise<MeResponse | null> {
    try {
      const { data } = await apiClient.get<MeResponse>('/auth/me');
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  async ownerStatus(): Promise<OwnerStatus> {
    const me = await this.me();
    return me?.owner ?? { connected: false };
  },
  connectGoogleUrl(): string {
    return '/api/auth/google';
  },
  async register(body: { name: string; email: string; password: string }): Promise<User> {
    const { data } = await apiClient.post<{ user: User }>('/auth/register', body);
    return data.user;
  },
  async login(body: { email: string; password: string }): Promise<User> {
    const { data } = await apiClient.post<{ user: User }>('/auth/login', body);
    return data.user;
  },
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async listProjects(): Promise<Project[]> {
    const { data } = await apiClient.get<{ projects: Project[] }>('/projects');
    return data.projects;
  },
  async getProject(id: string): Promise<Project> {
    const { data } = await apiClient.get<{ project: Project }>(`/projects/${enc(id)}`);
    return data.project;
  },
  async createProject(input: ProjectInput): Promise<Project> {
    const { data } = await apiClient.post<{ project: Project }>('/projects', input);
    return data.project;
  },
  async updateProject(id: string, patch: Partial<ProjectInput & { status: 'Active' | 'Archived' }>): Promise<Project> {
    const { data } = await apiClient.patch<{ project: Project }>(`/projects/${enc(id)}`, patch);
    return data.project;
  },
  async deleteProject(id: string): Promise<void> {
    await apiClient.delete(`/projects/${enc(id)}`);
  },
  async recreateProjectDoc(id: string): Promise<Project> {
    const { data } = await apiClient.post<{ project: Project }>(`/projects/${enc(id)}/recreate-doc`);
    return data.project;
  },

  async listTasks(projectId: string): Promise<Task[]> {
    const { data } = await apiClient.get<{ tasks: Task[] }>(`/projects/${enc(projectId)}/tasks`);
    return data.tasks;
  },
  async addTask(projectId: string, input: TaskInput): Promise<Task> {
    const { data } = await apiClient.post<{ task: Task }>(`/projects/${enc(projectId)}/tasks`, input);
    return data.task;
  },
  async updateTask(projectId: string, taskId: string, patch: Partial<TaskInput>): Promise<Task> {
    const { data } = await apiClient.put<{ task: Task }>(
      `/projects/${enc(projectId)}/tasks/${enc(taskId)}`,
      patch,
    );
    return data.task;
  },
  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await apiClient.delete(`/projects/${enc(projectId)}/tasks/${enc(taskId)}`);
  },
};
