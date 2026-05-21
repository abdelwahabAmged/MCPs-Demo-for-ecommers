import { createServerApp } from '@mcp-demos/shared';
import { seedInternalSalesData } from './data/seed.js';
import { registerInternalSalesTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] || '3005', 10);

const { db, start } = createServerApp(
  (server, db, getSessionId) => {
    seedInternalSalesData(db);
    registerInternalSalesTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Industrial Supply — Internal (Sales Rep Assistant)',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

start();
