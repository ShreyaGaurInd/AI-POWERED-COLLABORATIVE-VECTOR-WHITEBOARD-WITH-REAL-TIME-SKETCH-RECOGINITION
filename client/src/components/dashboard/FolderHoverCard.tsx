import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderItem, WhiteboardItem } from '../../types/dashboard';
import { Folder as FolderIcon, Layout, Lock, Clock, ExternalLink } from 'lucide-react';

interface FolderHoverCardProps {
  folder: FolderItem;
  boards: WhiteboardItem[];
  children: React.ReactNode;
  className?: string;
  side?: 'right' | 'top';
}

export const FolderHoverCard: React.FC<FolderHoverCardProps> = ({
  folder,
  boards,
  children,
  className = '',
  side = 'right',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const boardsInFolder = boards.filter(
    (b) => b.folderId === folder.id || (b.folder && b.folder.id === folder.id)
  );

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
    }, 200); // 200ms debounce
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 250);
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Popover Preview Card */}
      {isHovered && (
        <div
          className={`absolute z-50 w-72 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-3xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            side === 'right'
              ? 'left-full top-0 ml-3'
              : 'bottom-full left-1/2 -translate-x-1/2 mb-3'
          }`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs shadow-xs"
              style={{ backgroundColor: folder.color }}
            >
              <FolderIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {folder.name}
              </h4>
              <p className="text-[10px] text-gray-400">
                {boardsInFolder.length} whiteboard{boardsInFolder.length === 1 ? '' : 's'} inside
              </p>
            </div>
          </div>

          {/* List of Whiteboards Inside */}
          <div className="py-2 max-h-48 overflow-y-auto space-y-1.5">
            {boardsInFolder.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-xs italic">
                Folder is empty
              </div>
            ) : (
              boardsInFolder.map((board) => (
                <div
                  key={board.id}
                  onClick={() => navigate(`/board/${board.id}`)}
                  className="group flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Layout className="w-3 h-3" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {board.title}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(board.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {board.isProtected && (
                      <span className="p-1 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" title="Password Protected">
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                    <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center">
            Click any whiteboard to open directly
          </div>
        </div>
      )}
    </div>
  );
};
