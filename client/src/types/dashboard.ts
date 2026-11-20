export interface FolderItem {
  id: string;
  name: string;
  color: string;
  whiteboardCount: number;
  createdAt: string;
  updatedAt?: string;
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
  isOwner: boolean;
  userRole: 'OWNER' | 'EDITOR' | 'VIEWER';
  folder: BoardFolder | null;
  folderId?: string | null;
  owner: BoardOwner;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}
