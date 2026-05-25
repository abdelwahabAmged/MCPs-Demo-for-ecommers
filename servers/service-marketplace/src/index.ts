import { createServerApp } from '@mcp-demos/shared';
import { seedServiceMarketplaceData } from './data/seed.js';
import { registerServiceMarketplaceTools } from './tools.js';

const PORT = parseInt(process.env['PORT'] || '3004', 10);

const { db, start } = createServerApp(
  (server, db, getSessionId) => {
    registerServiceMarketplaceTools(server, db, getSessionId);
  },
  {
    serverName: 'Acme Home Services — Book a local tradesperson',
    serverVersion: '1.0.0',
    port: PORT,
  },
);

seedServiceMarketplaceData(db);
start();
