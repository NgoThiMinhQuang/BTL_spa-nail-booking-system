import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import type { StaffDetail, StaffMember } from './staff.types';

export async function fetchStaff() {
  const response = await api<ApiResponse<StaffMember[]>>('/api/staff');
  return response.data.map((staff) => ({
    ...staff,
    id: String(staff.id),
    experienceYears: Number(staff.experienceYears),
    rating: Number(staff.rating ?? 0),
    reviewCount: Number(staff.reviewCount ?? 0),
    services: staff.services.map((service) => ({ ...service, id: String(service.id) })),
  }));
}

export async function fetchStaffById(id: string) {
  const response = await api<ApiResponse<StaffDetail>>(`/api/staff/${id}`);
  return { ...response.data, id: String(response.data.id), rating: Number(response.data.rating), reviewCount: Number(response.data.reviewCount), experienceYears: Number(response.data.experienceYears) };
}
