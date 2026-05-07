export type TaskStatus = 'Todo' | 'In Progress' | 'Done';

export const TASK_STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Done'];

export type ProjectStatus = 'Active' | 'Archived';

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface OwnerStatus {
  connected: boolean;
  email?: string;
}

export interface MeResponse {
  user: User;
  owner: OwnerStatus;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Step {
  id: string;
  heading: string;
  owner: string;
  targetStart: string;
  targetEnd: string;
  overview: string;
  checklist: ChecklistItem[];
  warning: string;
  notes: string;
  workingStatus: string;
  assignedTo: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  steps: Step[];
  status: TaskStatus;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  steps?: Step[];
  status?: TaskStatus;
  assignedTo?: string;
}

export interface Project {
  id: string;
  title: string;
  ownerEmail: string;
  assignedTo: string;
  sheetId: string;
  docId: string;
  folderId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  sheetUrl: string;
  docUrl: string;
  notesDocAvailable: boolean;
}

export interface ProjectInput {
  title: string;
  assignedTo?: string;
}
