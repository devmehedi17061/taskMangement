import 'dotenv/config';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
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
