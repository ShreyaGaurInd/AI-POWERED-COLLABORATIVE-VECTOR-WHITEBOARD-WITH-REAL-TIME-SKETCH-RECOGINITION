import React, { useEffect } from 'react';
import { Trash2, X, Undo2 } from 'lucide-react';

interface ClearBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemCount: number;
}

export const ClearBoardModal: React.FC<ClearBoardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close "X" Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon with Ambient Glow */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-500 shadow-sm shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Clear Whiteboard?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This action clears the entire canvas for everyone.
            </p>
          </div>
        </div>

        {/* Informative Body Content */}
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Are you sure you want to remove all drawings, smart shapes, sticky notes, and text from this whiteboard?
          </p>

          {itemCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{itemCount} {itemCount === 1 ? 'object' : 'objects'} will be cleared</span>
            </div>
          )}

          {/* Reassurance Alert Pill */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-700 dark:text-indigo-300">
            <Undo2 className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
            <div>
              <span className="font-semibold">Quick recovery:</span> If done by mistake, you can immediately restore everything by pressing <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] shadow-2xs">Ctrl+Z</kbd> or clicking Undo.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-750 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Keep Whiteboard
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Everything</span>
          </button>
        </div>
      </div>
    </div>
  );
};
