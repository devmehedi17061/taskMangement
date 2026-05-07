import 'dotenv/config';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';

const app = express();

// Vercel/Node serverless sits behind a TLS-terminating proxy.
// Without this, secure cookies + req.protocol detection misbehave.
app.set('trust proxy', 1);

const explicitOrigin = process.env.CLIENT_ORIGIN;
const corsOptions = explicitOrigin
  ? { origin: explicitOrigin, credentials: true }
  : {
      // No CLIENT_ORIGIN set: reflect the request origin. On Vercel the client
      // and the API share an origin so this is effectively a no-op anyway.
      origin: true,
      credentials: true,
    };

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/tasks', tasksRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[api error]', err);
  const status = (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number')
    ? err.status
    : 500;
  const message = (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string')
    ? err.message
    : 'Internal error';
  res.status(status).json({ error: message });
};
app.use(errorHandler);

export default app;
