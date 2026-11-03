/**
 * Three roles. Everyone who signs up is a `user`. `admin` manages content (mantras,
 * user submissions, deities). `super_admin` can also add and remove admins.
 * The legacy value `instructor` is treated as `admin`.
 */
export type Role = 'user' | 'admin' | 'super_admin' | 'instructor';

export const isAdmin = (role?: string | null) => role === 'admin' || role === 'super_admin' || role === 'instructor';
export const isSuperAdmin = (role?: string | null) => role === 'super_admin';

export const ROLE_LABEL: Record<string, string> = {
  user: 'User',
  admin: 'Admin',
  instructor: 'Admin',
  super_admin: 'Super admin',
};
