export interface FolderItem {
  id: string;
  name: string;
  color: string;
  whiteboardCount: number;
  fileCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface FolderFileItem {
  id: string;
  folderId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  createdAt: string;
  updatedAt?: string;
  user?: {
    id: string;
    fullName: string;
    avatarColor: string;
  };
}

export interface BoardMemberItem {
  id: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  invitedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarColor: string;
  };
}

export interface BoardInviteItem {
  id: string;
  boardId: string;
  boardTitle: string;
  role: 'EDITOR' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedBy: {
    id: string;
    fullName: string;
    avatarColor: string;
  };
  createdAt: string;
}

export interface BoardOwner {
  id: string;
  fullName: string;
  avatarColor: string;
}

export interface BoardFolder {
  id: string;
  name: string;
  color: string;
}

export interface WhiteboardItem {
  id: string;
  title: string;
  isProtected: boolean;
  linkAccess?: 'NONE' | 'VIEWER' | 'EDITOR';
  isOwner: boolean;
  userRole: 'OWNER' | 'EDITOR' | 'VIEWER';
  folder: BoardFolder | null;
  folderId?: string | null;
  owner: BoardOwner;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}
