export type UserRole = "member" | "admin" | "super_admin";
export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuthenticatedUser extends User {
  sessionTokenHash: string;
}

export interface UserCredentialsRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: UserRole;
  status: UserStatus;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
}
