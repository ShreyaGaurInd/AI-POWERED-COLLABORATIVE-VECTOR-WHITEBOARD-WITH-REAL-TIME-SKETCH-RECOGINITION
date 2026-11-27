import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { api } from '../services/api';
import { FolderItem, WhiteboardItem, FolderFileItem } from '../types/dashboard';
import { CreateBoardModal } from '../components/dashboard/CreateBoardModal';
import { CreateFolderModal } from '../components/dashboard/CreateFolderModal';
import { MoveBoardModal } from '../components/dashboard/MoveBoardModal';
import { RenameBoardModal } from '../components/dashboard/RenameBoardModal';
import { UnlockBoardModal } from '../components/dashboard/UnlockBoardModal';
import { FolderHoverCard } from '../components/dashboard/FolderHoverCard';
import { FriendsDrawer } from '../components/dashboard/FriendsDrawer';
import { InviteNotificationBell } from '../components/dashboard/InviteNotificationBell';
import { ShareBoardModal } from '../components/canvas/ShareBoardModal';
import { 
  Plus, 
  Search, 
  X,
  Folder as FolderIcon, 
  Layout, 
  Users, 
  Clock, 
  MoreVertical, 
  Lock, 
  Presentation, 
  Sparkles, 
  LogOut, 
  PenTool,
  StickyNote,
  Share2,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  FolderInput,
  Loader2,
  UserPlus,
  Upload,
  FileText,
  File as FileGenericIcon,
  Download
} from 'lucide-react';

const PREVIEW_GRADIENTS = [
  'from-blue-500/20 via-indigo-500/20 to-purple-500/20',
  'from-emerald-500/20 via-teal-500/20 to-cyan-500/20',
  'from-amber-500/20 via-orange-500/20 to-rose-500/20',
  'from-purple-500/20 via-pink-500/20 to-rose-500/20',
  'from-indigo-500/20 via-cyan-500/20 to-blue-500/20',
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DashboardPreview: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [whiteboards, setWhiteboards] = useState<WhiteboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'folder' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown menu state
  const [openMenuBoardId, setOpenMenuBoardId] = useState<string | null>(null);

  // Modal states
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<FolderItem | null>(null);
  const [boardToMove, setBoardToMove] = useState<WhiteboardItem | null>(null);
  const [boardToRename, setBoardToRename] = useState<WhiteboardItem | null>(null);
  const [boardToUnlock, setBoardToUnlock] = useState<WhiteboardItem | null>(null);
  const [boardToShare, setBoardToShare] = useState<WhiteboardItem | null>(null);
  const [isFriendsDrawerOpen, setIsFriendsDrawerOpen] = useState(false);

  // Folder files state (uploaded PDFs, TXT, documents)
  const [folderFiles, setFolderFiles] = useState<FolderFileItem[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load folder files when active folder changes
  useEffect(() => {
    if (selectedFolderId) {
      api.getFolderFiles(selectedFolderId)
        .then((res) => {
          if (res.success) setFolderFiles(res.data.files);
        })
        .catch(() => setFolderFiles([]));
    } else {
      setFolderFiles([]);
    }
  }, [selectedFolderId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFolderId) return;

    try {
      setIsUploadingFile(true);
      const res = await api.uploadFolderFile(selectedFolderId, file);
      if (res.success && res.data.file) {
        setFolderFiles((prev) => [res.data.file, ...prev]);
        // Update file count in folder list
        setFolders((prev) =>
          prev.map((f) =>
            f.id === selectedFolderId
              ? { ...f, fileCount: (f.fileCount || 0) + 1 }
              : f
          )
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload file.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: FolderFileItem) => {
    if (!window.confirm(`Delete file "${file.fileName}"?`)) return;

    try {
      const res = await api.deleteFolderFile(file.folderId, file.id);
      if (res.success) {
        setFolderFiles((prev) => prev.filter((f) => f.id !== file.id));
        setFolders((prev) =>
          prev.map((f) =>
            f.id === file.folderId
              ? { ...f, fileCount: Math.max(0, (f.fileCount || 1) - 1) }
              : f
          )
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete file.');
    }
  };

  // Load real folders and whiteboards from backend API
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [foldersRes, boardsRes] = await Promise.all([
        api.getFolders(),
        api.getWhiteboards(),
      ]);

      if (foldersRes.success) setFolders(foldersRes.data.folders);
      if (boardsRes.success) setWhiteboards(boardsRes.data.whiteboards);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuBoardId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // ---------------- ACTION HANDLERS ----------------
  const handleCreateBoard = async (payload: { title: string; folderId: string | null; password?: string }) => {
    const res = await api.createWhiteboard(payload);
    if (res.success && res.data.whiteboard) {
      setWhiteboards((prev) => [res.data.whiteboard, ...prev]);
      // Update folder count if assigned
      if (payload.folderId) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === payload.folderId ? { ...f, whiteboardCount: f.whiteboardCount + 1 } : f
          )
        );
      }
      // Immediately navigate to the newly created whiteboard
      navigate(`/board/${res.data.whiteboard.id}`);
    }
  };

  const handleCreateOrUpdateFolder = async (payload: { name: string; color: string }) => {
    if (folderToEdit) {
      const res = await api.updateFolder(folderToEdit.id, payload);
      if (res.success && res.data.folder) {
        setFolders((prev) =>
          prev.map((f) => (f.id === folderToEdit.id ? res.data.folder : f))
        );
        // Also update embedded folder data on whiteboards
        setWhiteboards((prev) =>
          prev.map((b) =>
            b.folder?.id === folderToEdit.id
              ? { ...b, folder: { id: folderToEdit.id, name: payload.name, color: payload.color } }
              : b
          )
        );
      }
    } else {
      const res = await api.createFolder(payload);
      if (res.success && res.data.folder) {
        setFolders((prev) => [res.data.folder, ...prev]);
      }
    }
    setFolderToEdit(null);
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (!window.confirm(`Are you sure you want to delete folder "${folder.name}"? Whiteboards inside will be moved to the root level.`)) {
      return;
    }
    try {
      const res = await api.deleteFolder(folder.id);
      if (res.success) {
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
        setWhiteboards((prev) =>
          prev.map((b) => (b.folder?.id === folder.id ? { ...b, folder: null } : b))
        );
        if (selectedFolderId === folder.id) {
          setSelectedFolderId(null);
          setActiveView('all');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete folder');
    }
  };

  const handleMoveBoard = async (boardId: string, targetFolderId: string | null) => {
    const res = await api.moveWhiteboard(boardId, targetFolderId);
    if (res.success && res.data.whiteboard) {
      setWhiteboards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, folder: res.data.whiteboard.folder } : b))
      );
      // Reload folders to synchronize counts
      const foldersRes = await api.getFolders();
      if (foldersRes.success) setFolders(foldersRes.data.folders);
    }
  };

  const handleRenameBoard = async (boardId: string, title: string) => {
    const res = await api.updateWhiteboard(boardId, { title });
    if (res.success && res.data.whiteboard) {
      setWhiteboards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, title: res.data.whiteboard.title } : b))
      );
    }
  };

  const handleDeleteBoard = async (board: WhiteboardItem) => {
    if (!window.confirm(`Are you sure you want to delete whiteboard "${board.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await api.deleteWhiteboard(board.id);
      if (res.success) {
        setWhiteboards((prev) => prev.filter((b) => b.id !== board.id));
        if (board.folder) {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === board.folder?.id
                ? { ...f, whiteboardCount: Math.max(0, f.whiteboardCount - 1) }
                : f
            )
          );
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete whiteboard');
    }
  };

  const handleOpenBoard = (board: WhiteboardItem) => {
    // If board is password protected AND user is not the owner, prompt for the password
    if (board.isProtected && !board.isOwner) {
      setBoardToUnlock(board);
      return;
    }

    navigate(`/board/${board.id}`);
  };

  const handleUnlockSuccess = (board: WhiteboardItem, sessionToken: string) => {
    sessionStorage.setItem(`board_session_${board.id}`, sessionToken);
    navigate(`/board/${board.id}`);
  };

  // When user starts searching, automatically scope to all boards so results aren't
  // confined to the currently selected folder or shared view.
  const isSearching = searchQuery.trim().length > 0;

  // Filtered boards based on active view & search query
  const filteredBoards = whiteboards.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !isSearching ||
      b.title.toLowerCase().includes(q) ||
      (b.folder && b.folder.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // While a search query is active, show results across ALL boards
    if (isSearching) return true;

    if (activeView === 'folder' && selectedFolderId) {
      return b.folder?.id === selectedFolderId;
    }

    if (activeView === 'shared') {
      return !b.isOwner;
    }

    return b.isOwner; // 'all' view shows boards you created/own; shared boards live in 'Shared with me'
  });

  // Filtered folders shown in sidebar & folder grid
  const filteredFolders = isSearching
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;

  // Filtered folder files (when inside a folder view & searching)
  const filteredFolderFiles = isSearching
    ? folderFiles.filter((f) =>
        f.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : folderFiles;

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-2xl text-white shadow-md shadow-brand-500/20 flex items-center justify-center">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl text-gray-900 dark:text-white tracking-tight">CollabBoard</span>
            </div>
          </div>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search whiteboards, folders, files..."
                className="w-full pl-10 pr-9 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right Actions: Create, Theme, User */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateBoardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Whiteboard</span>
            </button>

            <button
              onClick={() => setIsFriendsDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-sm font-medium transition-all"
              title="Friends & Chat"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Friends</span>
            </button>

            <InviteNotificationBell onInviteAccepted={loadDashboardData} />

            <ThemeToggle />



            {user && (
              <div className="flex items-center gap-3 pl-2 border-l border-gray-200 dark:border-gray-800">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900"
                  style={{ backgroundColor: user.avatarColor }}
                >
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    {user.fullName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        {/* Left Navigation Sidebar */}
        <aside className="w-60 hidden lg:block shrink-0 space-y-6">
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveView('all');
                setSelectedFolderId(null);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeView === 'all'
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>All Whiteboards</span>
            </button>
            <button
              onClick={() => {
                setActiveView('shared');
                setSelectedFolderId(null);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeView === 'shared'
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Shared with me</span>
            </button>
          </nav>

          {/* Quick Folders in Sidebar */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-3">
              <span>My Folders</span>
              <button
                onClick={() => {
                  setFolderToEdit(null);
                  setIsCreateFolderOpen(true);
                }}
                className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                title="Create Folder"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {filteredFolders.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2 italic">{isSearching ? 'No folders match' : 'No folders yet'}</p>
              ) : (
                filteredFolders.map((f) => (
                  <FolderHoverCard key={f.id} folder={f} boards={whiteboards} side="right">
                  <div
                    onClick={() => {
                      setSelectedFolderId(f.id);
                      setActiveView('folder');
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      activeView === 'folder' && selectedFolderId === f.id
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-[11px]">{f.whiteboardCount}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(f);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  </FolderHoverCard>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* Canva Signature Hero Banner (shown when viewing all boards) */}
          {activeView === 'all' && (
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-purple-500/10 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 max-w-xl">
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium tracking-wide inline-block mb-3 backdrop-blur-md">
                  ✨ Ready to brainstorm?
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  What will you design today, {user?.fullName.split(' ')[0]}?
                </h1>
                <p className="mt-2 text-purple-100 text-sm sm:text-base leading-relaxed">
                  Start a new whiteboard, organize boards into folders, or protect sensitive brainstorms with passwords.
                </p>
              </div>
            </div>
          )}

          {/* Folder View Header */}
          {activeView === 'folder' && selectedFolder && (
            <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: selectedFolder.color }}
                >
                  <FolderIcon className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {selectedFolder.name}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {filteredBoards.length} whiteboard{filteredBoards.length === 1 ? '' : 's'}
                    {folderFiles.length > 0 && ` • ${folderFiles.length} file${folderFiles.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {isUploadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Upload File</span>
                </button>
                <button
                  onClick={() => {
                    setFolderToEdit(selectedFolder);
                    setIsCreateFolderOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors"
                >
                  Edit Folder
                </button>
                <button
                  onClick={() => handleDeleteFolder(selectedFolder)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/40 transition-colors"
                >
                  Delete Folder
                </button>
              </div>
            </div>
          )}

          {/* Folder Uploaded Files & Documents */}
          {activeView === 'folder' && selectedFolder && (
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span>Folder Files & Attachments</span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Upload PDFs, notes, documents, or reference files
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.txt,.docx,.doc,.xlsx,.csv,.png,.jpg,.jpeg,.json,.md"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-xs"
                  >
                    {isUploadingFile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploadingFile ? 'Uploading...' : 'Upload File'}</span>
                  </button>
                </div>
              </div>

              {folderFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-950/20"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    No files uploaded yet in this folder
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Click here to attach a PDF, text file, document, or image (up to 50MB)
                  </div>
                </div>
              ) : filteredFolderFiles.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400">
                  No files matched your search query.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredFolderFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between hover:shadow-xs transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          {file.fileType.includes('pdf') || file.fileName.endsWith('.pdf') ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <FileGenericIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={file.fileName}>
                            {file.fileName}
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span>{formatBytes(file.fileSize)}</span>
                            <span>•</span>
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <a
                          href={`http://localhost:5000${file.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          download={file.fileName}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Download / View File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Quick Start Templates */}
          {activeView === 'all' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Start a new whiteboard</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={() => setIsCreateBoardOpen(true)}
                  className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-brand-500 dark:hover:border-brand-500 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-brand-500/5 hover:-translate-y-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Blank Board</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Infinite clean slate</div>
                </button>

                <button
                  onClick={() => {
                    handleCreateBoard({
                      title: 'Classroom Lecture Board',
                      folderId: selectedFolderId,
                    });
                  }}
                  className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Presentation className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Classroom Lesson</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Presentation & laser mode</div>
                </button>

                <button
                  onClick={() => {
                    handleCreateBoard({
                      title: 'Team Brainstorm Session',
                      folderId: selectedFolderId,
                    });
                  }}
                  className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-amber-500 dark:hover:border-amber-500 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <StickyNote className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Brainstorm Session</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sticky notes & diagrams</div>
                </button>

                <button
                  onClick={() => {
                    handleCreateBoard({
                      title: 'Architecture & Flowchart',
                      folderId: selectedFolderId,
                    });
                  }}
                  className="group p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-purple-500 dark:hover:border-purple-500 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">Smart Flowchart</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-straightening shapes</div>
                </button>
              </div>
            </section>
          )}

          {/* Folders Section (shown on All Boards view) */}
          {activeView === 'all' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Folders</h2>
                <button
                  onClick={() => {
                    setFolderToEdit(null);
                    setIsCreateFolderOpen(true);
                  }}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>+ New Folder</span>
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No folders created yet. Click "+ New Folder" to organize your boards!
                  </p>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No folders matched your search.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {filteredFolders.map((f) => (
                    <FolderHoverCard key={f.id} folder={f} boards={whiteboards} side="top">
                    <div
                      onClick={() => {
                        setSelectedFolderId(f.id);
                        setActiveView('folder');
                      }}
                      className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-between hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 group-hover:text-brand-600 transition-colors">
                          <FolderIcon className="w-5 h-5" style={{ color: f.color }} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{f.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{f.whiteboardCount} boards</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    </FolderHoverCard>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Whiteboards Grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {isSearching
                  ? `Search results for "${searchQuery}"`
                  : activeView === 'folder'
                  ? `Boards in ${selectedFolder?.name || 'Folder'}`
                  : activeView === 'shared'
                  ? 'Shared With You'
                  : 'Recent Whiteboards'}
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredBoards.length} board{filteredBoards.length === 1 ? '' : 's'}
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                <p className="text-sm">Loading your canvas boards...</p>
              </div>
            ) : filteredBoards.length === 0 ? (
              <div className="p-12 rounded-3xl border border-dashed border-gray-300 dark:border-gray-800 text-center bg-gray-50/50 dark:bg-gray-900/30">
                <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <PenTool className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">No whiteboards found</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-4">
                  {isSearching
                    ? `No boards matched "${searchQuery}".`
                    : activeView === 'folder'
                    ? 'This folder is currently empty.'
                    : 'Get started by creating your very first collaborative whiteboard!'}
                </p>
                {isSearching ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-xs transition-all"
                  >
                    <X className="w-4 h-4" />
                    <span>Clear Search</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCreateBoardOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs shadow-md shadow-brand-500/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Whiteboard</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredBoards.map((board, idx) => {
                  const gradient = PREVIEW_GRADIENTS[idx % PREVIEW_GRADIENTS.length];
                  const isMenuOpen = openMenuBoardId === board.id;

                  return (
                    <div
                      key={board.id}
                      onClick={() => handleOpenBoard(board)}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none hover:-translate-y-1 transition-all duration-200 group flex flex-col cursor-pointer relative"
                    >
                      {/* Thumbnail Header Mockup */}
                      <div
                        className={`h-40 bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between relative border-b border-gray-100 dark:border-gray-800/80`}
                      >
                        <div className="flex items-center justify-between">
                          {board.isProtected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-amber-700 dark:text-amber-400 shadow-sm backdrop-blur-md">
                              <Lock className="w-3 h-3" />
                              <span>Protected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 shadow-sm backdrop-blur-md">
                              <Share2 className="w-3 h-3 text-emerald-500" />
                              <span>{board.isOwner ? 'Owned' : 'Shared'}</span>
                            </span>
                          )}

                          {/* 3-dots action menu button */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuBoardId(isMenuOpen ? null : board.id);
                              }}
                              className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  onClick={() => {
                                    setOpenMenuBoardId(null);
                                    handleOpenBoard(board);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open Board</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuBoardId(null);
                                    setBoardToShare(board);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Share & Invite</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuBoardId(null);
                                    setBoardToRename(board);
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Rename</span>
                                </button>
                                {board.isOwner && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuBoardId(null);
                                      setBoardToMove(board);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                  >
                                    <FolderInput className="w-3.5 h-3.5" />
                                    <span>Move to Folder</span>
                                  </button>
                                )}
                                {board.isOwner && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuBoardId(null);
                                      handleDeleteBoard(board);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Subtle canvas grid inside thumbnail */}
                        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                        <div className="relative z-10 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          {board.folder ? (
                            <span
                              className="px-2 py-0.5 rounded-md font-medium text-white shadow-xs"
                              style={{ backgroundColor: board.folder.color }}
                            >
                              {board.folder.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-gray-900/80 font-medium">
                              Root Workspace
                            </span>
                          )}

                          <span className="flex items-center gap-1 bg-white/70 dark:bg-gray-900/70 px-2 py-0.5 rounded-full backdrop-blur-xs">
                            <Users className="w-3 h-3" />
                            {board.memberCount}
                          </span>
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {board.title}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Edited {new Date(board.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Click to open</span>
                          <span className="p-1.5 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modals */}
      <CreateBoardModal
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSubmit={handleCreateBoard}
      />

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setFolderToEdit(null);
        }}
        folderToEdit={folderToEdit}
        onSubmit={handleCreateOrUpdateFolder}
      />

      <MoveBoardModal
        isOpen={boardToMove !== null}
        onClose={() => setBoardToMove(null)}
        board={boardToMove}
        folders={folders}
        onSubmit={handleMoveBoard}
      />

      <RenameBoardModal
        isOpen={boardToRename !== null}
        onClose={() => setBoardToRename(null)}
        board={boardToRename}
        onSubmit={handleRenameBoard}
      />

      <UnlockBoardModal
        isOpen={boardToUnlock !== null}
        onClose={() => setBoardToUnlock(null)}
        board={boardToUnlock}
        onUnlockSuccess={handleUnlockSuccess}
        onVerify={async (boardId, password) => {
          const res = await api.verifyBoardAccess(boardId, password);
          return res.data;
        }}
      />

      <FriendsDrawer
        isOpen={isFriendsDrawerOpen}
        onClose={() => setIsFriendsDrawerOpen(false)}
        currentUserId={user?.id}
      />

      <ShareBoardModal
        isOpen={boardToShare !== null}
        onClose={() => setBoardToShare(null)}
        board={boardToShare}
      />
    </div>
  );
};
