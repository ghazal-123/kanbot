import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { aiSource, chat, generateTodos, planSprint, summarizeSprint } from '../ai/assistant.service.js';
import { env } from '../config/env.js';
import { db } from '../db/store.js';
import { AppError, conflict } from '../lib/errors.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { getProject, getSprint, now, toSprint } from '../services/board.service.js';
import type {
  AiStatusResponse,
  ChatResponse,
  GenerateTodosResponse,
  PlanSprintResponse,
  SprintSummaryResponse,
} from '../types/api.js';

/** Mounted at /api. */
export const aiRouter = Router();

// Free AI tiers have low limits; this keeps a stuck useEffect loop from burning them.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many AI requests. Wait a minute and try again.')),
});

aiRouter.get('/ai/status', (_req, res) => {
  res.json({ mode: aiSource(), model: env.aiEnabled ? env.AI_MODEL : null } satisfies AiStatusResponse);
});

aiRouter.post('/projects/:projectId/ai/generate-todos', aiLimiter, async (req, res) => {
  const project = getProject(currentUser(req).id, String(req.params.projectId));
  const body = parse(
    z.object({
      prompt: z.string().trim().min(3, 'Describe what you want to build').max(2000),
      count: z.number().int().min(1).max(10).default(5),
    }),
    req.body,
  );
  const todos = await generateTodos(project, body.prompt, body.count);
  res.json({ todos, source: aiSource() } satisfies GenerateTodosResponse);
});

aiRouter.post('/projects/:projectId/ai/plan-sprint', aiLimiter, async (req, res) => {
  const project = getProject(currentUser(req).id, String(req.params.projectId));
  const body = parse(
    z.object({
      capacity: z.number().int('Capacity must be a whole number').min(1).max(200),
      focus: z.string().trim().max(300).optional(),
    }),
    req.body,
  );
  const plan = await planSprint(project, body.capacity, body.focus || undefined);
  res.json({ ...plan, source: aiSource() } satisfies PlanSprintResponse);
});

aiRouter.post('/sprints/:sprintId/ai/summary', aiLimiter, async (req, res) => {
  const { sprint, project } = getSprint(currentUser(req).id, String(req.params.sprintId));
  if (sprint.status === 'planned') throw conflict('A planned sprint has nothing to summarize yet. Start it first.');
  const content = await summarizeSprint(project, sprint);
  const summary = { content, source: aiSource(), generatedAt: now() };
  db.write(() => {
    sprint.summary = summary;
    sprint.updatedAt = now();
  });
  res.json({ sprint: toSprint(sprint), summary } satisfies SprintSummaryResponse);
});

aiRouter.post('/projects/:projectId/ai/chat', aiLimiter, async (req, res) => {
  const project = getProject(currentUser(req).id, String(req.params.projectId));
  const { messages } = parse(
    z.object({
      messages: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
        .min(1)
        .max(30)
        .refine((m) => m.at(-1)?.role === 'user', 'The last message must be from the user'),
    }),
    req.body,
  );
  const content = await chat(project, messages);
  res.json({ message: { role: 'assistant', content }, source: aiSource() } satisfies ChatResponse);
});
