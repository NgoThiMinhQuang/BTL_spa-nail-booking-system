import { api } from '@/services/api';
import type { ApiResponse } from '@/types';
import type { NailService } from './service.types';

type ServiceDto = Omit<NailService, 'id' | 'categoryId'> & {
  id: string | number;
  categoryId?: string | number;
};

function normalizeService(service: ServiceDto): NailService {
  return {
    ...service,
    id: String(service.id),
    categoryId: service.categoryId == null ? undefined : String(service.categoryId),
    price: Number(service.price),
    duration: Number(service.duration),
    rating: Number(service.rating ?? 0),
    reviewCount: Number(service.reviewCount ?? 0),
  };
}

export async function fetchServices() {
  const response = await api<ApiResponse<ServiceDto[]>>('/api/services');
  return response.data.map(normalizeService);
}

export async function fetchServiceById(id: string) {
  const response = await api<ApiResponse<ServiceDto>>(`/api/services/${id}`);
  return normalizeService(response.data);
}
