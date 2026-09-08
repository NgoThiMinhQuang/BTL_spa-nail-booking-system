import { ServiceCard } from '@/components/home/ServiceCard';
import { services } from '@/features/service/service.data';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function ServicesScreen() {
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Dịch vụ</Text>{services.map((item) => <ServiceCard key={item.id} service={item} />)}</ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: 20, gap: 14, backgroundColor: '#FFF8FB', flexGrow: 1 }, title: { fontSize: 28, fontWeight: '800' } });
