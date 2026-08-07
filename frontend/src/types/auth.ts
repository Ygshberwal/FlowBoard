export interface User {
  id: string;
  username: string;
  email: string;
  mobile_number: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  mobile_number: string;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  mobile_number?: string;
  password?: string;
  current_password?: string;
}

export interface DeleteAccountRequest {
  current_password: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterResponse extends TokenPair {
  user: User;
}

export interface UserUpdateResponse {
  user: User;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}
