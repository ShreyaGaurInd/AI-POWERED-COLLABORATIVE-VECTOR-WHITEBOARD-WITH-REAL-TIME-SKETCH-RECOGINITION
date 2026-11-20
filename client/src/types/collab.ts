export interface FriendUser {
  friendshipId: string;
  id: string;
  fullName: string;
  email: string;
  avatarColor: string;
  since?: string;
}

export interface FriendRequestItem {
  friendshipId: string;
  sender?: { id: string; fullName: string; email: string; avatarColor: string };
  receiver?: { id: string; fullName: string; email: string; avatarColor: string };
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  fullName: string;
  email: string;
  avatarColor: string;
  friendshipStatus: 'NONE' | 'FRIENDS' | 'SENT' | 'RECEIVED';
  friendshipId?: string;
}

export interface DirectMessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  sender?: { id: string; fullName: string; avatarColor: string };
  receiver?: { id: string; fullName: string; avatarColor: string };
}

export interface BoardChatMessageItem {
  id: string;
  boardId: string;
  userId: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    avatarColor: string;
    email?: string;
  };
}

export interface BoardTodoItem {
  id: string;
  boardId: string;
  userId: string;
  task: string;
  completed: boolean;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
  };
}
