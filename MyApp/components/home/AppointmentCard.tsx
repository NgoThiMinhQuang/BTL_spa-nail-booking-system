import type { UpcomingAppointment } from '@/features/home/home.types';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

const statusLabels: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận' };

export function AppointmentCard({ appointment }: { appointment: UpcomingAppointment }) {
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(appointment.startsAt));
  return <View style={styles.card}>{appointment.imageUrl ? <Image source={{ uri: appointment.imageUrl }} style={styles.image} /> : <View style={styles.placeholder}><Ionicons name="calendar" size={28} color="#9A6877" /></View>}<View style={styles.content}><Text style={styles.service}>{appointment.serviceName}</Text>{appointment.staffName && <Text style={styles.staff}>Nghệ nhân: {appointment.staffName}</Text>}<View style={styles.row}><Ionicons name="calendar-outline" size={13} color="#9A6877" /><Text style={styles.time}>{time}</Text></View><View style={styles.status}><Text style={styles.statusText}>{statusLabels[appointment.status] ?? appointment.status}</Text></View></View></View>;
}
const styles = StyleSheet.create({ card: { marginHorizontal: 16, padding: 10, backgroundColor: '#FFF', borderRadius: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#F2E4E8' }, image: { width: 74, height: 74, borderRadius: 10 }, placeholder: { width: 74, height: 74, borderRadius: 10, backgroundColor: '#F6E9ED', alignItems: 'center', justifyContent: 'center' }, content: { flex: 1, justifyContent: 'center' }, service: { color: '#392C30', fontSize: 15, fontWeight: '800' }, staff: { color: '#796A6F', fontSize: 10, marginTop: 3 }, row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }, time: { flex: 1, color: '#7C6B71', fontSize: 10 }, status: { marginTop: 7, alignSelf: 'flex-start', backgroundColor: '#E7F4EB', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 }, statusText: { color: '#398251', fontSize: 9, fontWeight: '700' } });
