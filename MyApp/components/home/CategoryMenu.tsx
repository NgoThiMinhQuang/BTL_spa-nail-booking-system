import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const items: { label: string; note: string; icon: IconName; color: string; bg: string; route: '/services' | '/booking/select-service' | '/booking/select-staff' | '/modal' }[] = [
  { label: 'Dịch vụ', note: 'Khám phá mẫu nail', icon: 'bottle-tonic', color: '#D46887', bg: '#FBE8ED', route: '/services' as const },
  { label: 'Đặt lịch', note: 'Đặt lịch nhanh chóng', icon: 'calendar-month', color: '#B6813A', bg: '#F8EEDC', route: '/booking/select-service' as const },
  { label: 'Nhân viên', note: 'Đội ngũ chuyên nghiệp', icon: 'account', color: '#A76294', bg: '#F2E5F1', route: '/booking/select-staff' as const },
  { label: 'Ưu đãi', note: 'Khuyến mãi hấp dẫn', icon: 'sale', color: '#78845C', bg: '#E9EDD8', route: '/modal' as const },
];

export function CategoryMenu() {
  return <View style={styles.row}>{items.map((item) => <Pressable key={item.label} style={styles.item} onPress={() => router.push(item.route)}><View style={[styles.icon, { backgroundColor: item.bg }]}><MaterialCommunityIcons name={item.icon} size={27} color={item.color} /></View><Text style={styles.label}>{item.label}</Text><Text numberOfLines={1} style={styles.note}>{item.note}</Text></Pressable>)}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 14 }, item: { flex: 1, alignItems: 'center' }, icon: { width: 51, height: 51, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, label: { color: '#352B2E', fontSize: 12, fontWeight: '800' }, note: { color: '#8D7B81', fontSize: 8, marginTop: 2, maxWidth: 78 } });
