/**
 * useSocket — Phase 4 Real-Time Collaboration Hook
 *
 * HOW IT WORKS (Viva Explanation):
 * ─────────────────────────────────────────────────────────────────────────────
 * This hook wraps the Socket.IO client. It connects once when the board loads,
 * sends `board:join` with the user's JWT, then listens for all collaboration
 * events (item added/removed/updated, cursors, presence).
 *
 * Key design decisions:
 *   • Cursor move is THROTTLED to 20 fps (50 ms minimum between emits).
 *     Without throttling, every pointer-move fires a socket event — that's
 *     potentially 60+ events/second per user. Throttling keeps it smooth but
 *     cuts server load by ~3x.
 *
 *   • `emitItemAdd` / `emitItemRemove` / `emitItemUpdate` are thin wrappers
 *     around socket.emit so the caller (CanvasPage) never imports socket.io
 *     directly — this keeps concerns separated.
 *
 *   • Remote cursors are stored in a React Map state so components can re-render
 *     when any cursor moves without storing the whole socket in React state.
 *
 *   • Board state loaded from MySQL on `board:state` is mapped from WireItem
 *     format back to CanvasItem format then passed to `onLoadItems` for the
 *     Quadtree to ingest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  CanvasItem,
  StrokeItem,
  ShapeItem,
  TextItem,
  StickerItem,
  Point,
} from '../types/canvas';
import { BoardChatMessageItem, BoardTodoItem } from '../types/collab';

// ─── Wire types (must match socketHandler.ts) ───────────────────────────────

interface WireStroke {
  id: string;
  type: 'stroke';
  points: Point[];
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

// ─── Remote Cursor entry ─────────────────────────────────────────────────────

export interface RemoteCursorEntry {
  userId: string;
  fullName: string;
  avatarColor: string;
  x: number;
  y: number;
}

export interface RemoteLaserPoint {
  x: number;
  y: number;
  time: number;
}

/** Map: socketId → { avatarColor, trail points } */
export type RemoteLaserTrails = Map<string, { avatarColor: string; points: RemoteLaserPoint[] }>;

// ─── Hook options / return type ──────────────────────────────────────────────

interface UseSocketOptions {
  boardId: string | undefined;
  /** Called once with all persisted items when first joining the board */
  onLoadItems: (items: CanvasItem[]) => void;
  /** Called when a remote user adds an item */
  onItemAdded: (item: CanvasItem) => void;
  /** Called when a remote user removes an item */
  onItemRemoved: (itemId: string) => void;
  /** Called when a remote user moves/resizes an item */
  onItemUpdated: (item: CanvasItem) => void;
  /** Called when another user clears the entire whiteboard */
  onBoardCleared?: () => void;
  /** Whiteboard collaborative chat callbacks */
  onLoadChatMessages?: (messages: BoardChatMessageItem[]) => void;
  onChatMessageReceived?: (message: BoardChatMessageItem) => void;
  /** Whiteboard to-do list callbacks */
  onLoadTodos?: (todos: BoardTodoItem[]) => void;
  onTodoAdded?: (todo: BoardTodoItem) => void;
  onTodoToggled?: (todo: BoardTodoItem) => void;
  onTodoDeleted?: (todoId: string) => void;
}

interface UseSocketReturn {
  /** Map from socketId → cursor entry. Use to render RemoteCursors. */
  remoteCursors: Map<string, RemoteCursorEntry>;
  /** Map: socketId → remote laser trail (colored per user). Used to render remote lasers. */
  remoteLaserTrails: RemoteLaserTrails;
  /** Names of users currently in this board (excludes self) */
  onlineUsers: { socketId: string; fullName: string; avatarColor: string }[];
  /** Emit a newly drawn/placed item to the server (persists + broadcasts) */
  emitItemAdd: (item: CanvasItem) => void;
  /** Emit an item deletion (persists + broadcasts) */
  emitItemRemove: (itemId: string, itemType: string) => void;
  /** Emit a move/resize update (persists + broadcasts) */
  emitItemUpdate: (item: CanvasItem) => void;
  /** Emit local cursor position (world-space coords, throttled to 20fps) */
  emitCursorMove: (x: number, y: number) => void;
  /** Emit laser pointer position (world-space coords) */
  emitLaserTrace: (x: number, y: number) => void;
  /** Emit clear whiteboard (removes all items on MySQL and broadcasts to all users) */
  emitBoardClear: () => void;
  /** Whiteboard collaborative chat & to-do emitters */
  emitBoardChatSend: (message: string) => void;
  emitBoardTodoAdd: (task: string) => void;
  emitBoardTodoToggle: (todoId: string, completed: boolean) => void;
  emitBoardTodoDelete: (todoId: string) => void;
}

// ─── Wire → CanvasItem converter ─────────────────────────────────────────────

/**
 * Converts the compact wire format sent over the network into a full CanvasItem
 * that can be inserted into our custom Quadtree.
 */
function wireToCanvasItem(w: WireItem): CanvasItem {
  if (w.type === 'stroke') {
    return {
      id: w.id,
      type: 'stroke',
      points: w.points,
      strokeColor: w.strokeColor,
      strokeWidth: w.strokeWidth,
      opacity: w.opacity,
      penType: (w.penType === 'highlighter' ? 'highlighter' : 'normal') as any,
      minX: w.minX,
      minY: w.minY,
      maxX: w.maxX,
      maxY: w.maxY,
      zIndex: w.zIndex,
    } as StrokeItem;
  }
  if (w.type === 'shape') {
    return {
      id: w.id,
      type: 'shape',
      shapeType: w.shapeType as any,
      strokeColor: w.strokeColor,
      strokeWidth: w.strokeWidth,
      opacity: w.opacity,
      minX: w.minX,
      minY: w.minY,
      maxX: w.maxX,
      maxY: w.maxY,
      zIndex: w.zIndex,
    } as ShapeItem;
  }
  if (w.type === 'text') {
    return {
      id: w.id,
      type: 'text',
      content: w.content,
      fontFamily: w.fontFamily,
      fontSize: w.fontSize,
      fontColor: w.fontColor,
      minX: w.minX,
      minY: w.minY,
      maxX: w.maxX,
      maxY: w.maxY,
      width: w.width,
      height: w.height,
      zIndex: w.zIndex,
    } as TextItem;
  }
  // sticker
  return {
    id: w.id,
    type: 'sticker',
    noteText: w.noteText,
    bgColor: w.bgColor,
    minX: w.minX,
    minY: w.minY,
    maxX: w.maxX,
    maxY: w.maxY,
    width: w.width,
    height: w.height,
    zIndex: w.zIndex,
  } as StickerItem;
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export function useSocket({
  boardId,
  onLoadItems,
  onItemAdded,
  onItemRemoved,
  onItemUpdated,
  onBoardCleared,
  onLoadChatMessages,
  onChatMessageReceived,
  onLoadTodos,
  onTodoAdded,
  onTodoToggled,
  onTodoDeleted,
}: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);

  // Map from socketId → cursor position for remote users
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursorEntry>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<{ socketId: string; fullName: string; avatarColor: string }[]>([]);

  // Map: socketId → { avatarColor, laser trail points }
  // Each remote user's laser trail decays independently over time.
  const [remoteLaserTrails, setRemoteLaserTrails] = useState<RemoteLaserTrails>(new Map());

  // Throttle cursor emit: only send if ≥50ms since last emit (20 fps cap)
  const lastCursorEmitRef = useRef(0);

  useEffect(() => {
    if (!boardId) return;

    const token = localStorage.getItem('collab_token');
    if (!token) {
      console.warn('[useSocket] No auth token — skipping socket connection.');
      return;
    }

    // Create Socket.IO connection to backend
    // We use the Vite proxy (same origin) in dev; in production use the absolute URL.
    const socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    // ── Join board room on connect ──────────────────────────────────────────
    socket.on('connect', () => {
      console.log(`[Socket.IO] ✅ Connected as ${socket.id}`);
      socket.emit('board:join', { boardId, token });
    });

    // ── Receive full board state from server on initial join ───────────────
    // Triggered once after board:join. Contains persisted drawing objects, chat & todos.
    socket.on('board:state', ({
      items,
      chatMessages,
      todoItems,
    }: {
      items: WireItem[];
      chatMessages?: BoardChatMessageItem[];
      todoItems?: BoardTodoItem[];
    }) => {
      console.log(`[Socket.IO] 📋 Received board state: ${items.length} items`);
      const canvasItems = items.map(wireToCanvasItem);
      onLoadItems(canvasItems);
      if (chatMessages && onLoadChatMessages) {
        onLoadChatMessages(chatMessages);
      }
      if (todoItems && onLoadTodos) {
        onLoadTodos(todoItems);
      }
    });

    // ── Whiteboard Collaborative Chat Messages ────────────────────────────
    socket.on('board:chat:received', (message: BoardChatMessageItem) => {
      onChatMessageReceived?.(message);
    });

    // ── Whiteboard Collaborative To-Do Items ──────────────────────────────
    socket.on('board:todo:added', (todo: BoardTodoItem) => {
      onTodoAdded?.(todo);
    });

    socket.on('board:todo:toggled', (todo: BoardTodoItem) => {
      onTodoToggled?.(todo);
    });

    socket.on('board:todo:deleted', ({ todoId }: { todoId: string }) => {
      onTodoDeleted?.(todoId);
    });

    // ── Remote user drew / placed something ───────────────────────────────
    socket.on('item:added', ({ item }: { item: WireItem }) => {
      onItemAdded(wireToCanvasItem(item));
    });

    // ── Remote user erased something ──────────────────────────────────────
    socket.on('item:removed', ({ itemId }: { itemId: string }) => {
      onItemRemoved(itemId);
    });

    // ── Remote user moved or resized something ────────────────────────────
    socket.on('item:updated', ({ item }: { item: WireItem }) => {
      onItemUpdated(wireToCanvasItem(item));
    });

    // ── Remote user cleared the board ─────────────────────────────────────
    socket.on('board:cleared', () => {
      onBoardCleared?.();
    });

    // ── Remote cursor position (throttled on sender side) ─────────────────
    socket.on(
      'cursor:moved',
      ({
        socketId,
        userId,
        fullName,
        avatarColor,
        x,
        y,
      }: {
        socketId: string;
        userId: string;
        fullName: string;
        avatarColor: string;
        x: number;
        y: number;
      }) => {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(socketId, { userId, fullName, avatarColor, x, y });
          return next;
        });
      }
    );

    // ── User joined this board ────────────────────────────────────────────
    socket.on('user:joined', ({ socketId, user }: { socketId: string; user: { userId: string; fullName: string; avatarColor: string } }) => {
      console.log(`[Socket.IO] 👤 ${user.fullName} joined`);
      setOnlineUsers((prev) => {
        // Avoid duplicates
        if (prev.find((u) => u.socketId === socketId)) return prev;
        return [...prev, { socketId, fullName: user.fullName, avatarColor: user.avatarColor }];
      });
    });

    // ── Existing presence list (sent on join — everyone who was already here) ─
    socket.on(
      'board:presence',
      ({ users }: { users: { socketId: string; user: { userId: string; fullName: string; avatarColor: string }; cursorX: number; cursorY: number }[] }) => {
        const list = users.map((u) => ({
          socketId: u.socketId,
          fullName: u.user.fullName,
          avatarColor: u.user.avatarColor,
        }));
        setOnlineUsers(list);

        // Seed initial cursor positions
        setRemoteCursors(() => {
          const m = new Map<string, RemoteCursorEntry>();
          users.forEach((u) => {
            m.set(u.socketId, {
              userId: u.user.userId,
              fullName: u.user.fullName,
              avatarColor: u.user.avatarColor,
              x: u.cursorX,
              y: u.cursorY,
            });
          });
          return m;
        });
      }
    );

    // ── User left this board ──────────────────────────────────────────────
    socket.on('user:left', ({ socketId }: { socketId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.socketId !== socketId));
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
      // Also clean up their laser trail
      setRemoteLaserTrails((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    // ── Remote laser pointer (Presentation Mode) ──────────────────────────
    // Triggered when another user is using the laser in presentation mode.
    // We append the point to their personal trail. The CanvasRenderer will
    // decay and render it with their avatar color so you can tell who is pointing.
    socket.on(
      'laser:traced',
      ({
        socketId,
        avatarColor,
        x,
        y,
      }: {
        socketId: string;
        userId: string;
        fullName: string;
        avatarColor: string;
        x: number;
        y: number;
      }) => {
        const now = Date.now();
        setRemoteLaserTrails((prev) => {
          const next = new Map(prev);
          const existing = next.get(socketId);
          const freshPoints = existing
            ? existing.points.filter((p) => now - p.time < 1200) // prune stale points
            : [];
          next.set(socketId, {
            avatarColor,
            points: [...freshPoints, { x, y, time: now }],
          });
          return next;
        });
      }
    );

    // ── Socket errors ─────────────────────────────────────────────────────
    socket.on('error', ({ message }: { message: string }) => {
      console.error('[Socket.IO] Server error:', message);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] ❌ Disconnected: ${reason}`);
    });

    // Cleanup on unmount / boardId change
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setRemoteCursors(new Map());
      setOnlineUsers([]);
      setRemoteLaserTrails(new Map());
    };
  }, [boardId]); // Re-run only if boardId changes

  // ── Emit helpers ─────────────────────────────────────────────────────────

  /** Sends a completed item (stroke, shape, sticker, text) to the server */
  const emitItemAdd = useCallback((item: CanvasItem) => {
    socketRef.current?.emit('item:add', item);
  }, []);

  /** Sends an item deletion (by id + type) to the server */
  const emitItemRemove = useCallback((itemId: string, itemType: string) => {
    socketRef.current?.emit('item:remove', { itemId, itemType });
  }, []);

  /** Sends a move/resize update to the server */
  const emitItemUpdate = useCallback((item: CanvasItem) => {
    socketRef.current?.emit('item:update', item);
  }, []);

  /**
   * Sends cursor position to the server.
   * THROTTLED to 20fps — only emits if ≥50ms since last emit.
   * This is called from onPointerMove which fires at 60fps, so without
   * throttling we'd spam 60 socket events/second per user.
   */
  const emitCursorMove = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorEmitRef.current < 50) return; // 20 fps throttle
    lastCursorEmitRef.current = now;
    socketRef.current?.emit('cursor:move', { x, y });
  }, []);

  /** Sends laser pointer position to all other users on this board */
  const emitLaserTrace = useCallback((x: number, y: number) => {
    socketRef.current?.emit('laser:trace', { x, y });
  }, []);

  /** Emits clear board signal to wipe board in MySQL and on all collaborators */
  const emitBoardClear = useCallback(() => {
    socketRef.current?.emit('board:clear');
  }, []);

  /** Whiteboard chat message emitter */
  const emitBoardChatSend = useCallback((message: string) => {
    socketRef.current?.emit('board:chat:send', { message });
  }, []);

  /** Whiteboard to-do item emitters */
  const emitBoardTodoAdd = useCallback((task: string) => {
    socketRef.current?.emit('board:todo:add', { task });
  }, []);

  const emitBoardTodoToggle = useCallback((todoId: string, completed: boolean) => {
    socketRef.current?.emit('board:todo:toggle', { todoId, completed });
  }, []);

  const emitBoardTodoDelete = useCallback((todoId: string) => {
    socketRef.current?.emit('board:todo:delete', { todoId });
  }, []);

  return {
    remoteCursors,
    remoteLaserTrails,
    onlineUsers,
    emitItemAdd,
    emitItemRemove,
    emitItemUpdate,
    emitCursorMove,
    emitLaserTrace,
    emitBoardClear,
    emitBoardChatSend,
    emitBoardTodoAdd,
    emitBoardTodoToggle,
    emitBoardTodoDelete,
  };
}
