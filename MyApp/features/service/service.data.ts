import { NailService } from './service.types';

export const services: NailService[] = [
  { id: 'gel', name: 'Sơn Gel', description: 'Màu gel bền đẹp, chăm sóc móng cơ bản.', duration: 60, price: 200000, image: require('@/assets/images/nails/nail-collection-v2.png') },
  { id: 'art', name: 'Nail Art', description: 'Thiết kế móng theo phong cách riêng của bạn.', duration: 90, price: 350000, image: require('@/assets/images/nails/nail-collection-v2.png') },
  { id: 'french', name: 'French Nails', description: 'Kiểu móng French thanh lịch và tinh tế.', duration: 75, price: 250000, image: require('@/assets/images/nails/nail-collection-v2.png') },
  { id: 'extension', name: 'Đắp Móng', description: 'Tạo dáng móng dài tự nhiên, bền chắc.', duration: 90, price: 300000, image: require('@/assets/images/nails/nail-collection-v2.png') },
];

export const getServiceById = (id: string) => services.find((service) => service.id === id);
