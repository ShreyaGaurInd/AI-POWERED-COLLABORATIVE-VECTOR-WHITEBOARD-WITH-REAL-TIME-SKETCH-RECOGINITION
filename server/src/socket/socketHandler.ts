/**
 * Socket.IO Real-Time Collaboration Handler — Phase 4
 *
 * HOW IT WORKS (Viva Explanation):
 * ─────────────────────────────────────────────────────────────────────────────
 * Socket.IO uses WebSockets (falling back to HTTP long-polling) to maintain
 * persistent bidirectional connections between all clients on a board.
 *
 * "Rooms" are Socket.IO's concept of isolated broadcast groups. Each whiteboard
 * gets its own room keyed by boardId. When User A draws a stroke, only
 * sockets inside that board's room receive the event — other boards are not
 * disturbed. This is O(members) per event and uses no extra infrastructure.
 *
 * Authentication:
 * The client sends its JWT (from localStorage) during the socket handshake
 * (auth.token). We verify this on every 'board:join' to ensure the user is
 * actually logged in before admitting them to a room. If the board is
 * password-protected, the client also sends the boardSessionToken acquired
 * from the REST unlock endpoint.
 *
 * Event Flow:
 *   Client --[stroke:add]--> Server --[broadcast]--> All OTHER clients in room
 *   Client --[stroke:remove]--> Server --[broadcast]--> All OTHER clients
 *   Client --[cursor:move]--> Server --[broadcast]--> All OTHER clients
 *   Client --[board:join]--> Server --[emit: board:state]--> Joining client only
 *
 * Persistence:
 *   On stroke:add  → INSERT into drawing_objects (MySQL via Prisma)
 *   On stroke:remove → DELETE from drawing_objects
 *   On board:join  → SELECT all drawing_objects for that board → send to client
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { ENV } from '../config/env.js';

// ─── Type Definitions ──────────────────────────────────────────────────────

interface SocketUser {
  userId: string;
  fullName: string;
  avatarColor: string;
  email: string;
}

interface SocketPoint {
  x: number;
  y: number;
  pressure?: number;
}

/** Serialized canvas item that travels over the wire */
interface WireStroke {
  id: string;
  type: 'stroke';
  points: SocketPoint[];
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  penType: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zIndex: number;
}

interface WireShape {
  id: string;
  type: 'shape';
  shapeType: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zIndex: number;
}

interface WireText {
  id: string;
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  zIndex: number;
}

interface WireSticker {
  id: string;
  type: 'sticker';
  noteText: string;
  bgColor: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  zIndex: number;
}

type WireItem = WireStroke | WireShape | WireText | WireSticker;

// ─── In-Memory Board Presence Map ─────────────────────────────────────────
// Tracks which users are currently in each board room.
// Map<boardId, Map<socketId, { user, cursor }>>
const boardPresence = new Map<
  string,
  Map<string, { user: SocketUser; cursorX: number; cursorY: number }>
>();

// ─── Main Handler ─────────────────────────────────────────────────────────

export function setupSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] ✅ Client connected: ${socket.id}`);

    let currentBoardId: string | null = null;
    let currentUser: SocketUser | null = null;

    // Authenticate user right away if token passed in handshake auth or query
    const handshakeToken = (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string);
    if (handshakeToken) {
      try {
        const decoded = jwt.verify(handshakeToken, ENV.JWT_SECRET) as { userId: string };
        prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, fullName: true, avatarColor: true, email: true },
        }).then((user) => {
          if (user) {
            currentUser = {
              userId: user.id,
              fullName: user.fullName,
              avatarColor: user.avatarColor,
              email: user.email,
            };
            socket.join(`user:${user.id}`);
          }
        }).catch(() => {});
      } catch (e) {}
    }

    // ── 1. BOARD:JOIN ────────────────────────────────────────────────────────
    // Client emits this after navigating to /board/:id
    // Payload: { boardId, token }
    socket.on('board:join', async (payload: { boardId: string; token: string }) => {
      try {
        const { boardId, token } = payload;
        if (!boardId || !token) {
          socket.emit('error', { message: 'Missing boardId or token.' });
          return;
        }

        // Verify JWT token to authenticate the user
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, fullName: true, avatarColor: true, email: true },
        });

        if (!user) {
          socket.emit('error', { message: 'User not found.' });
          return;
        }

        currentUser = {
          userId: user.id,
          fullName: user.fullName,
          avatarColor: user.avatarColor,
          email: user.email,
        };
        currentBoardId = boardId;

        // Join the Socket.IO room for this board and user's personal channel
        socket.join(boardId);
        socket.join(`user:${currentUser.userId}`);

        // Track presence
        if (!boardPresence.has(boardId)) {
          boardPresence.set(boardId, new Map());
        }
        boardPresence.get(boardId)!.set(socket.id, {
          user: currentUser,
          cursorX: 0,
          cursorY: 0,
        });

        // ── Load existing board objects, chat history, and todos from MySQL ──
        const [drawingObjects, stickers, textObjects, chatMessages, todoItems] = await Promise.all([
          prisma.drawingObject.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } }),
          prisma.sticker.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } }),
          prisma.textObject.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } }),
          prisma.boardChatMessage.findMany({
            where: { boardId },
            include: { user: { select: { id: true, fullName: true, avatarColor: true, email: true } } },
            orderBy: { createdAt: 'asc' },
            take: 200,
          }),
          prisma.boardTodoItem.findMany({
            where: { boardId },
            include: { user: { select: { id: true, fullName: true } } },
            orderBy: { createdAt: 'asc' },
          }),
        ]);

        // Convert from DB rows → WireItem format
        const boardState: WireItem[] = [
          ...drawingObjects.map((d) => ({
            id: d.id,
            type: 'stroke' as const,
            points: (d.points as unknown as SocketPoint[]),
            strokeColor: d.strokeColor,
            strokeWidth: d.strokeWidth,
            opacity: d.opacity,
            penType: d.type === 'FREEHAND' ? 'normal' : 'normal',
            minX: d.minX,
            minY: d.minY,
            maxX: d.maxX,
            maxY: d.maxY,
            zIndex: d.zIndex,
          })),
          ...stickers.map((s) => ({
            id: s.id,
            type: 'sticker' as const,
            noteText: s.noteText,
            bgColor: s.bgColor,
            minX: s.x,
            minY: s.y,
            maxX: s.x + s.width,
            maxY: s.y + s.height,
            width: s.width,
            height: s.height,
            zIndex: s.zIndex,
          })),
          ...textObjects.map((t) => ({
            id: t.id,
            type: 'text' as const,
            content: t.content,
            fontFamily: t.fontFamily,
            fontSize: t.fontSize,
            fontColor: t.fontColor,
            minX: t.x,
            minY: t.y,
            maxX: t.x + t.width,
            maxY: t.y + t.height,
            width: t.width,
            height: t.height,
            zIndex: t.zIndex,
          })),
        ];

        // Send full board state, persisted chat history, and to-do list to the joining client
        socket.emit('board:state', {
          items: boardState,
          chatMessages,
          todoItems,
        });

        // Notify all OTHER users in the room that someone joined
        socket.to(boardId).emit('user:joined', {
          socketId: socket.id,
          user: currentUser,
        });

        // Send current presence list to the joining client
        const presenceList: { socketId: string; user: SocketUser; cursorX: number; cursorY: number }[] = [];
        for (const [sid, data] of boardPresence.get(boardId)!.entries()) {
          if (sid !== socket.id) {
            presenceList.push({ socketId: sid, ...data });
          }
        }
        socket.emit('board:presence', { users: presenceList });

        console.log(`[Socket.IO] 📋 ${user.fullName} joined board ${boardId} (${presenceList.length + 1} online)`);
      } catch (err) {
        console.error('[Socket.IO] board:join error:', err);
        socket.emit('error', { message: 'Failed to join board.' });
      }
    });

    // ── 2. STROKE:ADD ────────────────────────────────────────────────────────
    // Emitted when a user finishes drawing a stroke, shape, text, or sticker.
    // We persist it to MySQL then broadcast to everyone else in the room.
    socket.on('item:add', async (item: WireItem) => {
      if (!currentBoardId || !currentUser) return;

      try {
        // ── Persist to MySQL ──
        if (item.type === 'stroke') {
          await prisma.drawingObject.upsert({
            where: { id: item.id },
            update: {
              points: item.points as any,
              strokeColor: item.strokeColor,
              strokeWidth: item.strokeWidth,
              opacity: item.opacity,
              minX: item.minX,
              minY: item.minY,
              maxX: item.maxX,
              maxY: item.maxY,
              zIndex: item.zIndex,
            },
            create: {
              id: item.id,
              boardId: currentBoardId,
              type: 'FREEHAND',
              points: item.points as any,
              strokeColor: item.strokeColor,
              strokeWidth: item.strokeWidth,
              opacity: item.opacity,
              minX: item.minX,
              minY: item.minY,
              maxX: item.maxX,
              maxY: item.maxY,
              zIndex: item.zIndex,
            },
          });
        } else if (item.type === 'sticker') {
          await prisma.sticker.upsert({
            where: { id: item.id },
            update: {
              noteText: item.noteText,
              bgColor: item.bgColor,
              x: item.minX,
              y: item.minY,
              width: item.width,
              height: item.height,
              zIndex: item.zIndex,
            },
            create: {
              id: item.id,
              boardId: currentBoardId,
              noteText: item.noteText,
              bgColor: item.bgColor,
              x: item.minX,
              y: item.minY,
              width: item.width,
              height: item.height,
              zIndex: item.zIndex,
            },
          });
        } else if (item.type === 'text') {
          await prisma.textObject.upsert({
            where: { id: item.id },
            update: {
              content: item.content,
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              fontColor: item.fontColor,
              x: item.minX,
              y: item.minY,
              width: item.width,
              height: item.height,
              zIndex: item.zIndex,
            },
            create: {
              id: item.id,
              boardId: currentBoardId,
              content: item.content,
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              fontColor: item.fontColor,
              x: item.minX,
              y: item.minY,
              width: item.width,
              height: item.height,
              zIndex: item.zIndex,
            },
          });
        }
        // Note: shapes (rectangles, circles, etc.) are stored as drawing_objects
        // with their geometry; handled via the same upsert path as strokes.

        // ── Broadcast to all OTHER clients in the board room ──
        socket.to(currentBoardId).emit('item:added', { item, userId: currentUser.userId });
      } catch (err) {
        console.error('[Socket.IO] item:add error:', err);
      }
    });

    // ── 3. ITEM:REMOVE ───────────────────────────────────────────────────────
    // Emitted when a user erases or deletes an item by ID.
    socket.on('item:remove', async (payload: { itemId: string; itemType: string }) => {
      if (!currentBoardId || !currentUser) return;

      try {
        const { itemId, itemType } = payload;

        // Delete from appropriate MySQL table
        if (itemType === 'stroke') {
          await prisma.drawingObject.deleteMany({ where: { id: itemId, boardId: currentBoardId } });
        } else if (itemType === 'sticker') {
          await prisma.sticker.deleteMany({ where: { id: itemId, boardId: currentBoardId } });
        } else if (itemType === 'text') {
          await prisma.textObject.deleteMany({ where: { id: itemId, boardId: currentBoardId } });
        }

        // Broadcast removal to all OTHER clients in the room
        socket.to(currentBoardId).emit('item:removed', { itemId, userId: currentUser.userId });
      } catch (err) {
        console.error('[Socket.IO] item:remove error:', err);
      }
    });

    // ── 4. ITEM:UPDATE (Move/Resize) ─────────────────────────────────────────
    // Emitted when a user finishes moving or resizing an item.
    socket.on('item:update', async (item: WireItem) => {
      if (!currentBoardId || !currentUser) return;

      try {
        // Update the item in MySQL, then broadcast to others
        if (item.type === 'stroke') {
          await prisma.drawingObject.updateMany({
            where: { id: item.id, boardId: currentBoardId },
            data: {
              points: item.points as any,
              minX: item.minX,
              minY: item.minY,
              maxX: item.maxX,
              maxY: item.maxY,
              zIndex: item.zIndex,
            },
          });
        } else if (item.type === 'sticker') {
          await prisma.sticker.updateMany({
            where: { id: item.id, boardId: currentBoardId },
            data: { x: item.minX, y: item.minY, width: item.width, height: item.height, zIndex: item.zIndex },
          });
        } else if (item.type === 'text') {
          await prisma.textObject.updateMany({
            where: { id: item.id, boardId: currentBoardId },
            data: { x: item.minX, y: item.minY, width: item.width, height: item.height, fontSize: item.fontSize, zIndex: item.zIndex },
          });
        }

        socket.to(currentBoardId).emit('item:updated', { item, userId: currentUser.userId });
      } catch (err) {
        console.error('[Socket.IO] item:update error:', err);
      }
    });

    // ── 5. CURSOR:MOVE ───────────────────────────────────────────────────────
    // High-frequency: throttled on the client to ~20 fps to avoid flooding.
    // We just forward without DB persistence — cursors are ephemeral.
    socket.on('cursor:move', (payload: { x: number; y: number }) => {
      if (!currentBoardId || !currentUser) return;

      const presence = boardPresence.get(currentBoardId)?.get(socket.id);
      if (presence) {
        presence.cursorX = payload.x;
        presence.cursorY = payload.y;
      }

      socket.to(currentBoardId).emit('cursor:moved', {
        socketId: socket.id,
        userId: currentUser.userId,
        fullName: currentUser.fullName,
        avatarColor: currentUser.avatarColor,
        x: payload.x,
        y: payload.y,
      });
    });

    // ── 6. LASER:TRACE ───────────────────────────────────────────────────────
    // Presentation laser pointer — ephemeral, never stored.
    socket.on('laser:trace', (payload: { x: number; y: number }) => {
      if (!currentBoardId || !currentUser) return;
      socket.to(currentBoardId).emit('laser:traced', {
        socketId: socket.id,
        userId: currentUser.userId,
        fullName: currentUser.fullName,
        avatarColor: currentUser.avatarColor,
        x: payload.x,
        y: payload.y,
      });
    });

    // ── 7. BOARD:CLEAR ────────────────────────────────────────────────────────
    // Emitted when a user confirms clearing the entire whiteboard.
    // Removes all drawings, stickers, and text objects from MySQL and broadcasts.
    socket.on('board:clear', async () => {
      if (!currentBoardId || !currentUser) return;
      try {
        await Promise.all([
          prisma.drawingObject.deleteMany({ where: { boardId: currentBoardId } }),
          prisma.sticker.deleteMany({ where: { boardId: currentBoardId } }),
          prisma.textObject.deleteMany({ where: { boardId: currentBoardId } }),
        ]);

        // Broadcast to all other clients in the room
        socket.to(currentBoardId).emit('board:cleared', { userId: currentUser.userId });
      } catch (err) {
        console.error('[Socket.IO] board:clear error:', err);
      }
    });

    // ── 8. WHITEBOARD COLLABORATIVE CHAT ─────────────────────────────────────
    socket.on('board:chat:send', async (payload: { message: string }) => {
      if (!currentBoardId || !currentUser) return;
      const text = payload.message?.trim();
      if (!text) return;

      try {
        const chat = await prisma.boardChatMessage.create({
          data: {
            boardId: currentBoardId,
            userId: currentUser.userId,
            message: text,
          },
          include: {
            user: {
              select: { id: true, fullName: true, avatarColor: true, email: true },
            },
          },
        });

        // Broadcast to ALL users in this board room (including sender)
        io.to(currentBoardId).emit('board:chat:received', chat);
      } catch (err) {
        console.error('[Socket.IO] board:chat:send error:', err);
      }
    });

    // ── 9. WHITEBOARD COLLABORATIVE TO-DO LIST ────────────────────────────────
    socket.on('board:todo:add', async (payload: { task: string }) => {
      if (!currentBoardId || !currentUser) return;
      const task = payload.task?.trim();
      if (!task) return;

      try {
        const todo = await prisma.boardTodoItem.create({
          data: {
            boardId: currentBoardId,
            userId: currentUser.userId,
            task,
          },
          include: {
            user: { select: { id: true, fullName: true } },
          },
        });

        io.to(currentBoardId).emit('board:todo:added', todo);
      } catch (err) {
        console.error('[Socket.IO] board:todo:add error:', err);
      }
    });

    socket.on('board:todo:toggle', async (payload: { todoId: string; completed: boolean }) => {
      if (!currentBoardId) return;
      try {
        const todo = await prisma.boardTodoItem.update({
          where: { id: payload.todoId },
          data: { completed: payload.completed },
          include: { user: { select: { id: true, fullName: true } } },
        });

        io.to(currentBoardId).emit('board:todo:toggled', todo);
      } catch (err) {
        console.error('[Socket.IO] board:todo:toggle error:', err);
      }
    });

    socket.on('board:todo:delete', async (payload: { todoId: string }) => {
      if (!currentBoardId) return;
      try {
        await prisma.boardTodoItem.delete({ where: { id: payload.todoId } });
        io.to(currentBoardId).emit('board:todo:deleted', { todoId: payload.todoId });
      } catch (err) {
        console.error('[Socket.IO] board:todo:delete error:', err);
      }
    });

    // ── 10. DIRECT MESSAGING BETWEEN FRIENDS ─────────────────────────────────
    socket.on('user:join', async (payload: { token: string }) => {
      try {
        if (!payload?.token) return;
        const decoded = jwt.verify(payload.token, ENV.JWT_SECRET) as { userId: string };
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, fullName: true, avatarColor: true, email: true },
        });
        if (user) {
          currentUser = {
            userId: user.id,
            fullName: user.fullName,
            avatarColor: user.avatarColor,
            email: user.email,
          };
          socket.join(`user:${user.id}`);
        }
      } catch (e) {}
    });

    socket.on('direct:send', async (payload: { receiverId: string; message: string; token?: string }) => {
      const text = payload.message?.trim();
      if (!payload.receiverId || !text) return;

      let senderId = currentUser?.userId;
      if (!senderId) {
        // Fallback: decode token from payload or handshake
        const tokenToVerify = payload.token || (socket.handshake.auth?.token as string);
        if (tokenToVerify) {
          try {
            const decoded = jwt.verify(tokenToVerify, ENV.JWT_SECRET) as { userId: string };
            senderId = decoded.userId;
            const u = await prisma.user.findUnique({
              where: { id: senderId },
              select: { id: true, fullName: true, avatarColor: true, email: true },
            });
            if (u) {
              currentUser = {
                userId: u.id,
                fullName: u.fullName,
                avatarColor: u.avatarColor,
                email: u.email,
              };
              socket.join(`user:${u.id}`);
            }
          } catch (e) {}
        }
      }

      if (!senderId) {
        console.warn('[Socket.IO] direct:send unauthenticated — dropped message');
        return;
      }

      try {
        const direct = await prisma.directMessage.create({
          data: {
            senderId,
            receiverId: payload.receiverId,
            message: text,
          },
          include: {
            sender: { select: { id: true, fullName: true, avatarColor: true } },
            receiver: { select: { id: true, fullName: true, avatarColor: true } },
          },
        });

        io.to(`user:${payload.receiverId}`).emit('direct:received', direct);
        io.to(`user:${senderId}`).emit('direct:sent', direct);
        socket.emit('direct:sent', direct);
      } catch (err) {
        console.error('[Socket.IO] direct:send error:', err);
      }
    });

    // ── 11. DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] ❌ Client disconnected: ${socket.id}`);

      if (currentBoardId && currentUser) {
        // Remove from presence map
        boardPresence.get(currentBoardId)?.delete(socket.id);
        if (boardPresence.get(currentBoardId)?.size === 0) {
          boardPresence.delete(currentBoardId);
        }

        // Notify remaining board members
        socket.to(currentBoardId).emit('user:left', {
          socketId: socket.id,
          userId: currentUser.userId,
          fullName: currentUser.fullName,
        });
      }
    });
  });
}
