import { createServerApp } from '@mcp-demos/shared';
import { seedB2CData } from './data/seed.js';
import { registerB2CTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] || '3001', 10);

const { db, start } = createServerApp(
  (server, db, getSessionId) => {
    seedB2CData(db);
    registerB2CTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Sports — Shop, search, and track orders',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

start();
