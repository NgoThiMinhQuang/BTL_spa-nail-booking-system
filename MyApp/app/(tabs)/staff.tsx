import { fetchStaff } from '@/features/staff/staff.service';
import type { StaffMember } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ALL = 'Tất cả';

export default function StaffScreen() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(ALL);
  const [searchVisible, setSearchVisible] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const load = async () => { setLoading(true); try { setError(''); setStaff(await fetchStaff()); } catch { setError('Không tải được danh sách nhân viên từ máy chủ.'); } finally { setLoading(false); } };
  useEffect(() => { fetchStaff().then(setStaff).catch(() => setError('Không tải được danh sách nhân viên từ máy chủ.')).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => [ALL, ...Array.from(new Set(staff.flatMap((item) => item.services.map((service) => service.categoryName).filter((name): name is string => Boolean(name)))))], [staff]);
  const visibleStaff = useMemo(() => staff.filter((item) => {
    const matchesCategory = category === ALL || item.services.some((service) => service.categoryName === category);
    const query = keyword.trim().toLocaleLowerCase('vi');
    return matchesCategory && (!query || `${item.name} ${item.specialty ?? ''} ${item.services.map((service) => service.name).join(' ')}`.toLocaleLowerCase('vi').includes(query));
  }), [category, keyword, staff]);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.headerButton}><Ionicons name="chevron-back" size={23} color="#40373A" /></Pressable><View style={styles.heading}><Text style={styles.title}>Nhân viên</Text><Text style={styles.subtitle}>Chọn nhân viên yêu thích của bạn</Text></View><Pressable onPress={() => setSearchVisible((value) => !value)} style={styles.headerButton}><Ionicons name={searchVisible ? 'close' : 'search'} size={21} color="#40373A" /></Pressable></View>
    {searchVisible && <View style={styles.searchBox}><Ionicons name="search" size={18} color="#729089" /><TextInput autoFocus value={keyword} onChangeText={setKeyword} placeholder="Tìm tên hoặc chuyên môn" placeholderTextColor="#9C9295" style={styles.searchInput} /></View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item, index) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive, index % 3 === 1 && category !== item && styles.filterSage, index % 3 === 2 && category !== item && styles.filterLavender]}><Text numberOfLines={1} style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {loading && !staff.length ? <View style={styles.center}><ActivityIndicator color="#C25573" /><Text style={styles.stateText}>Đang tải đội ngũ...</Text></View> : <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#C25573" />} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {!!error && <View style={styles.errorBox}><Ionicons name="cloud-offline-outline" size={20} color="#B16A59" /><Text style={styles.errorText}>{error}</Text></View>}
      {!visibleStaff.length && !error && <View style={styles.emptyBox}><Ionicons name="people-outline" size={28} color="#78918B" /><Text style={styles.stateText}>Chưa có nhân viên phù hợp.</Text></View>}
      {visibleStaff.map((item, index) => { const favorite = favorites.includes(item.id); return <Pressable key={item.id} onPress={() => router.push({ pathname: '/staff/[id]', params: { id: item.id } })} style={[styles.card, index % 3 === 1 && styles.cardSage, index % 3 === 2 && styles.cardLavender]}>
        <View style={styles.avatarWrap}>{item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.name.charAt(0)}</Text></View>}{item.worksToday && <View style={styles.availableDot} />}</View>
        <View style={styles.info}><Text style={styles.name}>{item.name}</Text><Text style={styles.role}>{item.specialty || 'Kỹ thuật viên NailHouse'}</Text><View style={styles.ratingRow}><Ionicons name="star" size={15} color="#E0A22E" /><Text style={styles.rating}>{item.rating.toFixed(1)}</Text><Text style={styles.reviewCount}>({item.reviewCount} đánh giá)</Text></View><Text style={styles.experience}>{item.experienceYears} năm kinh nghiệm</Text><View style={styles.tags}>{item.services.slice(0, 3).map((service, serviceIndex) => <View key={service.id} style={[styles.tag, serviceIndex === 1 && styles.tagSage, serviceIndex === 2 && styles.tagGold]}><Text numberOfLines={1} style={styles.tagText}>{service.name}</Text></View>)}</View></View>
        <Pressable hitSlop={10} onPress={() => toggleFavorite(item.id)} style={styles.favorite}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? '#C25573' : '#8B9996'} /></Pressable>
      </Pressable>; })}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDF9' }, header: { height: 70, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, heading: { alignItems: 'center' }, title: { color: '#332A2D', fontSize: 21, fontWeight: '800' }, subtitle: { color: '#928589', fontSize: 9, marginTop: 3 },
  searchBox: { marginHorizontal: 15, marginBottom: 8, height: 42, paddingHorizontal: 12, backgroundColor: '#F1F6F4', borderWidth: 1, borderColor: '#DDE9E5', flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { flex: 1, color: '#3D3437', fontSize: 12 }, filters: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 }, filter: { minWidth: 72, maxWidth: 135, height: 36, paddingHorizontal: 14, backgroundColor: '#FAE8ED', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, filterSage: { backgroundColor: '#E8F1EE' }, filterLavender: { backgroundColor: '#F0EAF5' }, filterActive: { backgroundColor: '#C25573' }, filterText: { color: '#665A5E', fontSize: 10, fontWeight: '700' }, filterTextActive: { color: '#FFF' },
  list: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 }, card: { minHeight: 139, padding: 12, backgroundColor: '#FFF5F7', borderWidth: 1, borderColor: '#F2DDE3', flexDirection: 'row', alignItems: 'center' }, cardSage: { backgroundColor: '#F2F7F5', borderColor: '#DDEAE6' }, cardLavender: { backgroundColor: '#F7F3F9', borderColor: '#E8DFEC' }, avatarWrap: { width: 82, height: 82 }, avatar: { width: 82, height: 82, borderRadius: 41 }, avatarFallback: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E3EFEC', alignItems: 'center', justifyContent: 'center' }, avatarInitial: { color: '#4D7F78', fontSize: 27, fontWeight: '800' }, availableDot: { position: 'absolute', left: 3, top: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#79A66A', borderWidth: 2, borderColor: '#FFF' },
  info: { flex: 1, marginLeft: 13 }, name: { color: '#332A2D', fontSize: 15, fontWeight: '800' }, role: { color: '#776A6E', fontSize: 10, marginTop: 2 }, ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 3 }, rating: { color: '#4A4043', fontSize: 11, fontWeight: '800' }, reviewCount: { color: '#94898C', fontSize: 9 }, experience: { color: '#6F827D', fontSize: 10, marginTop: 4 }, tags: { flexDirection: 'row', gap: 4, marginTop: 8 }, tag: { maxWidth: 78, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: '#F5DFE5' }, tagSage: { backgroundColor: '#DDEBE7' }, tagGold: { backgroundColor: '#F3E8CF' }, tagText: { color: '#695D61', fontSize: 7 }, favorite: { position: 'absolute', top: 12, right: 11, padding: 2 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9 }, stateText: { color: '#786E71', fontSize: 11 }, emptyBox: { paddingVertical: 60, alignItems: 'center', gap: 8 }, errorBox: { padding: 12, backgroundColor: '#FFF2EA', flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: '#8B584D', fontSize: 10 },
});
