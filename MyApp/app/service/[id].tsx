import { Button } from '@/components/common/Button';
import { getServiceById } from '@/features/service/service.data';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const service = getServiceById(id);
  if (!service) return <View style={styles.container}><Text>Không tìm thấy dịch vụ.</Text></View>;
  return <View style={styles.container}><Image source={service.image} style={styles.image} /><Text style={styles.title}>{service.name}</Text><Text>{service.description}</Text><Text>{service.price.toLocaleString('vi-VN')}đ · {service.duration} phút</Text><Button title="Đặt lịch" onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id } })} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 16 }, image: { width: '100%', height: 230, borderRadius: 18 }, title: { fontSize: 28, fontWeight: '800' } });
