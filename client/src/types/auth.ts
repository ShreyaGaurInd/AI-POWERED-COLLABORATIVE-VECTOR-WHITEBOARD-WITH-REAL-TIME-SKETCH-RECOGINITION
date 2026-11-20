export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarColor: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: User;
    token?: string;
    email?: string;
    verificationRequired?: boolean;
  };
  requiresVerification?: boolean;
  email?: string;
}

export interface MeResponse {
  success: boolean;
  data: {
    user: User;
  };
}
