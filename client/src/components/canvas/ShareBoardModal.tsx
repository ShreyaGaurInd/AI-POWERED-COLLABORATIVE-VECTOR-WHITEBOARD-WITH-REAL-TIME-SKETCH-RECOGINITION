import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  UserPlus,
  Crown,
  Trash2,
  Loader2,
  Shield,
  Eye,
  Edit3,
  Globe,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api';
import { BoardMemberItem, WhiteboardItem } from '../../types/dashboard';

interface ShareBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: WhiteboardItem | null;
}

export const ShareBoardModal: React.FC<ShareBoardModalProps> = ({
  isOpen,
  onClose,
  board,
}) => {
  const [members, setMembers] = useState<BoardMemberItem[]>([]);
  const [owner, setOwner] = useState<{ id: string; fullName: string; email: string; avatarColor: string } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Link access
  const [linkAccess, setLinkAccess] = useState<'NONE' | 'VIEWER' | 'EDITOR'>('NONE');
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);

  // Invite state
  const [inviteInput, setInviteInput] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [isInviting, setIsInviting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !board) return;
    let isMounted = true;
    async function loadMembers() {
      try {
        setIsLoading(true);
        setFeedback(null);
        const res = await api.getBoardMembers(board!.id);
        if (isMounted && res.success) {
          setMembers(res.data.members);
          setOwner(res.data.owner);
          setIsOwner(res.data.isOwner);
          setLinkAccess((res.data as any).linkAccess ?? 'NONE');
        }
      } catch (err: any) {
        console.error('Failed to load board members:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadMembers();
    return () => { isMounted = false; };
  }, [isOpen, board]);

  if (!isOpen || !board) return null;

  const boardLink = `${window.location.origin}/board/${board.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(boardLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleLinkAccessChange = async (newAccess: 'NONE' | 'VIEWER' | 'EDITOR') => {
    if (!isOwner) return;
    setLinkAccess(newAccess);
    try {
      setIsSavingLink(true);
      await api.updateLinkAccess(board.id, newAccess);
      setLinkSaved(true);
      setTimeout(() => setLinkSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    try {
      setIsInviting(true);
      setFeedback(null);
      const res = await api.addBoardMember(board.id, {
        emailOrName: inviteInput.trim(),
        role: inviteRole,
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setInviteInput('');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send invite. Please check email/name.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from this whiteboard?`)) return;
    try {
      const res = await api.removeBoardMember(board.id, memberId);
      if (res.success) setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove collaborator.');
    }
  };

  const linkOptions: { value: 'NONE' | 'VIEWER' | 'EDITOR'; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'NONE',
      label: 'No access',
      desc: 'Only invited people can open this board',
      icon: <Lock className="w-4 h-4 text-gray-500" />,
    },
    {
      value: 'VIEWER',
      label: 'View only',
      desc: 'Anyone with the link can view but not edit',
      icon: <Eye className="w-4 h-4 text-blue-500" />,
    },
    {
      value: 'EDITOR',
      label: 'Can edit',
      desc: 'Anyone with the link can draw and edit freely',
      icon: <Edit3 className="w-4 h-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Share Whiteboard</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Invite collaborators — they confirm before joining
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedback.type === 'success'
              ? <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              : <Shield className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 1. Shareable link + link-access control */}
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Shareable Board Link
          </label>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={boardLink}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 text-xs font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                copiedLink ? 'bg-emerald-600 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Link-access selector */}
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1">
                Anyone with this link can…
              </span>
              {isSavingLink && <Loader2 className="w-3 h-3 animate-spin text-brand-500" />}
              {linkSaved && <Check className="w-3 h-3 text-emerald-500" />}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {linkOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleLinkAccessChange(opt.value)}
                  disabled={!isOwner || isSavingLink}
                  title={opt.desc}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center border transition-all text-xs font-medium ${
                    linkAccess === opt.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-gray-400">
              {linkOptions.find((o) => o.value === linkAccess)?.desc}
              {!isOwner && ' (only the owner can change this)'}
            </p>
          </div>
        </div>

        {/* 2. Direct invite */}
        <form onSubmit={handleInvite} className="mt-5 space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Send Invite (Requires Confirmation)
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Enter email or full name..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="EDITOR">Can Edit</option>
              <option value="VIEWER">Can View</option>
            </select>
            <button
              type="submit"
              disabled={isInviting || !inviteInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Invite</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            An invite will be sent — they must accept before joining the board.
          </p>
        </form>

        {/* 3. Collaborators list */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <span>Current Collaborators</span>
            <span>{members.length + (owner ? 1 : 0)} people</span>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              </div>
            ) : (
              <>
                {owner && (
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: owner.avatarColor }}
                      >
                        {owner.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                          <span>{owner.fullName}</span>
                          <span className="text-[10px] text-gray-400 font-normal">(You)</span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">{owner.email}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      <Crown className="w-3 h-3" />
                      <span>Owner</span>
                    </span>
                  </div>
                )}

                {members.length === 0 ? (
                  <div className="text-center py-4 text-xs text-gray-400 italic">
                    No additional collaborators yet. Invite someone above or copy the link!
                  </div>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: m.user.avatarColor }}
                        >
                          {m.user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">{m.user.fullName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{m.user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.role === 'EDITOR'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {m.role === 'EDITOR' ? <Edit3 className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          <span>{m.role === 'EDITOR' ? 'Editor' : 'Viewer'}</span>
                        </span>
                        {isOwner && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.user.fullName)}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
