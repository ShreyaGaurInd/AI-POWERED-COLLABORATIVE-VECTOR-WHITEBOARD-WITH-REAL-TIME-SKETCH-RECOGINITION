import React, { useState } from 'react';
import { X, Lock, Folder, Loader2, Sparkles, Presentation, StickyNote, Plus } from 'lucide-react';
import { FolderItem } from '../../types/dashboard';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSubmit: (payload: { title: string; folderId: string | null; password?: string }) => Promise<void>;
}

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  isOpen,
  onClose,
  folders,
  defaultFolderId = null,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a whiteboard title');
      return;
    }

    if (isProtected && !password.trim()) {
      setError('Please provide a password for this protected whiteboard');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        folderId: folderId || null,
        password: isProtected ? password.trim() : undefined,
      });
      // Reset form
      setTitle('');
      setPassword('');
      setIsProtected(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create whiteboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSelect = (templateTitle: string) => {
    setTitle(templateTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Whiteboard</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Collaborative canvas space</p>
            </div>
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Quick template chip buttons */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Quick Templates
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateSelect('Classroom Lecture Board')}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-brand-500 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition-all flex items-center gap-2"
              >
                <Presentation className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span className="truncate">Lecture</span>
              </button>
              <button
                type="button"
                onClick={() => handleTemplateSelect('Team Brainstorm Session')}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-brand-500 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition-all flex items-center gap-2"
              >
                <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Brainstorm</span>
              </button>
              <button
                type="button"
                onClick={() => handleTemplateSelect('Architecture & Flowchart')}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-brand-500 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="truncate">Flowchart</span>
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Whiteboard Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems Brainstorm"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              autoFocus
            />
          </div>

          {/* Folder Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Organize into Folder
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Folder className="w-4 h-4" />
              </div>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="">Root Level (No Folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password Protection Toggle */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Password Protection</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Require a password for other users to open</div>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isProtected}
                  onChange={(e) => setIsProtected(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {isProtected && (
              <div className="mt-3 animate-in fade-in duration-150">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Board Password
                </label>
                <input
                  type="password"
                  required={isProtected}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter board unlock password"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Password is stored strictly as a secure bcrypt hash.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
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
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Board</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
