export type TaskStatus = 'Todo' | 'In Progress' | 'Done';

export const TASK_STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Done'];

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

export const TASK_HEADERS = [
  'Task ID',
  'Title',
  'Description',
  'Status',
  'Assigned To',
  'Created At',
  'Description HTML',
  'Steps JSON',
  'Step Count',
  'Updated At',
] as const;

export const TASKS_SHEET_TAB = 'Tasks';
export const ROOT_FOLDER_NAME = 'MyApp';

export type ProjectStatus = 'Active' | 'Archived';

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
}

export const PROJECTS_SHEET_TAB = 'Projects';

export const PROJECTS_HEADERS = [
  'id',
  'title',
  'ownerEmail',
  'assignedTo',
  'sheetId',
  'docId',
  'folderId',
  'status',
  'createdAt',
  'updatedAt',
] as const;

export interface Provisioned {
  rootFolderId: string;
  usersSheetId: string;
  projectsSheetId: string;
}

export interface OAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  id_token?: string | null;
}

export interface OwnerRecord {
  email: string;
  tokens: OAuthTokens;
  connectedAt: string;
}

export interface SessionStoreShape {
  sessions: Record<string, string>;
  provisioned?: Provisioned | null;
  owner?: OwnerRecord | null;
}
