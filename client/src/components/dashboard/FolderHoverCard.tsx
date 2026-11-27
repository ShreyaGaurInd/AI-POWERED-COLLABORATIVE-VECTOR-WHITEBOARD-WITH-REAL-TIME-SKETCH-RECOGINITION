import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderItem, WhiteboardItem, FolderFileItem } from '../../types/dashboard';
import {
  Folder as FolderIcon,
  Layout,
  Lock,
  Clock,
  ExternalLink,
  FileText,
  File as GenericFileIcon,
  Download
} from 'lucide-react';
import { api } from '../../services/api';

interface FolderHoverCardProps {
  folder: FolderItem;
  boards: WhiteboardItem[];
  children: React.ReactNode;
  className?: string;
  side?: 'right' | 'top';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const FolderHoverCard: React.FC<FolderHoverCardProps> = ({
  folder,
  boards,
  children,
  className = '',
  side = 'right',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [files, setFiles] = useState<FolderFileItem[]>([]);
  const [hasLoadedFiles, setHasLoadedFiles] = useState(false);
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

  // Load files when hovered
  useEffect(() => {
    if (isHovered && !hasLoadedFiles) {
      api.getFolderFiles(folder.id)
        .then((res) => {
          if (res.success) {
            setFiles(res.data.files);
            setHasLoadedFiles(true);
          }
        })
        .catch(() => {});
    }
  }, [isHovered, folder.id, hasLoadedFiles]);

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
          className={`absolute z-50 w-80 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-3xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
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
              className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs shadow-xs shrink-0"
              style={{ backgroundColor: folder.color }}
            >
              <FolderIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {folder.name}
              </h4>
              <p className="text-[10px] text-gray-400">
                {boardsInFolder.length} whiteboard{boardsInFolder.length === 1 ? '' : 's'}
                {files.length > 0 && ` • ${files.length} file${files.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          {/* List of Contents Inside */}
          <div className="py-2 max-h-56 overflow-y-auto space-y-2">
            {/* Whiteboards */}
            {boardsInFolder.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Whiteboards
                </div>
                {boardsInFolder.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => navigate(`/board/${board.id}`)}
                    className="group flex items-center justify-between p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
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
                ))}
              </div>
            )}

            {/* Files Section */}
            {files.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Files & Documents
                </div>
                {files.map((file) => (
                  <a
                    key={file.id}
                    href={`http://localhost:5000${file.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        {file.fileType.includes('pdf') || file.fileName.endsWith('.pdf') ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <GenericFileIcon className="w-3 h-3" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {file.fileName}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatBytes(file.fileSize)}
                        </div>
                      </div>
                    </div>

                    <Download className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {boardsInFolder.length === 0 && files.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-xs italic">
                Folder is empty (no boards or files)
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center">
            Click any board to open or file to download
          </div>
        </div>
      )}
    </div>
  );
};
