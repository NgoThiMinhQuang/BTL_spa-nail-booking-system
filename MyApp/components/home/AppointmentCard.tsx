import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

export function AppointmentCard({ service, time }: { service: string; time: string }) {
  return <View style={styles.card}><Image source={require('@/assets/images/nails/nail-collection-v2.png')} style={styles.image} /><View style={styles.content}><Text style={styles.service}>{service}</Text><View style={styles.row}><Ionicons name="calendar-outline" size={13} color="#9A6877" /><Text style={styles.time}>{time}</Text></View><View style={styles.status}><Text style={styles.statusText}>Đã xác nhận</Text></View></View></View>;
}
const styles = StyleSheet.create({ card: { marginHorizontal: 16, padding: 10, backgroundColor: '#FFF', borderRadius: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#F2E4E8' }, image: { width: 74, height: 74, borderRadius: 10 }, content: { flex: 1, justifyContent: 'center' }, service: { color: '#392C30', fontSize: 15, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }, time: { color: '#7C6B71', fontSize: 11 }, status: { marginTop: 7, alignSelf: 'flex-start', backgroundColor: '#E7F4EB', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 }, statusText: { color: '#398251', fontSize: 9, fontWeight: '700' } });
