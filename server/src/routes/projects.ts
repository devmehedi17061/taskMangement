import { Router, type Response, type NextFunction } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { httpError } from '../lib/httpError.js';
import { generateUniqueId } from '../idGenerator.js';
import {
  createSubFolder,
  fileExists,
  rootFolderId,
  trashFolder,
} from '../services/driveService.js';
import { createTasksSheet, sheetUrl } from '../services/sheetsService.js';
import { createNotesDoc, docUrl } from '../services/docsService.js';
import {
  appendProject,
  ensureProjectsSheet,
  getProject,
  listProjects,
  removeProject,
  updateProject,
} from '../services/projectsSheetService.js';
import { findUserById } from '../services/usersSheetService.js';
import type { Project } from '../types.js';

const router = Router();

interface ProjectView extends Project {
  sheetUrl: string;
  docUrl: string;
  notesDocAvailable: boolean;
}

async function toView(p: Project): Promise<ProjectView> {
  const docOk = p.docId ? await fileExists(p.docId) : false;
  return {
    ...p,
    sheetUrl: sheetUrl(p.sheetId),
    docUrl: docUrl(p.docId),
    notesDocAvailable: docOk,
  };
}

router.get('/', requireAuth, async (_req, res: Response, next: NextFunction) => {
  try {
    await ensureProjectsSheet();
    const projects = await listProjects();
    const view = await Promise.all(projects.map(toView));
    res.json({ projects: view });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const areq = req as AuthedRequest;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) throw httpError(400, 'title is required');
    const assignedTo = typeof req.body?.assignedTo === 'string' ? req.body.assignedTo : '';

    const user = await findUserById(areq.userId);
    if (!user) throw httpError(401, 'User not found');

    await ensureProjectsSheet();
    const existing = await listProjects();
    const id = generateUniqueId(existing.map((p) => p.id), 'P');

    const folderId = await createSubFolder(title, rootFolderId());
    let sheetId = '';
    let docId = '';
    try {
      sheetId = await createTasksSheet(title, folderId);
      docId = await createNotesDoc(title, folderId);
    } catch (err) {
      try {
        await trashFolder(folderId);
      } catch (cleanupErr) {
        console.warn('[projects.create] cleanup trashFolder failed:', cleanupErr);
      }
      throw httpError(502, `Failed to provision project artifacts: ${(err as Error).message}`);
    }

    const now = new Date().toISOString();
    const project: Project = {
      id,
      title,
      ownerEmail: user.email,
      assignedTo,
      sheetId,
      docId,
      folderId,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };
    await appendProject(project);
    res.status(201).json({ project: await toView(project) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id ?? '');
    if (!id) throw httpError(400, 'project id is required');
    const project = await getProject(id);
    if (!project) throw httpError(404, 'Project not found');
    res.json({ project: await toView(project) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id ?? '');
    if (!id) throw httpError(400, 'project id is required');
    const patch: Partial<Project> = {};
    if (typeof req.body?.title === 'string') patch.title = req.body.title.trim();
    if (typeof req.body?.assignedTo === 'string') patch.assignedTo = req.body.assignedTo;
    if (typeof req.body?.status === 'string' && (req.body.status === 'Active' || req.body.status === 'Archived')) {
      patch.status = req.body.status;
    }
    const updated = await updateProject(id, patch);
    res.json({ project: await toView(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id ?? '');
    if (!id) throw httpError(400, 'project id is required');
    const project = await getProject(id);
    if (!project) throw httpError(404, 'Project not found');
    if (project.folderId) {
      try {
        await trashFolder(project.folderId);
      } catch (e) {
        console.warn('[projects.delete] trashFolder failed (project still removed)', e);
      }
    }
    await removeProject(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/recreate-doc', requireAuth, async (req, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id ?? '');
    if (!id) throw httpError(400, 'project id is required');
    const project = await getProject(id);
    if (!project) throw httpError(404, 'Project not found');
    const newDocId = await createNotesDoc(project.title, project.folderId);
    const updated = await updateProject(id, { docId: newDocId });
    res.json({ project: await toView(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
