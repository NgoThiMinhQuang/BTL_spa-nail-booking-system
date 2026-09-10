import { fetchStaff } from '@/features/staff/staff.service';
import type { StaffMember } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PALETTE = {
  background: '#FFF9F7',
  surface: '#FFFFFF',
  primary: '#A96370',
  primarySoft: '#F4E4E4',
  sage: '#738A7C',
  sageSoft: '#E8F0EC',
  gold: '#D69A42',
  text: '#30282A',
  muted: '#8A7D80',
  line: '#EFE3E0',
};

const ALL = 'Tất cả';

export default function SelectStaffScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(ALL);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      setStaff(await fetchStaff());
    } catch {
      setError('Không thể tải đội ngũ. Hãy kiểm tra kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch(() => setError('Không thể tải đội ngũ. Hãy kiểm tra kết nối máy chủ.'))
      .finally(() => setLoading(false));
  }, []);

  const eligibleStaff = useMemo(
    () => serviceId ? staff.filter((item) => item.services.some((service) => service.id === serviceId)) : staff,
    [serviceId, staff],
  );

  const categories = useMemo(() => [
    ALL,
    ...Array.from(new Set(eligibleStaff.flatMap((item) =>
      item.services.map((service) => service.categoryName).filter((name): name is string => Boolean(name)),
    ))),
  ], [eligibleStaff]);

  const visibleStaff = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return eligibleStaff.filter((item) => {
      const inCategory = category === ALL || item.services.some((service) => service.categoryName === category);
      const searchable = `${item.name} ${item.specialty ?? ''} ${item.services.map((service) => service.name).join(' ')}`.toLocaleLowerCase('vi');
      return inCategory && (!query || searchable.includes(query));
    });
  }, [category, eligibleStaff, keyword]);

  const selectStaff = (staffId: string) => router.push({
    pathname: '/booking/confirm',
    params: { serviceId: serviceId ?? '', staffId },
  });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={23} color={PALETTE.text} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.title}>Chọn chuyên viên</Text>
          <Text style={styles.subtitle}>Người phù hợp sẽ làm trải nghiệm của bạn trọn vẹn hơn</Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.ornament}><View style={styles.ornamentLine} /><Ionicons name="heart" size={10} color={PALETTE.primary} /><View style={styles.ornamentLine} /></View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={PALETTE.primary} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Tìm tên hoặc chuyên môn..."
            placeholderTextColor="#B2A6A8"
            style={styles.searchInput}
          />
          {!!keyword && <Pressable onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#B6AAAC" /></Pressable>}
        </View>
        <Pressable accessibilityLabel="Bộ lọc" style={styles.filterButton}>
          <Ionicons name="options-outline" size={19} color={PALETTE.primary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((item) => {
          const active = item === category;
          return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, active && styles.categoryActive]}>
            <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item}</Text>
          </Pressable>;
        })}
      </ScrollView>

      {loading && !staff.length ? (
        <View style={styles.center}><ActivityIndicator color={PALETTE.primary} /><Text style={styles.stateText}>Đang tìm chuyên viên phù hợp...</Text></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStaff} tintColor={PALETTE.primary} />}
          contentContainerStyle={styles.list}
        >
          {!!error && <View style={styles.messageBox}><Ionicons name="cloud-offline-outline" size={22} color={PALETTE.primary} /><Text style={styles.messageText}>{error}</Text><Pressable onPress={loadStaff}><Text style={styles.retry}>Thử lại</Text></Pressable></View>}
          {!error && !visibleStaff.length && <View style={styles.empty}><Ionicons name="people-outline" size={34} color={PALETTE.sage} /><Text style={styles.stateText}>Chưa tìm thấy chuyên viên phù hợp.</Text></View>}

          {visibleStaff.map((item, index) => (
            <Pressable key={item.id} onPress={() => selectStaff(item.id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.avatarFrame}>
                {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.initial}>{item.name.charAt(0)}</Text></View>}
                {item.worksToday && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                  {index === 0 && <View style={styles.favoriteBadge}><Ionicons name="ribbon-outline" size={10} color={PALETTE.gold} /><Text style={styles.favoriteText}>Được yêu thích</Text></View>}
                </View>
                <Text numberOfLines={1} style={styles.specialty}>{item.specialty || 'Chuyên viên chăm sóc móng'}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={PALETTE.gold} />
                  <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
                  <Text style={styles.reviews}>({item.reviewCount} đánh giá)</Text>
                </View>
                <View style={styles.detailRow}><Ionicons name="briefcase-outline" size={13} color={PALETTE.sage} /><Text style={styles.detail}>{item.experienceYears} năm kinh nghiệm</Text></View>
                <View style={styles.detailRow}><Ionicons name="sparkles-outline" size={13} color={PALETTE.sage} /><Text numberOfLines={1} style={styles.detail}>{item.services.slice(0, 2).map((service) => service.name).join(' · ') || 'Chăm sóc khách hàng tận tâm'}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8E7F82" />
            </Pressable>
          ))}

          <View style={styles.promise}>
            <Ionicons name="leaf-outline" size={19} color={PALETTE.primary} />
            <Text style={styles.promiseText}>“Vẻ đẹp của bạn là niềm hạnh phúc của chúng tôi”</Text>
            <Text style={styles.promiseBrand}>— Nail House —</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PALETTE.background },
  header: { paddingHorizontal: 14, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, alignItems: 'center' },
  title: { color: PALETTE.text, fontSize: 21, fontWeight: '800' },
  subtitle: { color: PALETTE.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  ornament: { height: 24, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  ornamentLine: { width: 34, height: 1, backgroundColor: '#E7CECE' },
  searchRow: { paddingHorizontal: 14, flexDirection: 'row', gap: 9 },
  searchBox: { flex: 1, height: 43, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.line, backgroundColor: PALETTE.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: PALETTE.text, fontSize: 12, paddingVertical: 0 },
  filterButton: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.line, backgroundColor: PALETTE.surface, alignItems: 'center', justifyContent: 'center' },
  categories: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  category: { height: 34, borderRadius: 12, paddingHorizontal: 15, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.line, alignItems: 'center', justifyContent: 'center' },
  categoryActive: { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary },
  categoryText: { color: '#746669', fontSize: 11, fontWeight: '700' },
  categoryTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 },
  card: { minHeight: 124, borderRadius: 17, padding: 10, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.line, flexDirection: 'row', alignItems: 'center', shadowColor: '#6E4851', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  avatarFrame: { width: 78, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: PALETTE.primarySoft },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: PALETTE.primary, fontSize: 29, fontWeight: '800' },
  onlineDot: { position: 'absolute', right: 6, bottom: 6, width: 11, height: 11, borderRadius: 6, backgroundColor: '#75A46E', borderWidth: 2, borderColor: '#FFFFFF' },
  info: { flex: 1, paddingHorizontal: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: PALETTE.text, fontSize: 14, fontWeight: '800', maxWidth: '58%' },
  favoriteBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFF5DC', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3 },
  favoriteText: { color: '#A66B22', fontSize: 7, fontWeight: '700' },
  specialty: { color: PALETTE.muted, fontSize: 10, marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 7 },
  rating: { color: PALETTE.text, fontSize: 11, fontWeight: '800' },
  reviews: { color: PALETTE.muted, fontSize: 9 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  detail: { flex: 1, color: '#716568', fontSize: 9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: PALETTE.muted, fontSize: 11 },
  empty: { paddingVertical: 70, alignItems: 'center', gap: 10 },
  messageBox: { borderRadius: 14, padding: 14, backgroundColor: PALETTE.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageText: { flex: 1, color: '#7D5159', fontSize: 10 },
  retry: { color: PALETTE.primary, fontSize: 10, fontWeight: '800' },
  promise: { marginTop: 4, borderRadius: 17, paddingVertical: 17, alignItems: 'center', backgroundColor: PALETTE.primarySoft },
  promiseText: { color: '#9A747A', fontSize: 10, fontStyle: 'italic', marginTop: 4 },
  promiseBrand: { color: PALETTE.primary, fontSize: 9, marginTop: 4 },
});
