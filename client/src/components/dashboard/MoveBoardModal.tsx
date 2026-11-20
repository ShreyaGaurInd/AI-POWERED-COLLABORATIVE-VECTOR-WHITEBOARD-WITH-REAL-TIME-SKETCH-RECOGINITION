import React, { useState } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { FolderItem, WhiteboardItem } from '../../types/dashboard';

interface MoveBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: WhiteboardItem | null;
  folders: FolderItem[];
  onSubmit: (boardId: string, folderId: string | null) => Promise<void>;
}

export const MoveBoardModal: React.FC<MoveBoardModalProps> = ({
  isOpen,
  onClose,
  board,
  folders,
  onSubmit,
}) => {
  const [targetFolderId, setTargetFolderId] = useState<string | null>(
    board?.folder ? board.folder.id : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !board) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(board.id, targetFolderId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to move whiteboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Move Whiteboard</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
              "{board.title}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Destination Folder
            </label>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {/* Root option */}
              <div
                onClick={() => setTargetFolderId(null)}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                  targetFolderId === null
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📁</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Root Workspace</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">No folder</div>
                  </div>
                </div>
                {targetFolderId === null && <span className="text-brand-600 font-bold text-sm">✓</span>}
              </div>

              {/* Folder list */}
              {folders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setTargetFolderId(f.id)}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    targetFolderId === f.id
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                      : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{f.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {f.whiteboardCount} board{f.whiteboardCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  {targetFolderId === f.id && <span className="text-brand-600 font-bold text-sm">✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-md shadow-brand-500/20 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Moving...</span>
                </>
              ) : (
                <>
                  <span>Confirm Move</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
