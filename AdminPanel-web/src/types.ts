/* ===== Kiểu dữ liệu riêng của khu vực quản trị ===== */

export type Role = 'admin' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
  avatar?: string | null;
}
