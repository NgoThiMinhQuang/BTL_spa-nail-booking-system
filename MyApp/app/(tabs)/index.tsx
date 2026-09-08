import { AppointmentCard } from '@/components/home/AppointmentCard';
import { Banner } from '@/components/home/Banner';
import { CategoryMenu } from '@/components/home/CategoryMenu';
import { FeaturedArtists } from '@/components/home/FeaturedArtists';
import { Header } from '@/components/home/Header';
import { NailCard } from '@/components/home/NailCard';
import { ServiceCard } from '@/components/home/ServiceCard';
import { fetchHomeData } from '@/features/home/home.service';
import type { HomeData } from '@/features/home/home.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{onPress && <Text onPress={onPress} style={styles.seeAll}>Xem tất cả  ›</Text>}</View>;
}

export default function HomeScreen() {
  const [home, setHome] = useState<HomeData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHome = async () => {
    try {
      setError('');
      setHome(await fetchHomeData());
    } catch {
      setError('Không thể tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData().then(setHome).catch(() => setError('Không thể tải dữ liệu từ máy chủ.')).finally(() => setLoading(false));
  }, []);

  if (loading && !home) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#397B76" /><Text style={styles.loadingText}>Đang tải dữ liệu NailHouse...</Text></SafeAreaView>;

  if (error && !home) return <SafeAreaView style={styles.center}><Ionicons name="cloud-offline-outline" size={42} color="#A85B4F" /><Text style={styles.errorTitle}>Chưa kết nối được backend</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={loadHome} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable></SafeAreaView>;

  if (!home) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHome} tintColor="#397B76" />} contentContainerStyle={styles.container}>
        <Header name={home.customer?.name ?? 'Khách hàng'} avatarUrl={home.customer?.avatarUrl} />
        {home.banner && <Banner banner={home.banner} />}
        <CategoryMenu />

        <SectionHeader title="Dịch vụ nổi bật" onPress={() => router.push('/services')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {home.featuredServices.map((item) => <ServiceCard key={item.id} service={item} compact />)}
        </ScrollView>

        <SectionHeader title="Mẫu nail thịnh hành" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {home.trendingDesigns.map((item) => <NailCard key={item.id} title={item.name} imageUrl={item.imageUrl} />)}
        </ScrollView>

        <FeaturedArtists artists={home.featuredArtists} />

        <SectionHeader title="Lịch hẹn sắp tới của bạn" onPress={() => router.push('/bookings')} />
        {home.upcomingAppointment ? <AppointmentCard appointment={home.upcomingAppointment} /> : <View style={styles.noAppointment}><Ionicons name="calendar-outline" size={25} color="#6B8F88" /><View><Text style={styles.noAppointmentTitle}>Bạn chưa có lịch hẹn sắp tới</Text><Text style={styles.noAppointmentText}>Chọn dịch vụ yêu thích và đặt lịch ngay nhé.</Text></View></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#FFFCF9' }, container: { paddingBottom: 28 }, center: { flex: 1, backgroundColor: '#FFFCF9', alignItems: 'center', justifyContent: 'center', padding: 28 }, loadingText: { color: '#786C70', fontSize: 12, marginTop: 12 }, errorTitle: { color: '#493B40', fontSize: 18, fontWeight: '800', marginTop: 12 }, errorText: { color: '#806F75', fontSize: 12, marginTop: 5 }, retryButton: { marginTop: 16, backgroundColor: '#397B76', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 }, retryText: { color: '#FFF', fontWeight: '800' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 }, sectionTitle: { color: '#2F2529', fontSize: 19, fontWeight: '800' }, seeAll: { color: '#C75B7A', fontSize: 13, fontWeight: '600' }, horizontalList: { paddingHorizontal: 16, gap: 10 }, noAppointment: { marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: '#EDF4F1', flexDirection: 'row', alignItems: 'center', gap: 12 }, noAppointmentTitle: { color: '#385852', fontSize: 13, fontWeight: '800' }, noAppointmentText: { color: '#6F8580', fontSize: 10, marginTop: 3 } });
