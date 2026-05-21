import { createServerApp } from '@mcp-demos/shared';
import { seedB2BData } from './data/seed.js';
import { registerB2BTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] || '3002', 10);

const { db, start } = createServerApp(
  (server, db, getSessionId) => {
    seedB2BData(db);
    registerB2BTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Industrial Supply — B2B reorder and quotes',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

start();
