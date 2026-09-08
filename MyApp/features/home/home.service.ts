import type { ApiResponse } from '@/types';
import { api } from '@/services/api';
import type { HomeData } from './home.types';

export async function fetchHomeData(customerId = '1') {
  const response = await api<ApiResponse<HomeData>>(`/api/home?customerId=${customerId}`);
  return response.data;
}
