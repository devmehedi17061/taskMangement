interface ConfigCache {
  rootFolderId: string;
  usersSheetId: string;
  projectsSheetId: string;
}

const cache: ConfigCache = {
  rootFolderId: '',
  usersSheetId: '',
  projectsSheetId: '',
};

export function setAppConfig(c: Partial<ConfigCache>): void {
  if (c.rootFolderId !== undefined) cache.rootFolderId = c.rootFolderId;
  if (c.usersSheetId !== undefined) cache.usersSheetId = c.usersSheetId;
  if (c.projectsSheetId !== undefined) cache.projectsSheetId = c.projectsSheetId;
}

function resolved(envName: string, cacheVal: string): string {
  const env = process.env[envName];
  if (env && env.trim()) return env.trim();
  if (cacheVal) return cacheVal;
  throw new Error(
    `${envName} is not set and no value has been provisioned yet — run server boot once with the service-account JSON in place so the install step can run.`,
  );
}

export function getRootFolderId(): string {
  return resolved('APP_ROOT_FOLDER_ID', cache.rootFolderId);
}

export function getUsersSheetId(): string {
  return resolved('USERS_SHEET_ID', cache.usersSheetId);
}

export function getProjectsSheetId(): string {
  return resolved('PROJECTS_SHEET_ID', cache.projectsSheetId);
}

export function snapshotAppConfig(): ConfigCache {
  return { ...cache };
}
