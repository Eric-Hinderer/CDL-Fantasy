import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config/index.js';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authRouter } from './routes/auth.js';
import { leaguesRouter } from './routes/leagues.js';
import { playersRouter } from './routes/players.js';
import { lineupsRouter } from './routes/lineups.js';
import { matchupsRouter } from './routes/matchups.js';
import { draftRouter } from './routes/draft.js';
import { standingsRouter } from './routes/standings.js';
import { setupDraftSocket } from './sockets/draft.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
  },
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fantasy CDL API',
      version: '1.0.0',
      description: 'API for Fantasy Call of Duty League application',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(rateLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_, res) => res.json(swaggerSpec));

// Health check
app.get('/health', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/players', playersRouter);
app.use('/api/lineups', lineupsRouter);
app.use('/api/matchups', matchupsRouter);
app.use('/api/draft', draftRouter);
app.use('/api/standings', standingsRouter);

// Error handling
app.use(errorHandler);

// Socket.io for draft
setupDraftSocket(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📚 API docs available at http://localhost:${config.port}/api-docs`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io };
