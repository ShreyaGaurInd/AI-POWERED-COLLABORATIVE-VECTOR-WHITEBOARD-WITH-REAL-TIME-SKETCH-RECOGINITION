import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  CheckSquare,
  X,
  Send,
  Plus,
  Trash2,
  Check,
  User as UserIcon,
  ListTodo
} from 'lucide-react';
import { BoardChatMessageItem, BoardTodoItem } from '../../types/collab';

interface BoardChatAndTodosDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: BoardChatMessageItem[];
  todoItems: BoardTodoItem[];
  onSendMessage: (message: string) => void;
  onAddTodo: (task: string) => void;
  onToggleTodo: (todoId: string, completed: boolean) => void;
  onDeleteTodo: (todoId: string) => void;
  currentUserId?: string;
}

export const BoardChatAndTodosDrawer: React.FC<BoardChatAndTodosDrawerProps> = ({
  isOpen,
  onClose,
  chatMessages,
  todoItems,
  onSendMessage,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'todos'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [todoInput, setTodoInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat' && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isOpen]);

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleAddTodo = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!todoInput.trim()) return;
    onAddTodo(todoInput.trim());
    setTodoInput('');
  };

  if (!isOpen) return null;

  const completedCount = todoItems.filter((t) => t.completed).length;

  return (
    <div className="fixed top-20 right-4 bottom-24 z-40 w-80 md:w-96 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in slide-in-from-right-6 duration-200">
      {/* Drawer Header & Tabs */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Board Chat</span>
            {chatMessages.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                {chatMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('todos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'todos'
                ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>To-Do List</span>
            {todoItems.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                {completedCount}/{todoItems.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Board Chat */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-gray-500">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-500 mb-2">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Whiteboard Chat</p>
                <p className="text-[11px] mt-1 max-w-[200px]">
                  Share notes, brainstorm ideas, or discuss drawings with collaborators.
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = currentUserId && msg.userId === currentUserId;
                const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* User Avatar */}
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: msg.user?.avatarColor || '#6366f1' }}
                      title={msg.user?.fullName || 'User'}
                    >
                      {msg.user?.fullName ? msg.user.fullName.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          {isMe ? 'You' : msg.user?.fullName}
                        </span>
                        <span className="text-[10px] text-gray-400">{timeString}</span>
                      </div>

                      <div
                        className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                          isMe
                            ? 'bg-brand-600 text-white rounded-tr-xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-xs'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendChat}
            className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message to collaborators..."
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white transition-all shadow-sm"
              title="Send Message (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Whiteboard To-Do List */}
      {activeTab === 'todos' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Progress Bar */}
          {todoItems.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                <span>Board Action Items</span>
                <span>{Math.round((completedCount / todoItems.length) * 100)}% done</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(completedCount / todoItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Todo Items Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {todoItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-gray-500">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500 mb-2">
                  <ListTodo className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">No Action Items Yet</p>
                <p className="text-[11px] mt-1 max-w-[200px]">
                  Add things you want to do on this whiteboard so collaborators stay aligned.
                </p>
              </div>
            ) : (
              todoItems.map((todo) => (
                <div
                  key={todo.id}
                  className={`group flex items-start gap-2.5 p-2.5 rounded-2xl border transition-all ${
                    todo.completed
                      ? 'bg-gray-50/60 dark:bg-gray-850/40 border-gray-200/60 dark:border-gray-800/60 opacity-70'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-750 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-800'
                  }`}
                >
                  {/* Custom Checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id, !todo.completed)}
                    className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-all ${
                      todo.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-500 bg-white dark:bg-gray-900'
                    }`}
                  >
                    {todo.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  {/* Task text & author */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-relaxed break-words select-none ${
                        todo.completed
                          ? 'line-through text-gray-400 dark:text-gray-500'
                          : 'text-gray-800 dark:text-gray-100 font-medium'
                      }`}
                    >
                      {todo.task}
                    </p>
                    {todo.user?.fullName && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        by {todo.user.fullName}
                      </span>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => onDeleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Todo Input Bar */}
          <form
            onSubmit={handleAddTodo}
            className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2"
          >
            <input
              type="text"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              placeholder="Add whiteboard task/goal..."
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!todoInput.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition-all shadow-sm"
              title="Add Task (Enter)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
