import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './db/store.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`Kanbot API listening on http://localhost:${env.PORT}/api`);
  console.log(`  CORS origin(s): ${env.clientOrigins.join(', ')}`);
  console.log(`  AI assistant:   ${env.aiEnabled ? `${env.AI_MODEL} via ${env.AI_BASE_URL}` : 'mock (set AI_API_KEY in .env for a real model)'}`);
});

async function shutdown() {
  server.close();
  await db.flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
