import type { ApiResponse } from '@/types';
import { api } from '@/services/api';
import type { HomeData } from './home.types';

export async function fetchHomeData() {
  const response = await api<ApiResponse<HomeData>>('/api/home');
  return response.data;
}
