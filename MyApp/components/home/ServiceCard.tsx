import { NailService } from '@/features/service/service.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export function ServiceCard({ service, bookingMode = false, compact = false }: { service: NailService; bookingMode?: boolean; compact?: boolean }) {
  const open = () => bookingMode ? router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id } }) : router.push({ pathname: '/service/[id]', params: { id: service.id } });
  return <Pressable onPress={open} style={[styles.card, compact && styles.compact]}><View><Image source={service.image} style={[styles.image, compact && styles.compactImage]} /><View style={styles.heart}><Ionicons name="heart-outline" size={18} color="#FFF" /></View></View><View style={styles.info}><Text numberOfLines={1} style={styles.name}>{service.name}</Text><Text style={styles.price}>{service.price.toLocaleString('vi-VN')}đ</Text><View style={styles.meta}><Ionicons name="time-outline" size={11} color="#84767B" /><Text style={styles.duration}>{service.duration} phút</Text></View></View></Pressable>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F3E7E9', shadowColor: '#7A4857', shadowOpacity: .06, shadowRadius: 7, elevation: 2 }, compact: { width: 115 }, image: { width: '100%', height: 130 }, compactImage: { height: 102 }, heart: { position: 'absolute', top: 6, right: 6 }, info: { padding: 8 }, name: { fontSize: 12, fontWeight: '700', color: '#372B2F' }, price: { color: '#C54D72', fontSize: 12, fontWeight: '800', marginTop: 3 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }, duration: { color: '#84767B', fontSize: 9 } });
