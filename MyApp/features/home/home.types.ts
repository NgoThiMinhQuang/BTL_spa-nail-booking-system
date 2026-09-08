import type { NailService } from '@/features/service/service.types';

export type HomeCustomer = { id: string; name: string; avatarUrl?: string | null };
export type HomeBanner = { id: string; title: string; subtitle?: string; buttonText: string; imageUrl: string; discountPercent?: number };
export type NailDesign = { id: string; name: string; imageUrl: string };
export type FeaturedArtist = { id: string; name: string; avatarUrl: string; experienceYears: number; specialty: string; rating: number; expert: boolean };
export type UpcomingAppointment = { id: string; serviceName: string; imageUrl?: string | null; startsAt: string; status: string; staffName?: string | null };

export type HomeData = {
  customer: HomeCustomer | null;
  banner: HomeBanner | null;
  featuredServices: NailService[];
  trendingDesigns: NailDesign[];
  featuredArtists: FeaturedArtist[];
  upcomingAppointment: UpcomingAppointment | null;
};
