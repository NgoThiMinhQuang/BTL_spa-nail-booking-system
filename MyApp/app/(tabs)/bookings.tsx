import { AppointmentCard } from '@/components/home/AppointmentCard';
import { StyleSheet, Text, View } from 'react-native';

export default function BookingsScreen() {
  return <View style={styles.container}><Text style={styles.title}>Lịch hẹn của bạn</Text><AppointmentCard service="Sơn gel" time="09:00 · 12/09/2026" /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 18, backgroundColor: '#FFF8FB' }, title: { fontSize: 28, fontWeight: '800' } });
