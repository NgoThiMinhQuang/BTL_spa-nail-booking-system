import { ServiceCard } from '@/components/home/ServiceCard';
import { fetchServices } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SelectServiceScreen() {
  const [services, setServices] = useState<NailService[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchServices().then(setServices).catch(() => setError('Không thể tải dịch vụ từ máy chủ.'));
  }, []);

  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Chọn dịch vụ</Text>{services.length === 0 && !error && <ActivityIndicator color="#397B76" />}{!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}{services.map((item) => <ServiceCard key={item.id} service={item} bookingMode />)}</ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: 20, gap: 14 }, title: { fontSize: 26, fontWeight: '800' }, error: { backgroundColor: '#F9ECE8', borderRadius: 12, padding: 14 }, errorText: { color: '#7C4A41', textAlign: 'center' } });
