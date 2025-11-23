require('dotenv').config({ path: '.env.local' });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./lib/logger.cjs');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const JWT_SECRET = process.env.JWT_SECRET;
const NEXT_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!JWT_SECRET) {
  logger.warn('Warning: JWT_SECRET is not set in environment. Socket auth will not work.');
} else {
  logger.info('JWT_SECRET is set successfully');
}

io.use((socket, next) => {
  // Basic auth: token passed in `auth` object at connect time
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    const err = new Error('Unauthorized: missing token');
    err.data = { code: 'NO_TOKEN' };
    return next(err);
  }
  try {
    const user = jwt.verify(token, JWT_SECRET);
    // attach user info to socket for later checks
    socket.user = user;
    socket.token = token;
    return next();
  } catch (e) {
    const err = new Error('Unauthorized: invalid token');
    err.data = { code: 'INVALID_TOKEN' };
    return next(err);
  }
});

io.on('connection', (socket) => {
  logger.info('Socket connected', socket.id, 'user=', socket.user && socket.user.id);

  socket.on('join-board', async (boardId) => {
    try {
      if (!boardId) return socket.emit('join-denied', { reason: 'missing_boardId' });

      // Verify membership by calling the Next.js API with the same token
      const res = await fetch(`${NEXT_APP_URL}/api/boards`, {
        headers: { Authorization: `Bearer ${socket.token}` }
      });
      if (!res.ok) return socket.emit('join-denied', { reason: 'failed_lookup' });
      const payload = await res.json();
      const boards = payload.boards || [];
      const allowed = boards.some(b => String(b._id) === String(boardId));
      if (!allowed) {
        logger.warn(`Socket ${socket.id} denied joining board ${boardId}`);
        return socket.emit('join-denied', { reason: 'not_member' });
      }
      socket.join(boardId);
      logger.info(`Socket ${socket.id} joined board ${boardId}`);
      socket.emit('joined', { boardId });
    } catch (err) {
      console.error('join-board error', err);
      socket.emit('join-denied', { reason: 'error' });
    }
  });

  socket.on('leave-board', (boardId) => {
    if (!boardId) return;
    socket.leave(boardId);
    logger.info(`Socket ${socket.id} left board ${boardId}`);
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected', socket.id);
  });
});

// HTTP endpoint to broadcast events from server-side API handlers
app.get('/', (req, res) => {
  res.json({ status: 'Socket server running', port: process.env.PORT });
});

app.post('/broadcast', (req, res) => {
  try {
    const { event, boardId, data } = req.body || {};
    if (!event) return res.status(400).json({ error: 'Missing event' });

    if (boardId) {
      io.to(boardId).emit(event, { boardId, data });
      logger.info(`Emitted event ${event} to board ${boardId}`);
    } else {
      io.emit(event, { boardId: null, data });
      logger.info(`Emitted event ${event} to all`);
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, 'broadcast error');
    return res.status(500).json({ error: 'broadcast failed' });
  }
});

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => {
  logger.info(`Socket server listening on ${PORT}`);
});
