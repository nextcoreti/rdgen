// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './routes/api';
import { basicAuth } from './middleware/basicAuth';
import logger from './utils/logger';
import clientsRoutes from './routes/clients';
import { ensureClientProfileKey } from './services/cryptoService';
import { initClientStore } from './services/clientStore';
import { initUserStore } from './services/userStore';
import { runMigration } from './services/migrate';

// Migrate existing JSON data to SQLite (no-op if already done)
runMigration();

// Initialize user store (creates admin from .env if needed)
initUserStore();

// Validate CLIENT_PROFILE_KEY at startup (fail-fast if missing/invalid)
ensureClientProfileKey();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Serve API documentation (public - no auth required)
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

app.get('/swagger.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'swagger.json'));
});

// Apply basic auth middleware (skips public endpoints like GitHub callbacks)
app.use('/api', basicAuth);

// API routes
app.use('/api', apiRoutes);

// Client profiles routes (encrypted client management)
app.use('/api/clients', clientsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`RDGen Backend running on port ${PORT}`);
  logger.info(`Mock mode: ${!process.env.GITHUB_TOKEN ? 'enabled' : 'disabled'}`);

  if (!process.env.GITHUB_TOKEN) {
    logger.warn('GITHUB_TOKEN not set - running in mock mode');
    logger.warn('Set GITHUB_TOKEN in .env to enable real GitHub Actions builds');
  }

  // Ensure clients data directory exists
  initClientStore();
});

export default app;
