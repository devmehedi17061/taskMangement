import { google, type drive_v3 } from 'googleapis';
import { getOwnerClient } from '../lib/ownerClient.js';
import { getRootFolderId } from '../lib/appConfig.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function drive(): Promise<drive_v3.Drive> {
  const auth = await getOwnerClient();
  return google.drive({ version: 'v3', auth });
}

export function rootFolderId(): string {
  return getRootFolderId();
}

export async function createSubFolder(name: string, parentId: string): Promise<string> {
  const d = await drive();
  const { data } = await d.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!data.id) throw new Error('Drive sub-folder create returned no id');
  return data.id;
}

export async function moveFileToFolder(fileId: string, targetFolderId: string): Promise<void> {
  const d = await drive();
  const { data } = await d.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  });
  const previousParents = (data.parents ?? []).join(',');
  await d.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: previousParents || undefined,
    fields: 'id, parents',
    supportsAllDrives: true,
  });
}

export async function trashFolder(folderId: string): Promise<void> {
  const d = await drive();
  await d.files.update({
    fileId: folderId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

export async function shareAnyoneReader(fileId: string): Promise<void> {
  const d = await drive();
  await d.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
}

export async function fileExists(fileId: string): Promise<boolean> {
  try {
    const d = await drive();
    const { data } = await d.files.get({
      fileId,
      fields: 'id, trashed',
      supportsAllDrives: true,
    });
    return Boolean(data.id) && !data.trashed;
  } catch {
    return false;
  }
}
