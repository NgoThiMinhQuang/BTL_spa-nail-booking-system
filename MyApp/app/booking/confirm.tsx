import { Button } from '@/components/common/Button';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function ConfirmBookingScreen() {
  const { serviceId, staffId } = useLocalSearchParams<{ serviceId: string; staffId: string }>();
  const confirm = () => Alert.alert('Thành công', 'Lịch hẹn đã được xác nhận.', [{ text: 'OK', onPress: () => router.replace('/bookings') }]);
  return <View style={styles.container}><Text style={styles.title}>Xác nhận lịch hẹn</Text><Text>Dịch vụ: {serviceId}</Text><Text>Nhân viên: {staffId}</Text><Text>Thời gian: 09:00 · 12/09/2026</Text><Button title="Xác nhận đặt lịch" onPress={confirm} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 18 }, title: { fontSize: 26, fontWeight: '800' } });
