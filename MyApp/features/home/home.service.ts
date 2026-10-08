import type { ApiResponse } from '@/types';
import { api } from '@/services/api';
import type { HomeData } from './home.types';

export function fetchHomeData() {
  return api<ApiResponse<HomeData>>('/api/home').then((r) => r.data);
}

export type RecentReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
  customerAvatarUrl: string | null;
  serviceName: string;
};

export function fetchRecentReviews(limit = 6) {
  return api<ApiResponse<RecentReview[]>>(`/api/home/reviews/recent?limit=${limit}`).then((r) => r.data);
}

export function fetchDesigns() {
  return api<ApiResponse<{ id: string }[]>>('/api/home/designs').then((r) => r.data);
}
