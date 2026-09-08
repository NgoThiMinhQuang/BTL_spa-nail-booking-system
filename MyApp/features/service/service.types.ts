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
};
