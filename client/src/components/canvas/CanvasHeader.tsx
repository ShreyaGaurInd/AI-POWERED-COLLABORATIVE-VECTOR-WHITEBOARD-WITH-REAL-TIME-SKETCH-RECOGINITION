import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Presentation,
  Lock,
  Layers,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { WhiteboardItem } from '../../types/dashboard';

interface CanvasHeaderProps {
  board: WhiteboardItem | null;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  spatialItemCount: number;
  onOpenClearModal: () => void;
  isChatDrawerOpen?: boolean;
  onToggleChatDrawer?: () => void;
  chatMessageCount?: number;
  todoCount?: number;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  board,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isPresentationMode,
  onTogglePresentationMode,
  spatialItemCount,
  onOpenClearModal,
  isChatDrawerOpen = false,
  onToggleChatDrawer,
  chatMessageCount = 0,
  todoCount = 0,
}) => {
  const navigate = useNavigate();

  // If in Presentation Mode, header is hidden in favor of the floating presenter dock
  if (isPresentationMode) {
    return null;
  }

  return (
    <header className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
      {/* Left Pill: Back & Title */}
      <div className="pointer-events-auto bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-2xl px-3 py-2 shadow-lg backdrop-blur-md flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-800" />

        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900 dark:text-white max-w-xs truncate">
            {board ? board.title : 'Whiteboard'}
          </span>
          {board?.isProtected && (
            <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" title="Password Protected">
              <Lock className="w-3 h-3" />
            </span>
          )}
          {board?.folder && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs hidden sm:inline"
              style={{ backgroundColor: board.folder.color }}
            >
              {board.folder.name}
            </span>
          )}
        </div>
      </div>

      {/* Center Pill: Undo/Redo & Zoom Controls */}
      <div className="pointer-events-auto hidden md:flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-2xl px-3 py-2 shadow-lg backdrop-blur-md">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

        <button
          onClick={onZoomOut}
          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={onZoomReset}
          className="px-2 py-1 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={onZoomIn}
          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* Clean object count badge (User-friendly, no developer jargon) */}
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800/80">
          <Layers className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>{spatialItemCount} {spatialItemCount === 1 ? 'object' : 'objects'}</span>
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* Clear Whiteboard Option with Permission Modal */}
        <button
          onClick={onOpenClearModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
          title="Clear Whiteboard (with confirmation)"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden xl:inline text-rose-600 dark:text-rose-400">Clear Board</span>
        </button>
      </div>

      {/* Right Pill: Presentation Mode & Theme */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Whiteboard Collaboration Drawer (Chat & To-Dos) */}
        {onToggleChatDrawer && (
          <button
            onClick={onToggleChatDrawer}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
              isChatDrawerOpen
                ? 'bg-brand-600 text-white shadow-brand-500/20'
                : 'bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Whiteboard Chat & To-Do List"
          >
            <MessageSquare className={`w-4 h-4 ${isChatDrawerOpen ? 'text-white' : 'text-brand-500'}`} />
            <span className="hidden sm:inline">Chat & Tasks</span>
            {(chatMessageCount > 0 || todoCount > 0) && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isChatDrawerOpen
                  ? 'bg-white/20 text-white'
                  : 'bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
              }`}>
                {chatMessageCount + todoCount}
              </span>
            )}
          </button>
        )}

        {/* Mobile Clear Whiteboard Button */}
        <button
          onClick={onOpenClearModal}
          className="md:hidden bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 text-rose-600 p-2 rounded-2xl shadow-lg backdrop-blur-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          title="Clear Whiteboard"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onTogglePresentationMode}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl px-3.5 py-2 text-xs font-semibold shadow-lg shadow-brand-500/20 flex items-center gap-1.5 transition-all"
          title="Presentation Mode (Fullscreen, Large Pens, Laser Pointer)"
        >
          <Presentation className="w-4 h-4" />
          <span className="hidden sm:inline">Presentation Mode</span>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
};
