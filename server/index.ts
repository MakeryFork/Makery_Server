import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import postsRouter from './routes/posts';
import purchasesRouter from './routes/purchases';
import videoProjectsRouter from './routes/video-projects';
import tagsRouter from './routes/tags';

const app = express();

app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(session({ secret: env.sessionSecret, resave: false, saveUninitialized: false }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/purchases', purchasesRouter);
app.use('/api/v1/video-projects', videoProjectsRouter);
app.use('/api/v1/tags', tagsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});

export default app;
