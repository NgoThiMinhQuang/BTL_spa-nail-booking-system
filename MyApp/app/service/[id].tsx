import { Button } from '@/components/common/Button';
import { fetchServiceById } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<NailService>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchServiceById(id).then(setService).catch(() => setError('Không tìm thấy dịch vụ hoặc máy chủ chưa hoạt động.'));
  }, [id]);

  if (error) return <View style={styles.center}><Text>{error}</Text></View>;
  if (!service) return <View style={styles.center}><ActivityIndicator size="large" color="#397B76" /></View>;
  const imageSource = service.imageUrl ? { uri: service.imageUrl } : require('@/assets/images/nails/nail-collection-v2.png');
  return <View style={styles.container}><Image source={imageSource} style={styles.image} /><Text style={styles.title}>{service.name}</Text><Text>{service.description}</Text><Text>{service.price.toLocaleString('vi-VN')}đ · {service.duration} phút</Text><Button title="Đặt lịch" onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id } })} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, image: { width: '100%', height: 230, borderRadius: 18 }, title: { fontSize: 28, fontWeight: '800' } });
