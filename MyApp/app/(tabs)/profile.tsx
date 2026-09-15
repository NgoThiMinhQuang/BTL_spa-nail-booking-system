import { fetchHomeData } from '@/features/home/home.service';
import type { HomeCustomer } from '@/features/home/home.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type MenuItem = { icon: IconName; label: string; badge?: number; action?: () => void };

const COLORS = { background: '#FFF9FA', surface: '#FFFFFF', pink: '#C95D7B', pinkSoft: '#FBE9EE', text: '#30282B', muted: '#8A7D81', line: '#F0E7E9' };

export default function ProfileScreen() {
  const [customer, setCustomer] = useState<HomeCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const home = await fetchHomeData();
      setCustomer(home.customer);
      setError('');
    } catch {
      setError('Không thể tải thông tin cá nhân.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchHomeData()
      .then((home) => { if (active) { setCustomer(home.customer); setError(''); } })
      .catch(() => { if (active) setError('Không thể tải thông tin cá nhân.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const comingSoon = (label: string) => Alert.alert(label, 'Tính năng này đang được hoàn thiện.');
  const menuItems: MenuItem[] = [
    { icon: 'person-outline', label: 'Thông tin cá nhân', action: () => comingSoon('Thông tin cá nhân') },
    { icon: 'calendar-outline', label: 'Lịch hẹn của tôi', action: () => router.push('/bookings') },
    { icon: 'heart-outline', label: 'Yêu thích', action: () => router.push('/favorites') },
    { icon: 'notifications-outline', label: 'Thông báo', badge: 5, action: () => comingSoon('Thông báo') },
    { icon: 'gift-outline', label: 'Ưu đãi của tôi', action: () => comingSoon('Ưu đãi của tôi') },
    { icon: 'help-circle-outline', label: 'Hỗ trợ, liên hệ', action: () => comingSoon('Hỗ trợ, liên hệ') },
    { icon: 'settings-outline', label: 'Cài đặt', action: () => comingSoon('Cài đặt') },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfile(true)} tintColor={COLORS.pink} />}
        contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cá nhân</Text>

        <View style={styles.profileCard}>
          {loading && !customer ? <View style={styles.avatar}><ActivityIndicator color={COLORS.pink} /></View> : (
            <Image source={customer?.avatarUrl ? { uri: customer.avatarUrl } : require('@/assets/images/avatar/user.png')} style={styles.avatar} />
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{customer?.name ?? 'Khách hàng'}</Text>
            <Text style={styles.email}>{customer?.email ?? 'minh@nailhouse.vn'}</Text>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>
          <Pressable hitSlop={10} onPress={() => comingSoon('Thông tin cá nhân')} style={styles.profileArrow}><Ionicons name="chevron-forward" size={22} color="#9B8C90" /></Pressable>
        </View>

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <Pressable key={item.label} onPress={item.action} style={({ pressed }) => [styles.menuItem, index < menuItems.length - 1 && styles.menuDivider, pressed && styles.menuPressed]}>
              <View style={styles.menuIcon}><Ionicons name={item.icon} size={22} color={COLORS.pink} /></View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {!!item.badge && <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View>}
              <Ionicons name="chevron-forward" size={20} color="#A89A9E" />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi NailHouse?', [{ text: 'Hủy', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive' }])}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.menuPressed]}>
          <Ionicons name="log-out-outline" size={21} color={COLORS.pink} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>

        <Text style={styles.version}>NailHouse · Phiên bản 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 34 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 22 },
  profileCard: { minHeight: 100, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 20, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, shadowColor: '#8D6671', shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.pinkSoft, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, paddingHorizontal: 14 }, name: { color: COLORS.text, fontSize: 19, fontWeight: '800' }, email: { color: COLORS.muted, fontSize: 13, marginTop: 5 }, errorText: { color: '#B0586D', fontSize: 10, marginTop: 4 },
  profileArrow: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  menuCard: { marginTop: 20, borderRadius: 20, paddingHorizontal: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  menuItem: { minHeight: 62, flexDirection: 'row', alignItems: 'center' }, menuDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.line }, menuPressed: { opacity: .6 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.pinkSoft, alignItems: 'center', justifyContent: 'center' }, menuLabel: { flex: 1, color: '#4C4145', fontSize: 15, fontWeight: '600', marginLeft: 13 },
  badge: { minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 12, backgroundColor: '#D85B78', alignItems: 'center', justifyContent: 'center', marginRight: 6 }, badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  logoutButton: { height: 54, marginTop: 28, borderRadius: 17, borderWidth: 1, borderColor: '#EDCBD4', backgroundColor: '#FFFDFD', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, logoutText: { color: COLORS.pink, fontSize: 15, fontWeight: '800' },
  version: { color: '#B1A5A8', fontSize: 11, textAlign: 'center', marginTop: 18 },
});
