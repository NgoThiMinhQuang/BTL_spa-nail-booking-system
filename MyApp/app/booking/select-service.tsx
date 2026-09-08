import { ServiceCard } from '@/components/home/ServiceCard';
import { services } from '@/features/service/service.data';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function SelectServiceScreen() {
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Chọn dịch vụ</Text>{services.map((item) => <ServiceCard key={item.id} service={item} bookingMode />)}</ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: 20, gap: 14 }, title: { fontSize: 26, fontWeight: '800' } });
