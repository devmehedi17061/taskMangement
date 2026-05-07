import { Router, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { httpError } from '../lib/httpError.js';
import {
  addTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../services/sheetsService.js';
import {
  appendTaskSection,
  removeTaskSection,
  updateTaskSection,
} from '../services/docsService.js';
import { getProject } from '../services/projectsSheetService.js';
import { sanitizeSteps } from '../services/stepsService.js';
import { TASK_STATUSES, type Step, type TaskInput, type TaskStatus } from '../types.js';

const router = Router({ mergeParams: true });

async function safeDocSync(label: string, op: () => Promise<void>): Promise<void> {
  try {
    await op();
  } catch (err) {
    console.warn(`[docSync] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

function parseStatus(value: unknown): TaskStatus | undefined {
  if (typeof value === 'string' && (TASK_STATUSES as string[]).includes(value)) {
    return value as TaskStatus;
  }
  return undefined;
}

function parseSteps(value: unknown): Step[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return sanitizeSteps(value);
}

function parseTaskInput(body: unknown): TaskInput {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    title: typeof b.title === 'string' ? b.title : '',
    description: typeof b.description === 'string' ? b.description : undefined,
    status: parseStatus(b.status),
    assignedTo: typeof b.assignedTo === 'string' ? b.assignedTo : undefined,
    steps: parseSteps(b.steps),
  };
}

function parseTaskPatch(body: unknown): Partial<TaskInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Partial<TaskInput> = {};
  if (typeof b.title === 'string') patch.title = b.title;
  if (typeof b.description === 'string') patch.description = b.description;
  const status = parseStatus(b.status);
  if (status) patch.status = status;
  if (typeof b.assignedTo === 'string') patch.assignedTo = b.assignedTo;
  const steps = parseSteps(b.steps);
  if (steps !== undefined) patch.steps = steps;
  return patch;
}

router.get('/', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    if (!projectId) throw httpError(400, 'projectId is required');
    const project = await getProject(projectId);
    if (!project) throw httpError(404, 'Project not found');
    const tasks = await listTasks(project.sheetId);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    if (!projectId) throw httpError(400, 'projectId is required');
    const project = await getProject(projectId);
    if (!project) throw httpError(404, 'Project not found');
    const input = parseTaskInput(req.body);
    const task = await addTask(project.sheetId, input);
    if (project.docId) {
      await safeDocSync(`append ${task.id}`, () =>
        appendTaskSection(project.docId, task.id, task.title, task.description, task.steps),
      );
    }
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

router.put('/:taskId', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    const taskId = String(req.params.taskId ?? '');
    if (!projectId || !taskId) throw httpError(400, 'projectId and taskId are required');
    const project = await getProject(projectId);
    if (!project) throw httpError(404, 'Project not found');
    const patch = parseTaskPatch(req.body);
    const task = await updateTask(project.sheetId, taskId, patch);
    if (project.docId) {
      await safeDocSync(`update ${task.id}`, () =>
        updateTaskSection(project.docId, task.id, task.title, task.description, task.steps),
      );
    }
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

router.delete('/:taskId', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId ?? '');
    const taskId = String(req.params.taskId ?? '');
    if (!projectId || !taskId) throw httpError(400, 'projectId and taskId are required');
    const project = await getProject(projectId);
    if (!project) throw httpError(404, 'Project not found');
    await deleteTask(project.sheetId, taskId);
    if (project.docId) {
      await safeDocSync(`remove ${taskId}`, () => removeTaskSection(project.docId, taskId));
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
