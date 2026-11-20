import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Users,
  UserPlus,
  MessageCircle,
  X,
  Search,
  Check,
  ArrowLeft,
  Send,
  Trash2,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  FriendUser,
  FriendRequestItem,
  UserSearchResult,
  DirectMessageItem,
} from '../../types/collab';

interface FriendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export const FriendsDrawer: React.FC<FriendsDrawerProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'add' | 'requests'>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // 1-on-1 Chat state
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect socket for real-time direct messaging
  useEffect(() => {
    const token = localStorage.getItem('collab_token');
    if (!token) return;

    const socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user:join', { token });
    });

    socket.on('direct:received', (msg: DirectMessageItem) => {
      setChatMessages((prev) => [...prev.filter((m) => m.id !== msg.id), msg]);
    });

    socket.on('direct:sent', (msg: DirectMessageItem) => {
      setChatMessages((prev) => [...prev.filter((m) => m.id !== msg.id), msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Load friends and requests
  const loadFriendsData = async () => {
    try {
      setIsLoading(true);
      const res = await api.getFriends();
      if (res.success) {
        setFriends(res.data.friends);
        setIncomingRequests(res.data.incomingRequests);
        setOutgoingRequests(res.data.outgoingRequests);
      }
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFriendsData();
    }
  }, [isOpen]);

  // Handle Search Users
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.searchUsers(searchQuery.trim());
        if (res.success) {
          setSearchResults(res.data.users);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open direct chat with friend
  const handleOpenChat = async (friend: FriendUser) => {
    setSelectedFriend(friend);
    try {
      setIsLoadingChat(true);
      const res = await api.getDirectMessages(friend.id);
      if (res.success) {
        setChatMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Failed to load direct messages:', err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (selectedFriend) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, selectedFriend]);

  // Send Direct Message
  const handleSendDirectMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !selectedFriend) return;

    const text = chatInput.trim();
    setChatInput('');

    // Emit via socket for instant broadcast
    if (socketRef.current) {
      socketRef.current.emit('direct:send', {
        receiverId: selectedFriend.id,
        message: text,
      });
    } else {
      // Fallback REST
      try {
        const res = await api.sendDirectMessage(selectedFriend.id, text);
        if (res.success) {
          setChatMessages((prev) => [...prev, res.data]);
        }
      } catch (err) {
        console.error('Failed to send direct message:', err);
      }
    }
  };

  // Send Friend Request
  const handleSendRequest = async (receiverId: string) => {
    try {
      const res = await api.sendFriendRequest({ receiverId });
      if (res.success) {
        setSearchFeedback('Friend request sent!');
        setTimeout(() => setSearchFeedback(null), 3000);
        // Update search result badge
        setSearchResults((prev) =>
          prev.map((u) => (u.id === receiverId ? { ...u, friendshipStatus: 'SENT' } : u))
        );
        loadFriendsData();
      }
    } catch (err: any) {
      setSearchFeedback(err.message || 'Failed to send request');
      setTimeout(() => setSearchFeedback(null), 3000);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const res = await api.acceptFriendRequest(friendshipId);
      if (res.success) {
        loadFriendsData();
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  // Reject / Cancel Request
  const handleRejectRequest = async (friendshipId: string) => {
    try {
      const res = await api.rejectFriendRequest(friendshipId);
      if (res.success) {
        loadFriendsData();
      }
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      const res = await api.removeFriend(friendId);
      if (res.success) {
        if (selectedFriend?.id === friendId) {
          setSelectedFriend(null);
        }
        loadFriendsData();
      }
    } catch (err) {
      console.error('Failed to remove friend:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedFriend ? (
              <button
                onClick={() => setSelectedFriend(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Back to Friends"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {selectedFriend ? selectedFriend.fullName : 'Friends & Chat'}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {selectedFriend ? selectedFriend.email : `${friends.length} friend${friends.length === 1 ? '' : 's'}`}
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

        {/* ── 1-on-1 Direct Chat View ── */}
        {selectedFriend ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-gray-950/40">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingChat ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500 mb-2">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    No messages yet
                  </p>
                  <p className="text-[11px] mt-1 max-w-[200px]">
                    Say hello to {selectedFriend.fullName}!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = currentUserId && msg.senderId === currentUserId;
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-xs"
                        style={{
                          backgroundColor: isMe ? '#6366f1' : selectedFriend.avatarColor,
                        }}
                      >
                        {isMe ? 'You' : selectedFriend.fullName.charAt(0).toUpperCase()}
                      </div>

                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                            isMe
                              ? 'bg-brand-600 text-white rounded-tr-xs'
                              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-750 rounded-tl-xs'
                          }`}
                        >
                          {msg.message}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 px-1">{time}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendDirectMessage}
              className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Message ${selectedFriend.fullName.split(' ')[0]}...`}
                className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* ── Main Drawer: Friends / Add / Requests Tabs ── */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab navigation */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'friends'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'
                }`}
              >
                <span>My Friends</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {friends.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('add')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'add'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Friend</span>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'requests'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850'
                }`}
              >
                <span>Requests</span>
                {incomingRequests.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Tab: My Friends */}
              {activeTab === 'friends' && (
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                    </div>
                  ) : friends.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500 mx-auto mb-2">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">No Friends Yet</p>
                      <p className="text-[11px] mt-1 max-w-[200px] mx-auto">
                        Connect with collaborators by searching their email or name in the Add Friend tab!
                      </p>
                      <button
                        onClick={() => setActiveTab('add')}
                        className="mt-3 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
                      >
                        Find Collaborators
                      </button>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="p-3 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0"
                            style={{ backgroundColor: friend.avatarColor }}
                          >
                            {friend.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {friend.fullName}
                            </h4>
                            <p className="text-[10px] text-gray-400 truncate">{friend.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenChat(friend)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 text-brand-600 dark:text-brand-400 text-xs font-semibold transition-colors"
                            title="Chat"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>

                          <button
                            onClick={() => handleRemoveFriend(friend.id)}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove Friend"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab: Add Friend (Search) */}
              {activeTab === 'add' && (
                <div className="space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users by email or name..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>

                  {searchFeedback && (
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                      {searchFeedback}
                    </div>
                  )}

                  {/* Results */}
                  <div className="space-y-2">
                    {isSearching ? (
                      <div className="text-center py-6 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-500" />
                        <span className="text-xs mt-1 block">Searching...</span>
                      </div>
                    ) : searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">
                        No users found matching "{searchQuery}"
                      </p>
                    ) : (
                      searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0"
                              style={{ backgroundColor: user.avatarColor }}
                            >
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                {user.fullName}
                              </h4>
                              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                            </div>
                          </div>

                          <div>
                            {user.friendshipStatus === 'FRIENDS' ? (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                                Friends
                              </span>
                            ) : user.friendshipStatus === 'SENT' ? (
                              <span className="text-[11px] font-semibold text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-750 rounded-lg">
                                Requested
                              </span>
                            ) : user.friendshipStatus === 'RECEIVED' ? (
                              <button
                                onClick={() => user.friendshipId && handleAcceptRequest(user.friendshipId)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                              >
                                Accept
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(user.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Requests */}
              {activeTab === 'requests' && (
                <div className="space-y-4">
                  {/* Incoming Requests */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      Received Requests ({incomingRequests.length})
                    </h3>

                    {incomingRequests.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No pending friend requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {incomingRequests.map((req) => (
                          <div
                            key={req.friendshipId}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0"
                                style={{ backgroundColor: req.sender?.avatarColor || '#6366f1' }}
                              >
                                {req.sender?.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                  {req.sender?.fullName}
                                </h4>
                                <p className="text-[10px] text-gray-400 truncate">{req.sender?.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleAcceptRequest(req.friendshipId)}
                                className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                title="Accept Request"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.friendshipId)}
                                className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                                title="Decline Request"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outgoing Requests */}
                  {outgoingRequests.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                        Sent Requests ({outgoingRequests.length})
                      </h3>
                      <div className="space-y-2">
                        {outgoingRequests.map((req) => (
                          <div
                            key={req.friendshipId}
                            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-2xl flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0"
                                style={{ backgroundColor: req.receiver?.avatarColor || '#6366f1' }}
                              >
                                {req.receiver?.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                  {req.receiver?.fullName}
                                </h4>
                                <p className="text-[10px] text-gray-400 truncate">{req.receiver?.email}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRejectRequest(req.friendshipId)}
                              className="px-2.5 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
