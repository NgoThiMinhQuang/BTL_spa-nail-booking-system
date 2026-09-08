import { fetchServices } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CategoryId = 'all' | 'gel' | 'art' | 'extension';

const categories: { id: CategoryId; label: string; icon: 'infinity' | 'bottle-tonic' | 'brush' | 'diamond-stone' }[] = [
  { id: 'all', label: 'Tất cả', icon: 'infinity' },
  { id: 'gel', label: 'Sơn Gel', icon: 'bottle-tonic' },
  { id: 'art', label: 'Nail Art', icon: 'brush' },
  { id: 'extension', label: 'Đắp móng', icon: 'diamond-stone' },
];

const cardMeta: Record<string, { eyebrow: string; rating: string; reviews: number; color: string; softColor: string; badge?: string }> = {
  gel: { eyebrow: 'XU HƯỚNG HÀN QUỐC', rating: '4.9', reviews: 420, color: '#B85270', softColor: '#FBE8ED', badge: 'Best Seller' },
  art: { eyebrow: 'BOUTIQUE ART', rating: '5.0', reviews: 215, color: '#397B76', softColor: '#E3F1EF', badge: 'Yêu thích' },
  french: { eyebrow: 'THANH LỊCH', rating: '4.9', reviews: 186, color: '#7D6599', softColor: '#EEE8F5' },
  extension: { eyebrow: 'FORM CHUẨN', rating: '4.8', reviews: 180, color: '#A87932', softColor: '#F6EEDC' },
};

function ServiceItem({ service }: { service: NailService }) {
  const meta = cardMeta[service.id] ?? cardMeta.gel;
  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={styles.cardMain}>
        <View>
          <Image source={service.imageUrl ? { uri: service.imageUrl } : require('@/assets/images/nails/nail-collection-v2.png')} style={styles.serviceImage} />
          {meta.badge && <View style={[styles.imageBadge, { backgroundColor: meta.color }]}><Text style={styles.imageBadgeText}>{meta.badge}</Text></View>}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.eyebrow, { color: meta.color }]}>{meta.eyebrow}</Text>
            <View style={styles.ratingRow}><Ionicons name="star" size={12} color="#E5A62B" /><Text style={styles.rating}>{meta.rating}</Text><Text style={styles.reviews}>({meta.reviews})</Text></View>
          </View>
          <Text numberOfLines={1} style={styles.serviceName}>{service.name}</Text>
          <Text numberOfLines={2} style={styles.description}>{service.description}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: meta.color }]}>{service.price.toLocaleString('vi-VN')}đ</Text>
            <View style={styles.duration}><Ionicons name="time-outline" size={14} color="#7D7477" /><Text style={styles.durationText}>{service.duration} phút</Text></View>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push({ pathname: '/service/[id]', params: { id: service.id } })} style={[styles.secondaryButton, { backgroundColor: meta.softColor }]}>
          <Ionicons name="eye-outline" size={15} color={meta.color} /><Text style={[styles.secondaryText, { color: meta.color }]}>Xem chi tiết</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id } })} style={[styles.primaryButton, { backgroundColor: meta.color }]}>
          <Ionicons name="add-circle-outline" size={16} color="#FFF" /><Text style={styles.primaryText}>Chọn dịch vụ</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ServicesScreen() {
  const [services, setServices] = useState<NailService[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadServices = async () => {
    try {
      setError('');
      setServices(await fetchServices());
    } catch {
      setError('Không thể kết nối máy chủ. Hãy kiểm tra backend và địa chỉ API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices()
      .then((data) => { setServices(data); setError(''); })
      .catch(() => setError('Không thể kết nối máy chủ. Hãy kiểm tra backend và địa chỉ API.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredServices = useMemo(() => services.filter((service) => {
    const matchesSearch = `${service.name} ${service.description}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
    const categoryText = service.categoryName?.toLocaleLowerCase('vi') ?? '';
    const matchesCategory = category === 'all'
      || (category === 'gel' && categoryText.includes('gel'))
      || (category === 'art' && categoryText.includes('art'))
      || (category === 'extension' && (categoryText.includes('đắp') || categoryText.includes('móng')));
    return matchesSearch && matchesCategory;
  }), [category, query, services]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadServices} tintColor="#397B76" />} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}><Ionicons name="flower-outline" size={21} color="#B85270" /><Text style={styles.brand}>Nail<Text style={styles.brandAccent}>House</Text></Text></View>
            <View style={styles.locationRow}><Ionicons name="location-outline" size={12} color="#557A75" /><Text style={styles.location}>DIAMOND PLAZA, Q.1</Text></View>
          </View>
          <View style={styles.headerActions}><View><Ionicons name="notifications-outline" size={23} color="#30272A" /><View style={styles.notificationDot} /></View><View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View></View>
        </View>

        <View style={styles.intro}>
          <View><Text style={styles.kicker}>HAUTE BEAUTÉ</Text><Text style={styles.title}>Dịch vụ Nail</Text></View>
          <View style={styles.designCount}><MaterialCommunityIcons name="flower-tulip-outline" size={15} color="#B85270" /><Text style={styles.designCountText}>52 mẫu thiết kế</Text></View>
        </View>

        <View style={styles.filtersArea}>
          <View style={styles.searchBox}><Ionicons name="search" size={20} color="#81787B" /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm dịch vụ sơn, vẽ móng, dưỡng da tay..." placeholderTextColor="#A49A9D" style={styles.input} returnKeyType="search" /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            {categories.map((item) => {
              const active = category === item.id;
              return <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.category, active && styles.activeCategory]}><MaterialCommunityIcons name={item.icon} size={17} color={active ? '#FFF' : '#665D60'} /><Text style={[styles.categoryText, active && styles.activeCategoryText]}>{item.label}</Text></Pressable>;
            })}
          </ScrollView>
        </View>

        <View style={styles.serviceList}>
          {loading && services.length === 0 && <View style={styles.empty}><ActivityIndicator size="large" color="#397B76" /><Text style={styles.emptyText}>Đang tải dịch vụ...</Text></View>}
          {!!error && <View style={styles.errorBox}><Ionicons name="cloud-offline-outline" size={26} color="#A85B4F" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={loadServices}><Text style={styles.retryText}>Thử lại</Text></Pressable></View>}
          {filteredServices.map((service) => <ServiceItem key={service.id} service={service} />)}
          {!loading && !error && filteredServices.length === 0 && <View style={styles.empty}><Ionicons name="search-outline" size={34} color="#79938E" /><Text style={styles.emptyTitle}>Không tìm thấy dịch vụ</Text><Text style={styles.emptyText}>Thử từ khóa hoặc danh mục khác nhé.</Text></View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBFAF6' }, container: { paddingBottom: 28 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, brand: { color: '#333033', fontSize: 20, fontWeight: '700' }, brandAccent: { color: '#B85270' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, marginLeft: 26 }, location: { color: '#697775', fontSize: 8, letterSpacing: .55, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' }, notificationDot: { position: 'absolute', right: 1, top: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: '#D34E6E' },
  avatar: { width: 37, height: 37, borderRadius: 19, backgroundColor: '#DCEBE8', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#397B76', fontSize: 15, fontWeight: '800' },
  intro: { paddingHorizontal: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, kicker: { color: '#708D86', fontSize: 9, letterSpacing: 1.1, fontWeight: '800' }, title: { color: '#30282B', fontSize: 28, fontWeight: '800', marginTop: 3 },
  designCount: { backgroundColor: '#F7E9ED', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 }, designCountText: { color: '#A04763', fontSize: 10, fontWeight: '700' },
  filtersArea: { backgroundColor: '#FBFAF6', paddingBottom: 12 }, searchBox: { marginHorizontal: 18, height: 45, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5DF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, input: { flex: 1, color: '#332D2F', fontSize: 12 },
  categoryList: { paddingHorizontal: 18, paddingTop: 12, gap: 8 }, category: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: '#F0EEE8', flexDirection: 'row', alignItems: 'center', gap: 6 }, activeCategory: { backgroundColor: '#B85270' }, categoryText: { color: '#665D60', fontSize: 11, fontWeight: '700' }, activeCategoryText: { color: '#FFF' },
  serviceList: { paddingHorizontal: 16, gap: 14 }, card: { backgroundColor: '#FFF', borderRadius: 20, padding: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: '#EFEAE5' }, cardMain: { flexDirection: 'row', gap: 12 }, serviceImage: { width: 105, height: 105, borderRadius: 14 }, imageBadge: { position: 'absolute', left: 6, top: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 }, imageBadgeText: { color: '#FFF', fontSize: 7, fontWeight: '800' },
  cardContent: { flex: 1, paddingTop: 2 }, cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { maxWidth: '55%', fontSize: 8, letterSpacing: .55, fontWeight: '800' }, ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 }, rating: { color: '#4C4346', fontSize: 10, fontWeight: '700' }, reviews: { color: '#998F92', fontSize: 9 },
  serviceName: { color: '#30272A', fontSize: 18, fontWeight: '800', marginTop: 8 }, description: { color: '#82777A', fontSize: 10, lineHeight: 15, marginTop: 4 }, priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }, price: { fontSize: 17, fontWeight: '800' }, duration: { flexDirection: 'row', alignItems: 'center', gap: 3 }, durationText: { color: '#7D7477', fontSize: 9 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 12 }, secondaryButton: { flex: .85, height: 38, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, secondaryText: { fontSize: 10, fontWeight: '700' }, primaryButton: { flex: 1.15, height: 38, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, primaryText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 48 }, emptyTitle: { color: '#3D3437', fontSize: 16, fontWeight: '800', marginTop: 9 }, emptyText: { color: '#867C7F', fontSize: 11, marginTop: 4 },
  errorBox: { marginTop: 8, borderRadius: 16, padding: 18, alignItems: 'center', gap: 7, backgroundColor: '#F9ECE8' }, errorText: { color: '#7C4A41', fontSize: 11, textAlign: 'center', lineHeight: 17 }, retryText: { color: '#397B76', fontWeight: '800', fontSize: 12, marginTop: 3 },
});
