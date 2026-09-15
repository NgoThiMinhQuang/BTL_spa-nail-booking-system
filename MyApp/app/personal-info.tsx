import { fetchHomeData } from '@/features/home/home.service';
import type { HomeCustomer } from '@/features/home/home.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background: '#FFF9FA', surface: '#FFF', pink: '#D56B81', soft: '#FBE9EE', text: '#30282B', muted: '#8A7D81', line: '#F0E5E8' };

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.infoRow}><View style={styles.iconBox}><Ionicons name={icon} size={21} color={COLORS.pink} /></View><View style={styles.infoCopy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View></View>;
}

export default function PersonalInfoScreen() {
  const [customer, setCustomer] = useState<HomeCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchHomeData()
      .then((home) => { if (active) setCustomer(home.customer); })
      .catch(() => { if (active) setError('Không thể tải thông tin cá nhân.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable><Text style={styles.title}>Thông tin cá nhân</Text><View style={styles.headerButton} /></View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.pink} /><Text style={styles.loadingText}>Đang tải hồ sơ...</Text></View> :
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={22} color={COLORS.pink} /><Text style={styles.errorText}>{error}</Text></View>}
        <View style={styles.avatarSection}>
          <Image source={customer?.avatarUrl ? { uri: customer.avatarUrl } : require('@/assets/images/avatar/user.png')} style={styles.avatar} />
          <Pressable onPress={() => Alert.alert('Ảnh đại diện', 'Tính năng đổi ảnh đang được hoàn thiện.')} style={styles.cameraButton}><Ionicons name="camera" size={17} color="#FFF" /></Pressable>
          <Text style={styles.name}>{customer?.name ?? 'Khách hàng'}</Text><Text style={styles.member}>THÀNH VIÊN NAILHOUSE</Text>
        </View>
        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label="Họ và tên" value={customer?.name ?? 'Chưa cập nhật'} />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline" label="Email" value={customer?.email ?? 'Chưa cập nhật'} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Số điện thoại" value={customer?.phone ?? 'Chưa cập nhật'} />
          <View style={styles.divider} />
          <InfoRow icon="shield-checkmark-outline" label="Mã khách hàng" value={`NH-${String(customer?.id ?? '1').padStart(5, '0')}`} />
        </View>
        <Pressable onPress={() => Alert.alert('Chỉnh sửa hồ sơ', 'Tính năng cập nhật thông tin đang được hoàn thiện.')} style={styles.editButton}><Ionicons name="create-outline" size={20} color="#FFF" /><Text style={styles.editText}>Chỉnh sửa thông tin</Text></Pressable>
      </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, header: { height: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loadingText: { color: COLORS.muted, fontSize: 13, marginTop: 12 }, content: { paddingHorizontal: 18, paddingBottom: 34 }, errorBox: { padding: 13, borderRadius: 14, backgroundColor: COLORS.soft, flexDirection: 'row', alignItems: 'center', gap: 9 }, errorText: { color: '#A24B64', fontSize: 13 },
  avatarSection: { alignItems: 'center', paddingVertical: 18 }, avatar: { width: 106, height: 106, borderRadius: 53, backgroundColor: COLORS.soft }, cameraButton: { position: 'absolute', top: 87, right: '35%', width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.pink, borderWidth: 3, borderColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }, name: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 13 }, member: { color: COLORS.pink, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 5 },
  infoCard: { marginTop: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }, infoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' }, iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.soft, alignItems: 'center', justifyContent: 'center' }, infoCopy: { flex: 1, marginLeft: 13 }, label: { color: COLORS.muted, fontSize: 11, fontWeight: '600' }, value: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 4 }, divider: { height: 1, marginLeft: 55, backgroundColor: COLORS.line },
  editButton: { height: 54, marginTop: 22, borderRadius: 27, backgroundColor: COLORS.pink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, editText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
