import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Loader2, Users } from 'lucide-react';
import { api } from '../../services/api';
import { BoardInviteItem } from '../../types/dashboard';

interface InviteNotificationBellProps {
  /** Called after accepting an invite so the dashboard can refresh its boards list */
  onInviteAccepted?: () => void;
}

export const InviteNotificationBell: React.FC<InviteNotificationBellProps> = ({
  onInviteAccepted,
}) => {
  const [invites, setInvites] = useState<BoardInviteItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [responding, setResponding] = useState<string | null>(null); // invite id being actioned
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchInvites = async () => {
    try {
      const res = await api.getMyInvites();
      if (res.success) setInvites(res.data.invites);
    } catch {
      // silent
    }
  };

  // Poll every 15 seconds for new invites
  useEffect(() => {
    fetchInvites();
    const timer = setInterval(fetchInvites, 15_000);
    return () => clearInterval(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleRespond = async (inviteId: string, action: 'accept' | 'decline') => {
    setResponding(inviteId);
    try {
      const res = await api.respondToInvite(inviteId, action);
      if (res.success) {
        setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
        if (action === 'accept' && onInviteAccepted) {
          onInviteAccepted();
        }
      }
    } catch {
      // silent
    } finally {
      setResponding(null);
    }
  };

  const pendingCount = invites.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Board Invites"
      >
        <Bell className="w-5 h-5" />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Board Invites</span>
            </div>
            {pendingCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{pendingCount} pending</span>
            )}
          </div>

          {/* Invites list */}
          <div className="max-h-72 overflow-y-auto">
            {invites.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                No pending invites
              </div>
            ) : (
              invites.map((inv) => (
                <div
                  key={inv.id}
                  className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  {/* Inviter avatar + info */}
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: inv.invitedBy.avatarColor }}
                    >
                      {inv.invitedBy.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                        <span className="text-brand-600 dark:text-brand-400">{inv.invitedBy.fullName}</span>
                        {' invited you to collaborate'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        📋 {inv.boardTitle}
                      </p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {inv.role === 'EDITOR' ? '✏️ Editor' : '👁️ Viewer'}
                      </span>
                    </div>
                  </div>

                  {/* Accept / Decline buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(inv.id, 'accept')}
                      disabled={responding === inv.id}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold transition-all"
                    >
                      {responding === inv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond(inv.id, 'decline')}
                      disabled={responding === inv.id}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 text-gray-600 dark:text-gray-300 text-xs font-semibold transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
