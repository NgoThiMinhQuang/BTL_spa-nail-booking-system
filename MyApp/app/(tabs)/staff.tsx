import { fetchStaff } from '@/features/staff/staff.service';
import type { StaffMember } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ALL = 'Tất cả';
const COLORS = {
  ink: '#2D2630',
  muted: '#756A73',
  primary: '#D95778',
  primaryDark: '#B93E62',
  blush: '#FFF0F3',
  cream: '#FFF9F1',
  sage: '#4E7D74',
  sageSoft: '#E8F3EF',
  lavender: '#765E8B',
  lavenderSoft: '#F1EBF7',
  gold: '#E9A72D',
  goldSoft: '#FFF1D5',
  white: '#FFFFFF',
  line: '#F0DFE3',
};

const cardTints = [
  { background: '#FFF7F8', border: '#F5DDE3', chip: '#FBE7EC', accent: COLORS.primary },
  { background: '#F6FBF9', border: '#DDECE7', chip: '#E2F1EC', accent: COLORS.sage },
  { background: '#FAF7FC', border: '#E9E0EF', chip: '#EEE7F5', accent: COLORS.lavender },
  { background: '#FFFBF3', border: '#F3E7CB', chip: '#F9EDD2', accent: '#9B6D1D' },
];

export default function StaffScreen() {
  const { width } = useWindowDimensions();
  const twoColumns = width >= 370;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(ALL);
  const [keyword, setKeyword] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      setStaff(await fetchStaff());
    } catch {
      setError('Không tải được danh sách nhân viên từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff()
      .then(setStaff)
      .catch(() => setError('Không tải được danh sách nhân viên từ máy chủ.'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => [
    ALL,
    ...Array.from(new Set(staff.flatMap((item) => item.services
      .map((service) => service.categoryName)
      .filter((name): name is string => Boolean(name))))),
  ], [staff]);

  const visibleStaff = useMemo(() => staff.filter((item) => {
    const matchesCategory = category === ALL || item.services.some((service) => service.categoryName === category);
    const query = keyword.trim().toLocaleLowerCase('vi');
    const searchable = `${item.name} ${item.specialty ?? ''} ${item.services.map((service) => service.name).join(' ')}`.toLocaleLowerCase('vi');
    return matchesCategory && (!query || searchable.includes(query));
  }), [category, keyword, staff]);

  const favorite = (id: string) => setFavorites((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}>
        <ImageBackground
          source={require('@/assets/images/banner/nail-banner-v2.png')}
          imageStyle={styles.heroImage}
          style={styles.hero}>
          <View style={styles.heroWash} />
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.roundButton}>
              <Ionicons name="chevron-back" size={21} color={COLORS.primaryDark} />
            </Pressable>
            <View style={styles.brand}>
              <View style={styles.brandMark}><Ionicons name="flower-outline" size={16} color={COLORS.primary} /></View>
              <View><Text style={styles.brandName}>Nail<Text style={styles.brandAccent}>House</Text></Text><Text style={styles.brandNote}>Đẹp hơn mỗi ngày</Text></View>
            </View>
            <Pressable hitSlop={10} style={styles.roundButton} onPress={() => setKeyword('')}>
              <Ionicons name="heart" size={19} color={COLORS.primary} />
            </Pressable>
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.eyebrow}><View style={styles.eyebrowDot} /><Text style={styles.eyebrowText}>ĐỘI NGŨ NAILHOUSE</Text></View>
            <Text style={styles.title}>Nhân viên</Text>
            <Text style={styles.subtitle}>Kỹ thuật viên tận tâm, giàu kinh nghiệm{`\n`}cho đôi tay đẹp theo cách riêng của bạn.</Text>
          </View>
        </ImageBackground>

        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={COLORS.lavender} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Tìm tên, kỹ năng hoặc dịch vụ..."
              placeholderTextColor="#A297A0"
              style={styles.searchInput}
            />
            {!!keyword && <Pressable onPress={() => setKeyword('')} hitSlop={8}><Ionicons name="close-circle" size={17} color="#B6AAB2" /></Pressable>}
          </View>
          <Pressable onPress={() => { setCategory(ALL); setKeyword(''); }} style={styles.filterButton}>
            <Ionicons name="options-outline" size={20} color={COLORS.sage} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((item, index) => {
            const active = category === item;
            const tint = cardTints[index % cardTints.length];
            return <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, { backgroundColor: tint.chip, borderColor: tint.border }, active && styles.filterActive]}>
              <Text numberOfLines={1} style={[styles.filterText, { color: tint.accent }, active && styles.filterTextActive]}>{item}</Text>
            </Pressable>;
          })}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>Gặp gỡ đội ngũ</Text><Text style={styles.resultText}>{visibleStaff.length} chuyên viên phù hợp</Text></View>
          <View style={styles.availablePill}><View style={styles.onlineDot} /><Text style={styles.availableText}>Có lịch hôm nay</Text></View>
        </View>

        {loading && !staff.length ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.stateText}>Đang tải đội ngũ...</Text></View>
        ) : (
          <View style={styles.grid}>
            {!!error && <View style={styles.errorBox}><Ionicons name="cloud-offline-outline" size={20} color="#B16A59" /><Text style={styles.errorText}>{error}</Text></View>}
            {!visibleStaff.length && !error && <View style={styles.emptyBox}><Ionicons name="people-outline" size={32} color={COLORS.sage} /><Text style={styles.stateText}>Chưa có nhân viên phù hợp.</Text></View>}
            {visibleStaff.map((item, index) => {
              const tint = cardTints[index % cardTints.length];
              const isFavorite = favorites.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push({ pathname: '/staff/[id]', params: { id: item.id } })}
                  style={({ pressed }) => [styles.card, twoColumns && styles.cardTwoColumns, { backgroundColor: tint.background, borderColor: tint.border }, pressed && styles.cardPressed]}>
                  <View style={styles.photoWrap}>
                    {item.avatarUrl
                      ? <Image source={{ uri: item.avatarUrl }} style={styles.photo} />
                      : <View style={[styles.photo, styles.photoFallback, { backgroundColor: tint.chip }]}><Text style={[styles.photoInitial, { color: tint.accent }]}>{item.name.charAt(0)}</Text></View>}
                    <View style={styles.photoShade} />
                    {item.worksToday && <View style={styles.workBadge}><View style={styles.onlineDot} /><Text style={styles.workBadgeText}>Đang nhận lịch</Text></View>}
                    {index === 0 && <View style={styles.lovedBadge}><Ionicons name="sparkles" size={11} color="#FFF" /><Text style={styles.lovedText}>Được yêu thích</Text></View>}
                    <Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); favorite(item.id); }} style={styles.favoriteButton}>
                      <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={19} color={isFavorite ? COLORS.primary : COLORS.lavender} />
                    </Pressable>
                  </View>
                  <View style={styles.cardBody}>
                    <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                    <Text numberOfLines={1} style={[styles.role, { color: tint.accent }]}>{item.specialty || 'Kỹ thuật viên NailHouse'}</Text>
                    <View style={styles.metaRow}><Ionicons name="star" size={14} color={COLORS.gold} /><Text style={styles.rating}>{item.rating.toFixed(1)}</Text><Text style={styles.reviewCount}>({item.reviewCount} đánh giá)</Text></View>
                    <View style={styles.metaRow}><Ionicons name="ribbon-outline" size={14} color={COLORS.sage} /><Text style={styles.experience}>{item.experienceYears} năm kinh nghiệm</Text></View>
                    <View style={styles.tags}>{item.services.slice(0, 2).map((service) => <View key={service.id} style={[styles.tag, { backgroundColor: tint.chip }]}><Text numberOfLines={1} style={[styles.tagText, { color: tint.accent }]}>{service.name}</Text></View>)}</View>
                    <View style={[styles.detailButton, { backgroundColor: tint.accent }]}><Text style={styles.detailText}>Xem hồ sơ</Text><Ionicons name="arrow-forward" size={14} color="#FFF" /></View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.suggestion}>
          <View style={styles.suggestionIcon}><Ionicons name="people" size={23} color={COLORS.lavender} /></View>
          <View style={styles.suggestionCopy}><Text style={styles.suggestionTitle}>Chưa biết chọn ai?</Text><Text style={styles.suggestionText}>Để chúng tôi gợi ý chuyên viên phù hợp.</Text></View>
          <Pressable onPress={() => router.push('/booking/select-service')} style={styles.suggestionButton}><Text style={styles.suggestionButtonText}>Gợi ý</Text><Ionicons name="arrow-forward" size={14} color="#FFF" /></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cream },
  page: { paddingBottom: 34 },
  hero: { height: 236, paddingHorizontal: 16, overflow: 'hidden', backgroundColor: COLORS.blush },
  heroImage: { resizeMode: 'cover', opacity: 0.58 },
  heroWash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,249,247,0.36)' },
  topBar: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandMark: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#FFF0F3', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: COLORS.ink, fontSize: 18, fontWeight: '800', fontFamily: 'serif' },
  brandAccent: { color: COLORS.primary },
  brandNote: { color: COLORS.muted, fontSize: 7, marginTop: -1 },
  heroCopy: { flex: 1, justifyContent: 'center', paddingBottom: 24 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowDot: { width: 18, height: 3, borderRadius: 2, backgroundColor: COLORS.gold },
  eyebrowText: { color: COLORS.primaryDark, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 7, color: COLORS.ink, fontSize: 34, lineHeight: 39, fontWeight: '800', fontFamily: 'serif' },
  subtitle: { marginTop: 5, color: '#635962', fontSize: 11, lineHeight: 17 },
  searchWrap: { marginTop: -22, marginHorizontal: 15, height: 48, padding: 4, borderRadius: 24, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#8A5363', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.12, shadowRadius: 15, elevation: 5 },
  searchBox: { flex: 1, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F8F4F5', flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 11 },
  filterButton: { width: 40, height: 40, borderRadius: 20, marginLeft: 4, backgroundColor: COLORS.sageSoft, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 8, gap: 8 },
  filter: { height: 34, maxWidth: 145, paddingHorizontal: 15, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#FFF' },
  sectionHeading: { marginTop: 11, marginBottom: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' },
  resultText: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  availablePill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, backgroundColor: COLORS.sageSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#61A16F' },
  availableText: { color: COLORS.sage, fontSize: 8, fontWeight: '700' },
  grid: { paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '100%', borderRadius: 18, overflow: 'hidden', borderWidth: 1, shadowColor: '#553D45', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  cardTwoColumns: { width: '48.5%' },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  photoWrap: { height: 142, backgroundColor: '#F0E7E6' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 42, fontWeight: '800' },
  photoShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, backgroundColor: 'rgba(45,38,48,0.08)' },
  favoriteButton: { position: 'absolute', top: 9, right: 9, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  workBadge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.93)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  workBadgeText: { color: COLORS.sage, fontSize: 7, fontWeight: '800' },
  lovedBadge: { position: 'absolute', left: 8, top: 9, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 10, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 3 },
  lovedText: { color: '#FFF', fontSize: 7, fontWeight: '800' },
  cardBody: { padding: 11 },
  name: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  role: { marginTop: 2, fontSize: 8, fontWeight: '700' },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  rating: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  reviewCount: { color: COLORS.muted, fontSize: 7 },
  experience: { color: COLORS.muted, fontSize: 8 },
  tags: { height: 24, marginTop: 8, flexDirection: 'row', gap: 4, overflow: 'hidden' },
  tag: { maxWidth: '49%', height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  tagText: { fontSize: 7, fontWeight: '700' },
  detailButton: { height: 34, marginTop: 9, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  detailText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  center: { height: 230, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateText: { color: COLORS.muted, fontSize: 10 },
  emptyBox: { width: '100%', paddingVertical: 55, alignItems: 'center', gap: 8 },
  errorBox: { width: '100%', padding: 12, borderRadius: 14, backgroundColor: '#FFF0E8', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#8B584D', fontSize: 9 },
  suggestion: { marginHorizontal: 14, marginTop: 16, padding: 12, borderRadius: 18, backgroundColor: COLORS.lavenderSoft, borderWidth: 1, borderColor: '#E8DDF0', flexDirection: 'row', alignItems: 'center' },
  suggestionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  suggestionCopy: { flex: 1, paddingHorizontal: 9 },
  suggestionTitle: { color: COLORS.lavender, fontSize: 11, fontWeight: '800' },
  suggestionText: { color: COLORS.muted, fontSize: 7, marginTop: 2 },
  suggestionButton: { height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: COLORS.lavender, flexDirection: 'row', alignItems: 'center', gap: 5 },
  suggestionButtonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
