import { fetchHomeData } from '@/features/home/home.service';
import type { NailDesign } from '@/features/home/home.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background: '#FFF9FA', surface: '#FFF', pink: '#D56B81', pinkSoft: '#FBE8ED', green: '#397B76', text: '#30282B', muted: '#897D80', line: '#F0E5E8' };

function FavoriteCard({ design, onRemove }: { design: NailDesign; onRemove: () => void }) {
  return <View style={styles.card}>
    <ImageBackground source={{ uri: design.imageUrl }} imageStyle={styles.cardImage} style={styles.imageArea}>
      <View style={styles.trendingBadge}><Ionicons name="sparkles" size={12} color="#FFF" /><Text style={styles.trendingText}>YÊU THÍCH</Text></View>
      <Pressable accessibilityLabel="Bỏ yêu thích" hitSlop={8} onPress={onRemove} style={styles.heartButton}><Ionicons name="heart" size={21} color={COLORS.pink} /></Pressable>
    </ImageBackground>
    <View style={styles.cardContent}>
      <Text numberOfLines={1} style={styles.designName}>{design.name}</Text>
      <View style={styles.cardMeta}><View style={styles.colorDots}><View style={[styles.dot, { backgroundColor: '#E8B9C2' }]} /><View style={[styles.dot, { backgroundColor: '#F4E4D7' }]} /><View style={[styles.dot, { backgroundColor: '#C98DA0' }]} /></View><Ionicons name="chevron-forward" size={17} color="#AA9DA0" /></View>
    </View>
  </View>;
}

export default function FavoritesScreen() {
  const [designs, setDesigns] = useState<NailDesign[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const applyData = useCallback((items: NailDesign[]) => {
    setDesigns(items);
    setFavoriteIds((current) => current.length ? current.filter((id) => items.some((item) => item.id === id)) : items.map((item) => item.id));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { const home = await fetchHomeData(); applyData(home.trendingDesigns); setError(''); }
    catch { setError('Không thể tải các mẫu nail yêu thích.'); }
    finally { setRefreshing(false); }
  }, [applyData]);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchHomeData()
      .then((home) => { if (active) { applyData(home.trendingDesigns); setError(''); } })
      .catch(() => { if (active) setError('Không thể tải các mẫu nail yêu thích.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyData]));

  const favorites = useMemo(() => designs.filter((item) => favoriteIds.includes(item.id) && item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))), [designs, favoriteIds, query]);
  const removeFavorite = (id: string) => setFavoriteIds((current) => current.filter((item) => item !== id));

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.pink} />} contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>BỘ SƯU TẬP CỦA BẠN</Text><Text style={styles.title}>Mẫu nail yêu thích</Text></View><View style={styles.headerHeart}><Ionicons name="heart" size={24} color={COLORS.pink} /></View></View>

      <View style={styles.summary}>
        <View style={styles.summaryIcon}><Ionicons name="sparkles-outline" size={22} color={COLORS.green} /></View>
        <View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{favoriteIds.length} mẫu đã lưu</Text><Text style={styles.summaryText}>Nguồn cảm hứng cho bộ móng tiếp theo</Text></View>
        <Pressable onPress={() => router.push('/services')}><Text style={styles.explore}>Khám phá</Text></Pressable>
      </View>

      <View style={styles.searchBox}><Ionicons name="search" size={21} color="#94878B" /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm trong bộ sưu tập..." placeholderTextColor="#A99DA0" style={styles.searchInput} />{!!query && <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color="#B8ABAE" /></Pressable>}</View>

      {loading && <View style={styles.state}><ActivityIndicator size="large" color={COLORS.pink} /><Text style={styles.stateText}>Đang tải bộ sưu tập...</Text></View>}
      {!loading && !!error && <View style={styles.state}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={34} color={COLORS.pink} /></View><Text style={styles.stateTitle}>Chưa thể tải dữ liệu</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable></View>}
      {!loading && !error && favorites.length === 0 && <View style={styles.state}><View style={styles.stateIcon}><Ionicons name="heart-outline" size={37} color={COLORS.pink} /></View><Text style={styles.stateTitle}>{query ? 'Không tìm thấy mẫu nail' : 'Chưa có mẫu yêu thích'}</Text><Text style={styles.stateText}>{query ? 'Hãy thử tìm bằng tên khác nhé.' : 'Lưu những mẫu nail bạn thích để xem lại tại đây.'}</Text><Pressable onPress={() => query ? setQuery('') : router.push('/services')} style={styles.bookButton}><Text style={styles.bookText}>{query ? 'Xóa tìm kiếm' : 'Khám phá mẫu nail'}</Text></Pressable></View>}

      {!loading && !error && favorites.length > 0 && <><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Bộ sưu tập</Text><Text style={styles.resultCount}>{favorites.length} mẫu</Text></View><View style={styles.grid}>{favorites.map((design) => <FavoriteCard key={design.id} design={design} onRemove={() => removeFavorite(design.id)} />)}</View></>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36 },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: COLORS.green, fontSize: 12, letterSpacing: 1.1, fontWeight: '800' }, title: { color: COLORS.text, fontSize: 27, fontWeight: '800', marginTop: 4 }, headerHeart: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.pinkSoft, alignItems: 'center', justifyContent: 'center' },
  summary: { minHeight: 76, marginTop: 13, paddingHorizontal: 13, borderRadius: 18, backgroundColor: '#E7F2EF', flexDirection: 'row', alignItems: 'center', gap: 11 }, summaryIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, summaryCopy: { flex: 1 }, summaryTitle: { color: '#355F5A', fontSize: 15, fontWeight: '800' }, summaryText: { color: '#718A86', fontSize: 13, marginTop: 3 }, explore: { color: COLORS.pink, fontSize: 14, fontWeight: '800' },
  searchBox: { height: 50, marginTop: 16, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  sectionHeading: { marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: '800' }, resultCount: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }, card: { width: '48%', borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden', shadowColor: '#865763', shadowOpacity: .07, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, imageArea: { width: '100%', aspectRatio: 1.05 }, cardImage: { resizeMode: 'cover' }, trendingBadge: { position: 'absolute', left: 8, top: 8, height: 25, paddingHorizontal: 8, borderRadius: 9, backgroundColor: 'rgba(57,123,118,.88)', flexDirection: 'row', alignItems: 'center', gap: 4 }, trendingText: { color: '#FFF', fontSize: 11, fontWeight: '900' }, heartButton: { position: 'absolute', right: 8, top: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.93)', alignItems: 'center', justifyContent: 'center' },
  cardContent: { padding: 12 }, designName: { color: COLORS.text, fontSize: 15, fontWeight: '800' }, cardMeta: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, colorDots: { flexDirection: 'row' }, dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#FFF', marginRight: -3 },
  state: { minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, stateIcon: { width: 72, height: 72, borderRadius: 25, backgroundColor: COLORS.pinkSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, stateTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' }, stateText: { color: COLORS.muted, fontSize: 14, lineHeight: 24, textAlign: 'center', marginTop: 7 }, retryButton: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 20, backgroundColor: COLORS.pinkSoft }, retryText: { color: COLORS.pink, fontSize: 14, fontWeight: '800' }, bookButton: { height: 44, marginTop: 18, paddingHorizontal: 22, borderRadius: 22, backgroundColor: COLORS.pink, alignItems: 'center', justifyContent: 'center' }, bookText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
