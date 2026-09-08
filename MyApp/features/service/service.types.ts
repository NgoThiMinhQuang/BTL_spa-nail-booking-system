export type NailService = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  image?: number;
  imageUrl?: string | null;
  categoryId?: string;
  categoryName?: string;
  rating?: number;
  reviewCount?: number;
  images?: { id: string; imageUrl: string }[];
  benefits?: { id: string; title: string; subtitle?: string; icon?: string; color?: string }[];
  steps?: { id: string; stepNumber: number; title: string; description?: string; estimatedMinutes: number }[];
  availableStaff?: { id: string; name: string; avatarUrl?: string | null; experienceYears: number; specialty?: string; rating: number }[];
  reviews?: { id: string; customerName: string; customerAvatarUrl?: string | null; rating: number; comment?: string; imageUrl?: string | null; createdAt: string }[];
  relatedServices?: { id: string; name: string; price: number; duration: number; imageUrl?: string | null }[];
};
