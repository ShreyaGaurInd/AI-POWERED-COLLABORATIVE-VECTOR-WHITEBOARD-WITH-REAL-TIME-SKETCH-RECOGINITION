import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { ENV } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { folderRouter } from './routes/folderRoutes.js';
import { whiteboardRouter } from './routes/whiteboardRoutes.js';
import { friendRouter } from './routes/friendRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { setupSocketHandlers } from './socket/socketHandler.js';

// Initialize Express App
const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO with CORS
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // In development allow all; configurable via CLIENT_URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Global Middlewares
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CollabWhiteboard API',
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/folders', folderRouter);
app.use('/api/whiteboards', whiteboardRouter);
app.use('/api/friends', friendRouter);

// Centralized Error Handler (must be last middleware)
app.use(errorHandler);

// Socket.IO Real-Time Collaboration (Phase 4)
// All whiteboard events (draw, erase, move, cursor) are handled here.
setupSocketHandlers(io);

// Start HTTP + WebSocket Server
const PORT = parseInt(ENV.PORT, 10);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ======================================================
  CollabWhiteboard Backend Server Running!
  ------------------------------------------------------
  * REST API:     http://localhost:${PORT}/api
  * Health Check: http://localhost:${PORT}/api/health
  * Environment:  ${ENV.NODE_ENV}
  ======================================================
  `);
});

export default app;
