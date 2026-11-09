import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const db = openDb();
const clientDist = process.env.CLIENT_DIST ?? path.join(here, '..', '..', 'client', 'dist');
const app = createApp(db, { clientDist });

const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => {
  console.log(`Football stats API listening on http://localhost:${port}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
