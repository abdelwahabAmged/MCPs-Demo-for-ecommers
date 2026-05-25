import { createServerApp } from '@mcp-demos/shared';
import { seedPartsData } from './data/seed.js';
import { registerPartsTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] || '3003', 10);

const { db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerPartsTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Parts Co — Find the right part for your vehicle',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

seedPartsData(db);
start();
