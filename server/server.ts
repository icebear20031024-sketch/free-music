import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { setupRoutes } from './routes.js';
import { pluginManager } from './plugin-manager.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './utils/logger.js';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.url}`);
  next();
});

async function startServer() {
  try {
    // Initialize plugins
    await pluginManager.initialize();
    
    // Setup API routes
    setupRoutes(app);

    // Setup Vite for development or static serving for production
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.join(process.cwd(), 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      });
    }

    // Global error handler
    app.use(errorHandler);

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
  }
}

startServer();
