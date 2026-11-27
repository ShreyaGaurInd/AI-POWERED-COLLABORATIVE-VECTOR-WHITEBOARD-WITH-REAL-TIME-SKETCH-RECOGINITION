import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { WhiteboardItem } from '../types/dashboard';
import { 
  CanvasItem, 
  CanvasTool, 
  EraserMode,
  Point, 
  ShapeType, 
  StrokeItem, 
  ViewportTransform,
  ShapeItem,
  StickerItem,
  TextItem
} from '../types/canvas';
import { Quadtree } from '../engine/Quadtree';
import { CanvasRenderer } from '../engine/CanvasRenderer';
import { calculateStrokeAABB, distanceToSegment, screenToWorld, clipStrokeWithCircle } from '../engine/VectorMath';
import { ShapeRecognizer } from '../engine/ShapeRecognizer';
import { CanvasToolbar } from '../components/canvas/CanvasToolbar';
import { CanvasHeader } from '../components/canvas/CanvasHeader';
import { ClearBoardModal } from '../components/canvas/ClearBoardModal';
import { ShareBoardModal } from '../components/canvas/ShareBoardModal';
import { UnlockBoardModal } from '../components/dashboard/UnlockBoardModal';
import { BoardChatAndTodosDrawer } from '../components/canvas/BoardChatAndTodosDrawer';
import { BoardChatMessageItem, BoardTodoItem } from '../types/collab';
import { useSocket } from '../hooks/useSocket';
import { RemoteCursors } from '../components/canvas/RemoteCursors';
import { Sparkles, PenTool, Eraser, Undo2, X, RotateCw, FlipHorizontal, FlipVertical, Copy, Trash2 } from 'lucide-react';
type TransformHandle = 'nw' | 'ne' | 'sw' | 'se' | 'rot';

function worldToItemLocal(worldPoint: Point, item: CanvasItem): Point {
  const cx = (item.minX + item.maxX) / 2;
  const cy = (item.minY + item.maxY) / 2;
  const rot = item.rotation || 0;
  if (rot === 0) return worldPoint;

  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = worldPoint.x - cx;
  const dy = worldPoint.y - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function getTransformHandleAtPoint(
  worldPoint: Point,
  item: CanvasItem,
  zoom: number
): TransformHandle | null {
  const local = worldToItemLocal(worldPoint, item);
  const margin = 6;
  const minX = item.minX - margin;
  const minY = item.minY - margin;
  const maxX = item.maxX + margin;
  const maxY = item.maxY + margin;
  const hitRadius = 14 / zoom;

  // 1. Rotation knob: centered 24px above top edge
  const topCenterX = (minX + maxX) / 2;
  const rotKnobY = minY - 24;
  if (Math.hypot(local.x - topCenterX, local.y - rotKnobY) <= hitRadius) return 'rot';

  // 2. 4 Corner resize handles
  if (Math.hypot(local.x - minX, local.y - minY) <= hitRadius) return 'nw';
  if (Math.hypot(local.x - maxX, local.y - minY) <= hitRadius) return 'ne';
  if (Math.hypot(local.x - minX, local.y - maxY) <= hitRadius) return 'sw';
  if (Math.hypot(local.x - maxX, local.y - maxY) <= hitRadius) return 'se';

  return null;
}

function isPointInsideItemBounds(worldPoint: Point, item: CanvasItem): boolean {
  const local = worldToItemLocal(worldPoint, item);
  const margin = 6;
  return (
    local.x >= item.minX - margin &&
    local.x <= item.maxX + margin &&
    local.y >= item.minY - margin &&
    local.y <= item.maxY + margin
  );
}

export const CanvasPage: React.FC = () => {
  const { id: boardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();

  // Canvas DOM and Context Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const quadtreeRef = useRef<Quadtree>(new Quadtree(100000, 8, 8));

  // Board Metadata state
  const [board, setBoard] = useState<WhiteboardItem | null>(null);

  // Viewport Transform (Pan & Zoom)
  const [transform, setTransform] = useState<ViewportTransform>({
    panX: 0,
    panY: 0,
    zoom: 1.0,
  });

  // Tools & Styling states
  const [activeTool, setActiveTool] = useState<CanvasTool>('pen');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserSize, setEraserSize] = useState(10); // world-space radius
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1.0);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [isPencilOnly, setIsPencilOnly] = useState(false);
  const [isSmartShapes, setIsSmartShapes] = useState(true);
  const [shapeNotification, setShapeNotification] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Board Password Unlock modal state
  const [boardToUnlock, setBoardToUnlock] = useState<WhiteboardItem | null>(null);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Whiteboard Collaboration Drawer (Chat & To-Dos) state
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<BoardChatMessageItem[]>([]);
  const [todoItems, setTodoItems] = useState<BoardTodoItem[]>([]);

  // Selection & In-progress items
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentStroke, setCurrentStroke] = useState<StrokeItem | null>(null);
  const [laserPoints, setLaserPoints] = useState<{ x: number; y: number; time: number }[]>([]);
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [spatialItemCount, setSpatialItemCount] = useState(0);

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<CanvasItem[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasItem[][]>([]);

  // Pointer tracking flags
  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartPointRef = useRef<Point | null>(null);
  const activeStrokePointsRef = useRef<Point[]>([]);

  // Object transform (Resize, Rotate & Drag) refs
  const activeTransformHandleRef = useRef<TransformHandle | null>(null);
  const isDraggingItemRef = useRef(false);
  const dragStartPointRef = useRef<Point | null>(null);
  const initialItemSnapshotRef = useRef<CanvasItem | null>(null);

  // Save snapshot for Undo
  const saveUndoSnapshot = useCallback(() => {
    const currentItems = quadtreeRef.current.getAll();
    setUndoStack((prev) => [...prev.slice(-30), currentItems]);
    setRedoStack([]);
  }, []);

  // ── Socket callback refs (stable refs so useSocket doesn't re-run) ──────────
  // We use refs here because these callbacks read the quadtreeRef.current which
  // changes but we don't want to re-create the socket connection on each render.
  const onLoadItemsRef = useRef<(items: CanvasItem[]) => void>(() => {});
  const onItemAddedRef = useRef<(item: CanvasItem) => void>(() => {});
  const onItemRemovedRef = useRef<(id: string) => void>(() => {});
  const onItemUpdatedRef = useRef<(item: CanvasItem) => void>(() => {});
  const onBoardClearedRef = useRef<() => void>(() => {});
  const onLoadChatMessagesRef = useRef<(messages: BoardChatMessageItem[]) => void>(() => {});
  const onChatMessageReceivedRef = useRef<(message: BoardChatMessageItem) => void>(() => {});
  const onLoadTodosRef = useRef<(todos: BoardTodoItem[]) => void>(() => {});
  const onTodoAddedRef = useRef<(todo: BoardTodoItem) => void>(() => {});
  const onTodoToggledRef = useRef<(todo: BoardTodoItem) => void>(() => {});
  const onTodoDeletedRef = useRef<(todoId: string) => void>(() => {});

  // Keep refs in sync with latest closures
  onLoadItemsRef.current = useCallback((items: CanvasItem[]) => {
    // Load all persisted items from MySQL into the local Quadtree
    quadtreeRef.current.clear();
    for (const item of items) {
      quadtreeRef.current.insert(item);
    }
    setSpatialItemCount(items.length);
  }, []);

  onItemAddedRef.current = useCallback((item: CanvasItem) => {
    // A remote user drew something — insert into local Quadtree immediately
    quadtreeRef.current.insert(item);
    setSpatialItemCount(quadtreeRef.current.getAll().length);
  }, []);

  onItemRemovedRef.current = useCallback((itemId: string) => {
    // A remote user erased something — remove from local Quadtree
    quadtreeRef.current.remove(itemId);
    setSpatialItemCount(quadtreeRef.current.getAll().length);
  }, []);

  onItemUpdatedRef.current = useCallback((item: CanvasItem) => {
    // A remote user moved/resized something — update in local Quadtree
    quadtreeRef.current.update(item);
  }, []);

  onBoardClearedRef.current = useCallback(() => {
    // A remote user cleared the board
    quadtreeRef.current.clear();
    setSpatialItemCount(0);
    setSelectedItemId(null);
  }, []);

  onLoadChatMessagesRef.current = useCallback((messages: BoardChatMessageItem[]) => {
    setChatMessages(messages);
  }, []);

  onChatMessageReceivedRef.current = useCallback((message: BoardChatMessageItem) => {
    setChatMessages((prev) => [...prev.filter((m) => m.id !== message.id), message]);
  }, []);

  onLoadTodosRef.current = useCallback((todos: BoardTodoItem[]) => {
    setTodoItems(todos);
  }, []);

  onTodoAddedRef.current = useCallback((todo: BoardTodoItem) => {
    setTodoItems((prev) => [...prev.filter((t) => t.id !== todo.id), todo]);
  }, []);

  onTodoToggledRef.current = useCallback((todo: BoardTodoItem) => {
    setTodoItems((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
  }, []);

  onTodoDeletedRef.current = useCallback((todoId: string) => {
    setTodoItems((prev) => prev.filter((t) => t.id !== todoId));
  }, []);

  // ── Wire useSocket ───────────────────────────────────────────────────────────
  const {
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
  } = useSocket({
    boardId,
    onLoadItems: (items) => onLoadItemsRef.current(items),
    onItemAdded: (item) => onItemAddedRef.current(item),
    onItemRemoved: (id) => onItemRemovedRef.current(id),
    onItemUpdated: (item) => onItemUpdatedRef.current(item),
    onBoardCleared: () => onBoardClearedRef.current(),
    onLoadChatMessages: (msgs) => onLoadChatMessagesRef.current(msgs),
    onChatMessageReceived: (msg) => onChatMessageReceivedRef.current(msg),
    onLoadTodos: (todos) => onLoadTodosRef.current(todos),
    onTodoAdded: (todo) => onTodoAddedRef.current(todo),
    onTodoToggled: (todo) => onTodoToggledRef.current(todo),
    onTodoDeleted: (todoId) => onTodoDeletedRef.current(todoId),
  });

  const remoteLaserTrailsRef = useRef(remoteLaserTrails);
  remoteLaserTrailsRef.current = remoteLaserTrails;

  // ---------------- LOAD BOARD DATA ----------------
  useEffect(() => {
    async function initBoard() {
      if (!boardId) return;
      try {
        const res = await api.getWhiteboards();
        if (res.success) {
          const found = res.data.whiteboards.find((b) => b.id === boardId);
          if (found) {
            // Check password protection: require unlock if protected, user is not owner, and not yet unlocked in session
            if (found.isProtected && !found.isOwner) {
              const session = sessionStorage.getItem(`board_session_${found.id}`);
              if (!session) {
                setBoardToUnlock(found);
                setIsUnlockModalOpen(true);
                return;
              }
            }
            setBoard(found);
          }
        }

        // Load chat history & todo items from MySQL
        api.getBoardChat(boardId).then((r) => {
          if (r.success && r.data.messages) setChatMessages(r.data.messages);
        }).catch(() => {});

        api.getBoardTodos(boardId).then((r) => {
          if (r.success && r.data.todos) setTodoItems(r.data.todos);
        }).catch(() => {});
      } catch (err) {
        console.error('Failed to load board:', err);
      }
    }
    initBoard();
  }, [boardId, navigate]);

  // Set default stroke color matching dark/light mode
  useEffect(() => {
    setStrokeColor(theme === 'dark' ? '#ffffff' : '#000000');
  }, [theme]);

  // ---------------- ANIMATION & RENDER LOOP ----------------
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Render background dot grid
      CanvasRenderer.renderGrid(ctx, width, height, transform, theme === 'dark');

      // Render scene with Quadtree Viewport Culling
      CanvasRenderer.renderScene(
        ctx,
        width,
        height,
        transform,
        quadtreeRef.current,
        currentStroke,
        laserPoints,
        selectedItemId,
        eraserCursor,
        remoteLaserTrailsRef.current
      );

      // Clean up decaying laser points
      const now = Date.now();
      if (laserPoints.length > 0) {
        setLaserPoints((prev) => prev.filter((p) => now - p.time < 1200));
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [transform, currentStroke, laserPoints, selectedItemId, theme]);

  // ---------------- RESIZE CANVAS HANDLER ----------------
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ---------------- NATIVE NON-PASSIVE WHEEL & PINCH ZOOM ----------------
  // Intercepts wheel events with { passive: false } to block native browser page zoom
  // (which would otherwise scale the DOM and push fixed toolbars off-screen).
  useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      const canvas = canvasRef.current;
      const isOverCanvas = canvas && (e.target === canvas || canvas.contains(e.target as Node));

      // Always block browser document zoom (Ctrl+wheel / trackpad pinch)
      // and default scrolling over the canvas
      if (e.ctrlKey || e.metaKey || isOverCanvas) {
        e.preventDefault();
      }

      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setTransform((prev) => {
          const newZoom = Math.max(0.15, Math.min(5.0, prev.zoom * zoomFactor));
          return {
            zoom: newZoom,
            panX: mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom),
            panY: mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom),
          };
        });
      } else if (isOverCanvas) {
        // Pan canvas
        setTransform((prev) => ({
          ...prev,
          panX: prev.panX - e.deltaX,
          panY: prev.panY - e.deltaY,
        }));
      }
    };

    window.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleZoomIn = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setTransform((prev) => {
      const newZoom = Math.min(5.0, prev.zoom * 1.15);
      return {
        zoom: newZoom,
        panX: cx - (cx - prev.panX) * (newZoom / prev.zoom),
        panY: cy - (cy - prev.panY) * (newZoom / prev.zoom),
      };
    });
  };

  const handleZoomOut = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setTransform((prev) => {
      const newZoom = Math.max(0.15, prev.zoom * 0.85);
      return {
        zoom: newZoom,
        panX: cx - (cx - prev.panX) * (newZoom / prev.zoom),
        panY: cy - (cy - prev.panY) * (newZoom / prev.zoom),
      };
    });
  };

  const handleZoomReset = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setTransform((prev) => {
      const newZoom = 1.0;
      return {
        zoom: newZoom,
        panX: cx - (cx - prev.panX) * (newZoom / prev.zoom),
        panY: cy - (cy - prev.panY) * (newZoom / prev.zoom),
      };
    });
  };

  // ---------------- POINTER EVENTS & PENCIL ONLY PALM REJECTION ----------------
  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    isPointerDownRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // PALM REJECTION / PENCIL ONLY MODE:
    // If Pencil Only is ON and input is touch (finger/palm), force pan mode
    if (isPencilOnly && e.pointerType === 'touch') {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: screenX, y: screenY };
      return;
    }

    // Spacebar held or middle click -> Pan mode
    if (e.button === 1 || e.buttons === 4 || e.altKey) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: screenX, y: screenY };
      return;
    }

    const worldPoint = screenToWorld(screenX, screenY, transform);

    // 1. SELECT TOOL (With Corner Resize Handles & Drag Moving)
    if (activeTool === 'select') {
      if (selectedItemId) {
        const currentSelected = quadtreeRef.current.get(selectedItemId);
        if (currentSelected) {
          const handle = getTransformHandleAtPoint(worldPoint, currentSelected, transform.zoom);
          if (handle) {
            saveUndoSnapshot();
            activeTransformHandleRef.current = handle;
            dragStartPointRef.current = worldPoint;
            initialItemSnapshotRef.current = JSON.parse(JSON.stringify(currentSelected));
            return;
          }

          if (isPointInsideItemBounds(worldPoint, currentSelected)) {
            saveUndoSnapshot();
            isDraggingItemRef.current = true;
            dragStartPointRef.current = worldPoint;
            initialItemSnapshotRef.current = JSON.parse(JSON.stringify(currentSelected));
            return;
          }
        }
      }

      const candidates = quadtreeRef.current.queryPoint(worldPoint);
      if (candidates.length > 0) {
        // Select top-most item
        const topItem = candidates.reduce((prev, curr) => (curr.zIndex > prev.zIndex ? curr : prev));
        setSelectedItemId(topItem.id);
        saveUndoSnapshot();
        isDraggingItemRef.current = true;
        dragStartPointRef.current = worldPoint;
        initialItemSnapshotRef.current = JSON.parse(JSON.stringify(topItem));
      } else {
        setSelectedItemId(null);
      }
      return;
    }

    // 2. ERASER TOOL (Collision query via Quadtree circle intersection)
    if (activeTool === 'eraser') {
      eraseAtPoint(worldPoint);
      return;
    }

    // 3. LASER POINTER (Ephemeral presentation trail)
    if (activeTool === 'laser') {
      setLaserPoints((prev) => [...prev, { x: worldPoint.x, y: worldPoint.y, time: Date.now() }]);
      return;
    }

    // 4. TEXT TOOL
    if (activeTool === 'text') {
      saveUndoSnapshot();
      const newText: TextItem = {
        id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'text',
        minX: worldPoint.x,
        minY: worldPoint.y,
        maxX: worldPoint.x + 200,
        maxY: worldPoint.y + 40,
        width: 200,
        height: 40,
        content: prompt('Enter text:') || 'Text note',
        fontFamily: 'Inter',
        fontSize: Math.round(strokeWidth * 5),
        fontColor: strokeColor,
        zIndex: quadtreeRef.current.getAll().length + 1,
      };
      quadtreeRef.current.insert(newText);
      setSpatialItemCount(quadtreeRef.current.getAll().length);
      emitItemAdd(newText); // Persist + broadcast to collaborators
      setActiveTool('select');
      setSelectedItemId(newText.id);
      return;
    }

    // 5. STICKY NOTE TOOL
    if (activeTool === 'sticker') {
      saveUndoSnapshot();
      const newSticker: StickerItem = {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'sticker',
        minX: worldPoint.x,
        minY: worldPoint.y,
        maxX: worldPoint.x + 180,
        maxY: worldPoint.y + 180,
        width: 180,
        height: 180,
        noteText: prompt('Enter note text:') || 'Brainstorm idea...',
        bgColor: '#fef08a', // Default sticky yellow
        zIndex: quadtreeRef.current.getAll().length + 1,
      };
      quadtreeRef.current.insert(newSticker);
      setSpatialItemCount(quadtreeRef.current.getAll().length);
      emitItemAdd(newSticker); // Persist + broadcast to collaborators
      setActiveTool('select');
      setSelectedItemId(newSticker.id);
      return;
    }

    // 6. SHAPES (Rectangle, Circle, Triangle, Star, Arrow)
    if (['rectangle', 'circle', 'triangle', 'star', 'arrow'].includes(activeTool)) {
      shapeStartPointRef.current = worldPoint;
      return;
    }

    // 7. PEN & HIGHLIGHTER TOOL
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      const initialPoints: Point[] = [{ x: worldPoint.x, y: worldPoint.y, pressure: e.pressure || 0.5 }];
      activeStrokePointsRef.current = initialPoints;

      setCurrentStroke({
        id: `stroke_${Date.now()}`,
        type: 'stroke',
        minX: worldPoint.x - strokeWidth,
        minY: worldPoint.y - strokeWidth,
        maxX: worldPoint.x + strokeWidth,
        maxY: worldPoint.y + strokeWidth,
        points: initialPoints,
        strokeColor,
        strokeWidth,
        opacity,
        penType: activeTool === 'highlighter' ? 'highlighter' : 'normal',
        zIndex: quadtreeRef.current.getAll().length + 1,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle Pan motion
    if (isPanningRef.current && lastPanPointRef.current) {
      const dx = screenX - lastPanPointRef.current.x;
      const dy = screenY - lastPanPointRef.current.y;
      setTransform((prev) => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy,
      }));
      lastPanPointRef.current = { x: screenX, y: screenY };
      return;
    }

    const worldPoint = screenToWorld(screenX, screenY, transform);

    // Emit cursor position to collaborators (throttled to 20fps inside the hook)
    emitCursorMove(worldPoint.x, worldPoint.y);

    // Track visual eraser ring cursor — radius in world-space, converted to screen for display
    if (activeTool === 'eraser') {
      setEraserCursor({ x: worldPoint.x, y: worldPoint.y, radius: eraserSize });
      if (isPointerDownRef.current) {
        eraseAtPoint(worldPoint);
      }
      return;
    } else if (eraserCursor !== null) {
      setEraserCursor(null);
    }

    // Dynamic cursor styling when hovering over handles or selected objects
    if (!isPointerDownRef.current) {
      if (activeTool === 'select' && selectedItemId) {
        const currentSelected = quadtreeRef.current.get(selectedItemId);
        if (currentSelected) {
          const handle = getTransformHandleAtPoint(worldPoint, currentSelected, transform.zoom);
          if (handle === 'rot') {
            canvas.style.cursor = 'grab';
            return;
          } else if (handle === 'nw' || handle === 'se') {
            canvas.style.cursor = 'nwse-resize';
            return;
          } else if (handle === 'ne' || handle === 'sw') {
            canvas.style.cursor = 'nesw-resize';
            return;
          } else if (isPointInsideItemBounds(worldPoint, currentSelected)) {
            canvas.style.cursor = 'move';
            return;
          } else {
            canvas.style.cursor = 'default';
          }
        }
      } else if (activeTool === 'select') {
        canvas.style.cursor = 'default';
      }
      return;
    }

    // Active Drag-to-Rotate of Selected Item via Top Rotation Knob
    if (
      activeTransformHandleRef.current === 'rot' &&
      initialItemSnapshotRef.current &&
      dragStartPointRef.current
    ) {
      canvas.style.cursor = 'grabbing';
      const initial = initialItemSnapshotRef.current;
      const cx = (initial.minX + initial.maxX) / 2;
      const cy = (initial.minY + initial.maxY) / 2;

      const startAngle = Math.atan2(dragStartPointRef.current.y - cy, dragStartPointRef.current.x - cx);
      const currentAngle = Math.atan2(worldPoint.y - cy, worldPoint.x - cx);
      const deltaAngle = currentAngle - startAngle;

      let newRot = (initial.rotation || 0) + deltaAngle;
      if (e.shiftKey) {
        const snap = Math.PI / 12; // 15° snap
        newRot = Math.round(newRot / snap) * snap;
      }

      quadtreeRef.current.update({
        ...initial,
        rotation: newRot,
      });
      return;
    }

    // Active Resizing of Selected Item via Corner Handles
    if (
      activeTransformHandleRef.current &&
      activeTransformHandleRef.current !== 'rot' &&
      initialItemSnapshotRef.current &&
      dragStartPointRef.current
    ) {
      const dx = worldPoint.x - dragStartPointRef.current.x;
      const dy = worldPoint.y - dragStartPointRef.current.y;
      const initial = initialItemSnapshotRef.current;
      const h = activeTransformHandleRef.current;
      const minSize = 20;

      let newMinX = initial.minX;
      let newMinY = initial.minY;
      let newMaxX = initial.maxX;
      let newMaxY = initial.maxY;

      if (h === 'nw') {
        newMinX = Math.min(initial.maxX - minSize, initial.minX + dx);
        newMinY = Math.min(initial.maxY - minSize, initial.minY + dy);
      } else if (h === 'ne') {
        newMaxX = Math.max(initial.minX + minSize, initial.maxX + dx);
        newMinY = Math.min(initial.maxY - minSize, initial.minY + dy);
      } else if (h === 'sw') {
        newMinX = Math.min(initial.maxX - minSize, initial.minX + dx);
        newMaxY = Math.max(initial.minY + minSize, initial.maxY + dy);
      } else if (h === 'se') {
        newMaxX = Math.max(initial.minX + minSize, initial.maxX + dx);
        newMaxY = Math.max(initial.minY + minSize, initial.maxY + dy);
      }

      if (initial.type === 'shape') {
        quadtreeRef.current.update({
          ...(initial as ShapeItem),
          minX: newMinX,
          minY: newMinY,
          maxX: newMaxX,
          maxY: newMaxY,
        });
      } else if (initial.type === 'sticker') {
        quadtreeRef.current.update({
          ...(initial as StickerItem),
          minX: newMinX,
          minY: newMinY,
          maxX: newMaxX,
          maxY: newMaxY,
          width: newMaxX - newMinX,
          height: newMaxY - newMinY,
        });
      } else if (initial.type === 'text') {
        const origH = Math.max(1, (initial as TextItem).height);
        const newH = newMaxY - newMinY;
        const scaleRatio = newH / origH;
        quadtreeRef.current.update({
          ...(initial as TextItem),
          minX: newMinX,
          minY: newMinY,
          maxX: newMaxX,
          maxY: newMaxY,
          width: newMaxX - newMinX,
          height: newH,
          fontSize: Math.max(8, Math.round((initial as TextItem).fontSize * scaleRatio)),
        });
      } else if (initial.type === 'stroke') {
        const origW = Math.max(1, initial.maxX - initial.minX);
        const origH = Math.max(1, initial.maxY - initial.minY);
        const newW = newMaxX - newMinX;
        const newH = newMaxY - newMinY;
        const scaledPoints = (initial as StrokeItem).points.map((pt) => ({
          x: newMinX + ((pt.x - initial.minX) / origW) * newW,
          y: newMinY + ((pt.y - initial.minY) / origH) * newH,
          pressure: pt.pressure,
        }));
        const aabb = calculateStrokeAABB(scaledPoints, (initial as StrokeItem).strokeWidth);
        quadtreeRef.current.update({
          ...(initial as StrokeItem),
          ...aabb,
          points: scaledPoints,
        });
      }
      return;
    }

    // Active Moving / Dragging of Selected Item
    if (
      isDraggingItemRef.current &&
      initialItemSnapshotRef.current &&
      dragStartPointRef.current
    ) {
      const dx = worldPoint.x - dragStartPointRef.current.x;
      const dy = worldPoint.y - dragStartPointRef.current.y;
      const initial = initialItemSnapshotRef.current;

      if (initial.type === 'stroke') {
        const movedPoints = (initial as StrokeItem).points.map((pt) => ({
          x: pt.x + dx,
          y: pt.y + dy,
          pressure: pt.pressure,
        }));
        quadtreeRef.current.update({
          ...(initial as StrokeItem),
          minX: initial.minX + dx,
          minY: initial.minY + dy,
          maxX: initial.maxX + dx,
          maxY: initial.maxY + dy,
          points: movedPoints,
        });
      } else {
        quadtreeRef.current.update({
          ...initial,
          minX: initial.minX + dx,
          minY: initial.minY + dy,
          maxX: initial.maxX + dx,
          maxY: initial.maxY + dy,
        } as CanvasItem);
      }
      return;
    }

    // Laser Pointer motion
    if (activeTool === 'laser') {
      setLaserPoints((prev) => [...prev, { x: worldPoint.x, y: worldPoint.y, time: Date.now() }]);
      emitLaserTrace(worldPoint.x, worldPoint.y); // Broadcast laser to all collaborators
      return;
    }

    // Shape drag preview
    if (shapeStartPointRef.current && ['rectangle', 'circle', 'triangle', 'star', 'arrow'].includes(activeTool)) {
      const start = shapeStartPointRef.current;
      const minX = Math.min(start.x, worldPoint.x);
      const minY = Math.min(start.y, worldPoint.y);
      const maxX = Math.max(start.x, worldPoint.x);
      const maxY = Math.max(start.y, worldPoint.y);

      // Render temporary stroke preview
      setCurrentStroke({
        id: 'preview_shape',
        type: 'stroke',
        minX,
        minY,
        maxX,
        maxY,
        points: [start, worldPoint],
        strokeColor,
        strokeWidth,
        opacity,
        penType: 'normal',
        zIndex: 9999,
      });
      return;
    }

    // Freehand stroke motion
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      const newPoint: Point = { x: worldPoint.x, y: worldPoint.y, pressure: e.pressure || 0.5 };
      activeStrokePointsRef.current.push(newPoint);

      const pts = activeStrokePointsRef.current;
      const aabb = calculateStrokeAABB(pts, strokeWidth);

      setCurrentStroke({
        id: `stroke_${Date.now()}`,
        type: 'stroke',
        ...aabb,
        points: [...pts],
        strokeColor,
        strokeWidth,
        opacity,
        penType: activeTool === 'highlighter' ? 'highlighter' : 'normal',
        zIndex: quadtreeRef.current.getAll().length + 1,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
    lastPanPointRef.current = null;

    // Capture drag/transform/rotate state BEFORE clearing refs, so we can emit socket update
    const wasTransforming = activeTransformHandleRef.current !== null;
    const wasDragging = isDraggingItemRef.current;
    const draggedItemId = selectedItemId;

    activeTransformHandleRef.current = null;
    isDraggingItemRef.current = false;
    dragStartPointRef.current = null;
    initialItemSnapshotRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);

    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld(screenX, screenY, transform);

    // 1. Commit Shape
    if (shapeStartPointRef.current && ['rectangle', 'circle', 'triangle', 'star', 'arrow'].includes(activeTool)) {
      const start = shapeStartPointRef.current;
      const width = Math.abs(worldPoint.x - start.x);
      const height = Math.abs(worldPoint.y - start.y);

      // Require minimal 6px size to prevent accidental clicks
      if (width > 6 || height > 6) {
        saveUndoSnapshot();
        const minX = Math.min(start.x, worldPoint.x);
        const minY = Math.min(start.y, worldPoint.y);
        const maxX = Math.max(start.x, worldPoint.x);
        const maxY = Math.max(start.y, worldPoint.y);

        const newShape: ShapeItem = {
          id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'shape',
          shapeType: selectedShape,
          minX,
          minY,
          maxX,
          maxY,
          strokeColor,
          strokeWidth,
          opacity,
          startPoint: selectedShape === 'arrow' ? { x: start.x, y: start.y } : undefined,
          endPoint: selectedShape === 'arrow' ? { x: worldPoint.x, y: worldPoint.y } : undefined,
          zIndex: quadtreeRef.current.getAll().length + 1,
        };

        quadtreeRef.current.insert(newShape);
        setSpatialItemCount(quadtreeRef.current.getAll().length);
        // Broadcast new shape to all collaborators
        emitItemAdd(newShape);
      }

      shapeStartPointRef.current = null;
      setCurrentStroke(null);
      return;
    }

    // 2. Commit Freehand Stroke into Custom Quadtree!
    if (currentStroke && activeStrokePointsRef.current.length > 0) {
      saveUndoSnapshot();
      const rawPoints = [...activeStrokePointsRef.current];

      // ── AI Smart Shape Recognition (Phase 6) ──
      // If Smart Shapes is enabled and user is drawing with normal pen,
      // analyze the stroke geometry. If it matches a circle, rectangle, triangle,
      // star, or arrow with high confidence, automatically convert it!
      if (isSmartShapes && activeTool === 'pen') {
        const recognized = ShapeRecognizer.recognize(rawPoints);
        if (recognized) {
          const cleanShape: ShapeItem = {
            id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'shape',
            shapeType: recognized.shapeType,
            minX: recognized.minX,
            minY: recognized.minY,
            maxX: recognized.maxX,
            maxY: recognized.maxY,
            strokeColor,
            strokeWidth,
            opacity,
            startPoint: recognized.startPoint,
            endPoint: recognized.endPoint,
            zIndex: quadtreeRef.current.getAll().length + 1,
          };

          quadtreeRef.current.insert(cleanShape);
          setSpatialItemCount(quadtreeRef.current.getAll().length);
          emitItemAdd(cleanShape); // Sync clean shape to collaborators

          setCurrentStroke(null);
          activeStrokePointsRef.current = [];

          // Show polite feedback banner
          const label = recognized.shapeType.charAt(0).toUpperCase() + recognized.shapeType.slice(1);
          setShapeNotification(`✨ Converted to ${label}`);
          setTimeout(() => setShapeNotification(null), 2500);
          return;
        }
      }

      // Normal freehand stroke fallback
      const aabb = calculateStrokeAABB(rawPoints, strokeWidth);
      const finalizedStroke: StrokeItem = {
        ...currentStroke,
        ...aabb,
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        points: rawPoints,
      };

      // Insert into our custom spatial Quadtree! (O(log N))
      quadtreeRef.current.insert(finalizedStroke);
      setSpatialItemCount(quadtreeRef.current.getAll().length);
      // Persist to MySQL + broadcast to all collaborators via Socket.IO
      emitItemAdd(finalizedStroke);

      setCurrentStroke(null);
      activeStrokePointsRef.current = [];
      return;
    }

    // 3. After drag/resize/rotate — emit update to collaborators
    if ((wasTransforming || wasDragging) && draggedItemId) {
      const updatedItem = quadtreeRef.current.get(draggedItemId);
      if (updatedItem) {
        emitItemUpdate(updatedItem);
      }
    }
  };

  // ---------------- ERASER LOGIC USING QUADTREE ----------------
  /**
   * HOW IT WORKS (Viva explanation):
   *
   * Whole Stroke mode:
   *   Query Quadtree circle neighbourhood O(log N), then check per-segment distance.
   *   First hit deletes the full stroke object from the Quadtree.
   *
   * Precision mode:
   *   Uses exact circle-line-segment intersection (quadratic formula) to find the
   *   EXACT entry/exit t values on each segment, trims to those two perimeter points,
   *   and re-inserts the surviving sub-runs back into the Quadtree.
   *   Net effect: the erased gap matches the eraser circle perimeter exactly — zero
   *   over-erasure, clean surgical cut, just like Apple Pencil / Procreate.
   */
  const eraseAtPoint = (point: Point) => {
    // eraserSize is the world-space radius chosen by the user (slider in toolbar)
    const eraserRadius = eraserSize;

    // Step 1: Quadtree spatial pre-filter — only examine nearby objects O(log N)
    // We expand the query radius by max stroke half-width (up to 24/2=12) so thick
    // strokes whose centreline is just outside the eraser circle still get checked.
    const queryRadius = eraserRadius + 24;
    const candidates = quadtreeRef.current.queryCircle(point, queryRadius);

    let changedAny = false;

    for (const item of candidates) {
      if (item.type === 'stroke') {
        // The effective clip radius is eraserRadius + half the stroke's own line width
        // so the visible ink edge — not the centreline — is what gets clipped.
        const clipRadius = eraserRadius + item.strokeWidth / 2;

        if (eraserMode === 'stroke') {
          // ── WHOLE STROKE MODE ──────────────────────────────────────────────────
          // Delete the entire stroke as soon as the eraser circle touches any segment.
          for (let i = 0; i < item.points.length - 1; i++) {
            const d = distanceToSegment(point, item.points[i], item.points[i + 1]);
            if (d <= clipRadius) {
              saveUndoSnapshot();
              quadtreeRef.current.remove(item.id);
              emitItemRemove(item.id, 'stroke'); // Broadcast deletion to collaborators
              changedAny = true;
              break;
            }
          }
        } else {
          // ── PRECISION MODE ─────────────────────────────────────────────────────
          // Analytically clip each segment against the eraser circle perimeter.
          // Segments entering the circle are trimmed exactly at the intersection
          // point; segments exiting create a new starting point. No grid snapping,
          // no vertex-distance rounding — this is proper computational geometry.
          const { modified, runs } = clipStrokeWithCircle(item.points, point, clipRadius);

          if (modified) {
            saveUndoSnapshot();
            quadtreeRef.current.remove(item.id);
            emitItemRemove(item.id, 'stroke'); // Broadcast original removal
            changedAny = true;

            // Re-insert each surviving segment group as an independent stroke
            runs.forEach((run, idx) => {
              const aabb = calculateStrokeAABB(run, item.strokeWidth);
              const subStroke: StrokeItem = {
                ...item,
                id: `${item.id}_prec${idx}_${Date.now()}`,
                points: run,
                ...aabb,
              };
              quadtreeRef.current.insert(subStroke);
              emitItemAdd(subStroke); // Broadcast sub-stroke additions
            });
          }
        }
      } else {
        // ── SHAPES / TEXT / STICKERS ───────────────────────────────────────────
        // These are atomic objects: erase if the eraser circle overlaps their
        // bounding box (not inflated by extra radius — the visible footprint IS
        // the bounding box for these object types).
        const isTouching =
          point.x >= item.minX - eraserRadius &&
          point.x <= item.maxX + eraserRadius &&
          point.y >= item.minY - eraserRadius &&
          point.y <= item.maxY + eraserRadius;

        if (isTouching) {
          saveUndoSnapshot();
          quadtreeRef.current.remove(item.id);
          emitItemRemove(item.id, item.type); // Broadcast to collaborators
          changedAny = true;
        }
      }
    }

    if (changedAny) {
      setSpatialItemCount(quadtreeRef.current.getAll().length);
    }
  };

  // ---------------- UNDO & REDO ----------------
  /**
   * HOW UNDO/REDO SYNC WORKS (Viva Explanation):
   *
   * Undo/Redo works by swapping the entire Quadtree state from a snapshot.
   * To sync this with collaborators we do a DIFF:
   *   - Items in the NEW state but NOT in the OLD state → emit item:add
   *   - Items in the OLD state but NOT in the NEW state → emit item:remove
   *   - Items present in BOTH but with different content → emit item:update (positions change on resize undo)
   *
   * This is O(N) on the number of items in a snapshot, which is fine because
   * undo snapshots are small (last ~30 states). We use Map lookups by id for O(1) per item.
   */
  const syncSnapshotToCollaborators = (prevItems: CanvasItem[], nextItems: CanvasItem[]) => {
    const prevMap = new Map(prevItems.map((item) => [item.id, item]));
    const nextMap = new Map(nextItems.map((item) => [item.id, item]));

    // Items that existed before but are gone now → tell everyone to remove them
    for (const [id, item] of prevMap) {
      if (!nextMap.has(id)) {
        emitItemRemove(id, item.type);
      }
    }

    // Items that are new or changed → tell everyone to add/update them
    for (const [id, item] of nextMap) {
      if (!prevMap.has(id)) {
        emitItemAdd(item);  // Brand-new item (re-added by undo of a deletion)
      } else {
        // Item exists in both — emit update in case position/size changed
        // (e.g. undoing a resize restores the old bounding box + points)
        emitItemUpdate(item);
      }
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousItems = undoStack[undoStack.length - 1];
    const currentItems = quadtreeRef.current.getAll(); // snapshot before undo

    setRedoStack((prev) => [currentItems, ...prev]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));

    // Rebuild Quadtree from snapshot
    quadtreeRef.current.clear();
    for (const item of previousItems) {
      quadtreeRef.current.insert(item);
    }
    setSpatialItemCount(previousItems.length);

    // Broadcast the diff to all collaborators so their canvas matches ours
    syncSnapshotToCollaborators(currentItems, previousItems);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextItems = redoStack[0];
    const currentItems = quadtreeRef.current.getAll(); // snapshot before redo

    setUndoStack((prev) => [...prev, currentItems]);
    setRedoStack((prev) => prev.slice(1));

    quadtreeRef.current.clear();
    for (const item of nextItems) {
      quadtreeRef.current.insert(item);
    }
    setSpatialItemCount(nextItems.length);

    // Broadcast the diff to all collaborators so their canvas matches ours
    syncSnapshotToCollaborators(currentItems, nextItems);
  };

  // ---------------- PRESENTATION MODE TOGGLE ----------------
  const handleTogglePresentationMode = () => {
    if (!isPresentationMode) {
      // Enter Fullscreen & activate Laser or large pen
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsPresentationMode(true);
      setActiveTool('laser');
    } else {
      // Exit Fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsPresentationMode(false);
      setActiveTool('pen');
    }
  };

  // Synchronize with browser Escape key / exit fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
        setActiveTool('pen');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPresentationMode]);

  // Keyboard Shortcuts (Undo, Redo, Tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          saveUndoSnapshot();
          const deletedItem = quadtreeRef.current.get(selectedItemId);
          quadtreeRef.current.remove(selectedItemId);
          if (deletedItem) emitItemRemove(selectedItemId, deletedItem.type); // Broadcast
          setSelectedItemId(null);
          setSpatialItemCount(quadtreeRef.current.getAll().length);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'p') {
        setActiveTool('pen');
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool('eraser');
      } else if (e.key.toLowerCase() === 'l') {
        setActiveTool('laser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, selectedItemId]);

  // ── Selected Object Manipulation Handlers (Rotate, Flip, Duplicate, Delete) ──
  const handleRotateSelectedItem = () => {
    if (!selectedItemId) return;
    const item = quadtreeRef.current.get(selectedItemId);
    if (!item) return;
    saveUndoSnapshot();
    const newRot = ((item.rotation || 0) + Math.PI / 2) % (Math.PI * 2);
    const updated = { ...item, rotation: newRot };
    quadtreeRef.current.update(updated);
    emitItemUpdate(updated);
  };

  const handleFlipHorizontalSelectedItem = () => {
    if (!selectedItemId) return;
    const item = quadtreeRef.current.get(selectedItemId);
    if (!item) return;
    saveUndoSnapshot();
    let updated: CanvasItem;
    if (
      item.type === 'shape' &&
      (item as ShapeItem).shapeType === 'arrow' &&
      (item as ShapeItem).startPoint &&
      (item as ShapeItem).endPoint
    ) {
      const sh = item as ShapeItem;
      const cx = (sh.minX + sh.maxX) / 2;
      updated = {
        ...sh,
        startPoint: { x: cx - (sh.startPoint!.x - cx), y: sh.startPoint!.y },
        endPoint: { x: cx - (sh.endPoint!.x - cx), y: sh.endPoint!.y },
      };
    } else if (item.type === 'stroke') {
      const st = item as StrokeItem;
      const cx = (st.minX + st.maxX) / 2;
      const flippedPts = st.points.map((p) => ({
        x: cx - (p.x - cx),
        y: p.y,
        pressure: p.pressure,
      }));
      updated = { ...st, points: flippedPts };
    } else {
      updated = { ...item, flipX: !item.flipX };
    }
    quadtreeRef.current.update(updated);
    emitItemUpdate(updated);
  };

  const handleFlipVerticalSelectedItem = () => {
    if (!selectedItemId) return;
    const item = quadtreeRef.current.get(selectedItemId);
    if (!item) return;
    saveUndoSnapshot();
    let updated: CanvasItem;
    if (
      item.type === 'shape' &&
      (item as ShapeItem).shapeType === 'arrow' &&
      (item as ShapeItem).startPoint &&
      (item as ShapeItem).endPoint
    ) {
      const sh = item as ShapeItem;
      const cy = (sh.minY + sh.maxY) / 2;
      updated = {
        ...sh,
        startPoint: { x: sh.startPoint!.x, y: cy - (sh.startPoint!.y - cy) },
        endPoint: { x: sh.endPoint!.x, y: cy - (sh.endPoint!.y - cy) },
      };
    } else if (item.type === 'stroke') {
      const st = item as StrokeItem;
      const cy = (st.minY + st.maxY) / 2;
      const flippedPts = st.points.map((p) => ({
        x: p.x,
        y: cy - (p.y - cy),
        pressure: p.pressure,
      }));
      updated = { ...st, points: flippedPts };
    } else {
      updated = { ...item, flipY: !item.flipY };
    }
    quadtreeRef.current.update(updated);
    emitItemUpdate(updated);
  };

  const handleDuplicateSelectedItem = () => {
    if (!selectedItemId) return;
    const item = quadtreeRef.current.get(selectedItemId);
    if (!item) return;
    saveUndoSnapshot();
    const offset = 24;
    const duplicated: CanvasItem = {
      ...JSON.parse(JSON.stringify(item)),
      id: `${item.type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      minX: item.minX + offset,
      minY: item.minY + offset,
      maxX: item.maxX + offset,
      maxY: item.maxY + offset,
      zIndex: quadtreeRef.current.getAll().length + 1,
    };
    if (duplicated.type === 'stroke') {
      (duplicated as StrokeItem).points = (duplicated as StrokeItem).points.map((p) => ({
        x: p.x + offset,
        y: p.y + offset,
        pressure: p.pressure,
      }));
    }
    if (
      duplicated.type === 'shape' &&
      (duplicated as ShapeItem).startPoint &&
      (duplicated as ShapeItem).endPoint
    ) {
      (duplicated as ShapeItem).startPoint = {
        x: (duplicated as ShapeItem).startPoint!.x + offset,
        y: (duplicated as ShapeItem).startPoint!.y + offset,
      };
      (duplicated as ShapeItem).endPoint = {
        x: (duplicated as ShapeItem).endPoint!.x + offset,
        y: (duplicated as ShapeItem).endPoint!.y + offset,
      };
    }
    quadtreeRef.current.insert(duplicated);
    setSelectedItemId(duplicated.id);
    setSpatialItemCount(quadtreeRef.current.getAll().length);
    emitItemAdd(duplicated);
  };

  const handleDeleteSelectedItem = () => {
    if (!selectedItemId) return;
    const item = quadtreeRef.current.get(selectedItemId);
    if (!item) return;
    saveUndoSnapshot();
    quadtreeRef.current.remove(selectedItemId);
    emitItemRemove(selectedItemId, item.type);
    setSelectedItemId(null);
    setSpatialItemCount(quadtreeRef.current.getAll().length);
  };

  const handleConfirmClearBoard = () => {
    saveUndoSnapshot(); // Save snapshot so user can immediately Undo (Ctrl+Z) if desired!
    quadtreeRef.current.clear();
    setSpatialItemCount(0);
    setSelectedItemId(null);
    emitBoardClear(); // Clear in MySQL and broadcast to all peers
    setIsClearModalOpen(false);
  };

  const currentSelectedItem = selectedItemId ? quadtreeRef.current.get(selectedItemId) : null;
  const actionMenuScreenX = currentSelectedItem
    ? ((currentSelectedItem.minX + currentSelectedItem.maxX) / 2) * transform.zoom + transform.panX
    : 0;
  const actionMenuScreenY = currentSelectedItem
    ? currentSelectedItem.minY * transform.zoom + transform.panY - 48
    : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] select-none touch-none">
      {/* Canvas Top Navigation Bar */}
      <CanvasHeader
        board={board}
        zoom={transform.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isPresentationMode={isPresentationMode}
        onTogglePresentationMode={handleTogglePresentationMode}
        spatialItemCount={spatialItemCount}
        onOpenClearModal={() => setIsClearModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        isChatDrawerOpen={isChatDrawerOpen}
        onToggleChatDrawer={() => setIsChatDrawerOpen((prev) => !prev)}
        chatMessageCount={chatMessages.length}
        todoCount={todoItems.length}
      />

      {/* Main HTML5 2D Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setEraserCursor(null)}
        className={`w-full h-full block touch-none ${
          activeTool === 'select'
            ? 'cursor-default'
            : activeTool === 'laser'
            ? 'cursor-crosshair'
            : activeTool === 'eraser'
            ? 'cursor-cell'
            : 'cursor-crosshair'
        }`}
      />

      {/* Remote Collaborator Cursors — rendered in world-space over the canvas */}
      <RemoteCursors remoteCursors={remoteCursors} transform={transform} />

      {/* Floating Contextual Object Actions (Rotate, Flip H, Flip V, Duplicate, Direct Delete) */}
      {currentSelectedItem && activeTool === 'select' && !isPresentationMode && (
        <div
          className="fixed z-40 flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 shadow-2xl backdrop-blur-xl text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${Math.max(120, Math.min(window.innerWidth - 140, actionMenuScreenX))}px`,
            top: `${Math.max(76, actionMenuScreenY)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Rotate 90 deg */}
          <button
            onClick={handleRotateSelectedItem}
            className="p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 transition-colors"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Flip Horizontal */}
          <button
            onClick={handleFlipHorizontalSelectedItem}
            className="p-1.5 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 transition-colors"
            title="Flip Horizontally"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Flip Vertical */}
          <button
            onClick={handleFlipVerticalSelectedItem}
            className="p-1.5 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 transition-colors"
            title="Flip Vertically"
          >
            <FlipVertical className="w-4 h-4" />
          </button>

          {/* Duplicate */}
          <button
            onClick={handleDuplicateSelectedItem}
            className="p-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-750 mx-0.5" />

          {/* Direct Delete */}
          <button
            onClick={handleDeleteSelectedItem}
            className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 transition-colors"
            title="Delete Selected Item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Online users presence indicator (top-right pill badges) */}
      {onlineUsers.length > 0 && (
        <div className="absolute top-16 right-4 flex items-center gap-1 z-40">
          {onlineUsers.slice(0, 5).map((u) => (
            <div
              key={u.socketId}
              title={u.fullName}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-md"
              style={{ backgroundColor: u.avatarColor || '#6366f1' }}
            >
              {u.fullName.charAt(0).toUpperCase()}
            </div>
          ))}
          {onlineUsers.length > 5 && (
            <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-xs font-bold shadow-md">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Floating Canva-style Toolbar (Hidden during full Presentation Mode) */}
      {!isPresentationMode && (
        <CanvasToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          strokeColor={strokeColor}
          onSelectColor={setStrokeColor}
          strokeWidth={strokeWidth}
          onSelectWidth={setStrokeWidth}
          opacity={opacity}
          onSelectOpacity={setOpacity}
          isPencilOnly={isPencilOnly}
          onTogglePencilOnly={() => setIsPencilOnly((prev) => !prev)}
          isSmartShapes={isSmartShapes}
          onToggleSmartShapes={() => setIsSmartShapes((prev) => !prev)}
          selectedShape={selectedShape}
          onSelectShape={setSelectedShape}
          eraserMode={eraserMode}
          onSelectEraserMode={setEraserMode}
          eraserSize={eraserSize}
          onSelectEraserSize={setEraserSize}
        />
      )}

      {/* AI Smart Shape Auto-Conversion Toast Notification */}
      {shapeNotification && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 dark:bg-black/90 backdrop-blur-xl border border-indigo-500/40 text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-indigo-300 font-bold">{shapeNotification}</span>
          <button
            onClick={handleUndo}
            className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors text-[11px] font-semibold"
          >
            Undo (Ctrl+Z)
          </button>
        </div>
      )}

      {/* Floating Presentation Control Dock (Shown ONLY in Presentation Mode) */}
      {isPresentationMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-white/20 shadow-2xl text-white select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 pr-3 border-r border-white/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">Live</span>
          </div>

          {/* Laser Pointer Toggle */}
          <button
            onClick={() => setActiveTool('laser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTool === 'laser'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Laser</span>
          </button>

          {/* Pen / Annotation Toggle */}
          <button
            onClick={() => {
              setActiveTool('pen');
              setStrokeWidth(6);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTool === 'pen'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Pen</span>
          </button>

          {/* Eraser */}
          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/20" />

          {/* Exit Presentation */}
          <button
            onClick={handleTogglePresentationMode}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      )}

      {/* In-Canvas Password Protection Unlock Modal */}
      <UnlockBoardModal
        isOpen={isUnlockModalOpen}
        onClose={() => navigate('/dashboard')}
        board={boardToUnlock}
        onUnlockSuccess={(unlockedBoard, token) => {
          sessionStorage.setItem(`board_session_${unlockedBoard.id}`, token);
          setBoard(unlockedBoard);
          setIsUnlockModalOpen(false);
          setBoardToUnlock(null);
        }}
        onVerify={async (bId, pwd) => {
          const res = await api.verifyBoardAccess(bId, pwd);
          return res.data;
        }}
      />

      {/* Clear Board Confirmation Permission Modal */}
      <ClearBoardModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClearBoard}
        itemCount={spatialItemCount}
      />

      {/* Share Board & Direct Collaborator Invite Modal */}
      <ShareBoardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        board={board}
      />

      {/* Whiteboard Real-Time Collaborative Chat & Action Items Drawer */}
      <BoardChatAndTodosDrawer
        isOpen={isChatDrawerOpen}
        onClose={() => setIsChatDrawerOpen(false)}
        chatMessages={chatMessages}
        todoItems={todoItems}
        onSendMessage={(msg) => emitBoardChatSend(msg)}
        onAddTodo={(task) => emitBoardTodoAdd(task)}
        onToggleTodo={(id, completed) => emitBoardTodoToggle(id, completed)}
        onDeleteTodo={(id) => emitBoardTodoDelete(id)}
        currentUserId={currentUser?.id}
      />
    </div>
  );
};
