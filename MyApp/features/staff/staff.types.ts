export type StaffService = { id: string; name: string; categoryName?: string | null };

export type StaffMember = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  experienceYears: number;
  specialty?: string | null;
  rating: number;
  reviewCount: number;
  worksToday: boolean;
  services: StaffService[];
};

export type StaffReview = { id: string; customerName: string; customerAvatarUrl?: string | null; rating: number; comment?: string | null; imageUrl?: string | null; createdAt: string };
export type StaffDetail = StaffMember & { portfolio: { imageUrl: string; serviceName: string }[]; reviews: StaffReview[] };
