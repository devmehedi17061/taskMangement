export interface HttpError extends Error {
  status: number;
}

export function httpError(status: number, message: string): HttpError {
  const e = new Error(message) as HttpError;
  e.status = status;
  return e;
}
