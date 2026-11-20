import { AuthResponse, MeResponse } from '../types/auth';
import { FolderItem, WhiteboardItem } from '../types/dashboard';
import {
  FriendUser,
  FriendRequestItem,
  UserSearchResult,
  DirectMessageItem,
  BoardChatMessageItem,
  BoardTodoItem,
} from '../types/collab';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Custom API Client wrapper
 * Automatically injects the JWT Bearer token from localStorage
 * and handles structured error reporting.
 */
class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('collab_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Network error or invalid server response',
    }));

    if (!response.ok) {
      const err: any = new Error(data.message || `Request failed with status ${response.status}`);
      err.data = data;
      err.requiresVerification = data.requiresVerification;
      err.email = data.email;
      throw err;
    }

    return data as T;
  }

  // ---------------- AUTH ENDPOINTS ----------------
  async register(payload: { email: string; password: string; fullName: string; avatarColor?: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyEmail(payload: { email: string; code: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resendCode(payload: { email: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/auth/me', {
      method: 'GET',
    });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health', {
      method: 'GET',
    });
  }

  // ---------------- FOLDER ENDPOINTS ----------------
  async getFolders(): Promise<{ success: boolean; data: { folders: FolderItem[] } }> {
    return this.request('/folders', { method: 'GET' });
  }

  async createFolder(payload: { name: string; color?: string }): Promise<{ success: boolean; data: { folder: FolderItem } }> {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateFolder(id: string, payload: { name: string; color?: string }): Promise<{ success: boolean; data: { folder: FolderItem } }> {
    return this.request(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteFolder(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // ---------------- WHITEBOARD ENDPOINTS ----------------
  async getWhiteboards(folderId?: string): Promise<{ success: boolean; data: { whiteboards: WhiteboardItem[] } }> {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    return this.request(`/whiteboards${query}`, { method: 'GET' });
  }

  async createWhiteboard(payload: { title: string; folderId?: string | null; password?: string }): Promise<{ success: boolean; data: { whiteboard: WhiteboardItem } }> {
    return this.request('/whiteboards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateWhiteboard(id: string, payload: { title: string }): Promise<{ success: boolean; data: { whiteboard: WhiteboardItem } }> {
    return this.request(`/whiteboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async moveWhiteboard(id: string, folderId: string | null): Promise<{ success: boolean; data: { whiteboard: WhiteboardItem } }> {
    return this.request(`/whiteboards/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folderId }),
    });
  }

  async deleteWhiteboard(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/whiteboards/${id}`, {
      method: 'DELETE',
    });
  }

  async verifyBoardAccess(id: string, password: string): Promise<{ success: boolean; data: { boardSessionToken: string } }> {
    return this.request(`/whiteboards/${id}/verify-access`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // ---------------- FRIENDS & DIRECT CHAT ENDPOINTS ----------------
  async getFriends(): Promise<{
    success: boolean;
    data: {
      friends: FriendUser[];
      incomingRequests: FriendRequestItem[];
      outgoingRequests: FriendRequestItem[];
    };
  }> {
    return this.request('/friends', { method: 'GET' });
  }

  async searchUsers(query: string): Promise<{ success: boolean; data: { users: UserSearchResult[] } }> {
    return this.request(`/friends/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  }

  async sendFriendRequest(payload: { receiverId?: string; email?: string }): Promise<{ success: boolean; message: string }> {
    return this.request('/friends/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async acceptFriendRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    return this.request('/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  }

  async rejectFriendRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    return this.request('/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  }

  async removeFriend(friendId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/friends/${friendId}`, {
      method: 'DELETE',
    });
  }

  async getDirectMessages(friendId: string): Promise<{ success: boolean; data: { messages: DirectMessageItem[] } }> {
    return this.request(`/friends/${friendId}/messages`, { method: 'GET' });
  }

  async sendDirectMessage(friendId: string, message: string): Promise<{ success: boolean; data: DirectMessageItem }> {
    return this.request(`/friends/${friendId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // ---------------- WHITEBOARD CHAT & TODOS ENDPOINTS ----------------
  async getBoardChat(boardId: string): Promise<{ success: boolean; data: { messages: BoardChatMessageItem[] } }> {
    return this.request(`/whiteboards/${boardId}/chat`, { method: 'GET' });
  }

  async sendBoardChatMessage(boardId: string, message: string): Promise<{ success: boolean; data: BoardChatMessageItem }> {
    return this.request(`/whiteboards/${boardId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getBoardTodos(boardId: string): Promise<{ success: boolean; data: { todos: BoardTodoItem[] } }> {
    return this.request(`/whiteboards/${boardId}/todos`, { method: 'GET' });
  }

  async createBoardTodo(boardId: string, task: string): Promise<{ success: boolean; data: BoardTodoItem }> {
    return this.request(`/whiteboards/${boardId}/todos`, {
      method: 'POST',
      body: JSON.stringify({ task }),
    });
  }

  async toggleBoardTodo(boardId: string, todoId: string, completed: boolean): Promise<{ success: boolean; data: BoardTodoItem }> {
    return this.request(`/whiteboards/${boardId}/todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  async deleteBoardTodo(boardId: string, todoId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/whiteboards/${boardId}/todos/${todoId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
