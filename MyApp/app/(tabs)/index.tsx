import { AppointmentCard } from '@/components/home/AppointmentCard';
import { Banner } from '@/components/home/Banner';
import { CategoryMenu } from '@/components/home/CategoryMenu';
import { Header } from '@/components/home/Header';
import { NailCard } from '@/components/home/NailCard';
import { ServiceCard } from '@/components/home/ServiceCard';
import { services } from '@/features/service/service.data';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const nailLooks = [
  { id: '1', title: 'Blush French', position: '20%' },
  { id: '2', title: 'Pink Blossom', position: '45%' },
  { id: '3', title: 'Nude Garden', position: '65%' },
  { id: '4', title: 'Rose Glow', position: '85%' },
];

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Text onPress={onPress} style={styles.seeAll}>Xem tất cả  ›</Text></View>;
}

export default function HomeScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <Header />
        <Banner />
        <CategoryMenu />

        <SectionHeader title="Dịch vụ nổi bật" onPress={() => router.push('/services')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {services.map((item) => <ServiceCard key={item.id} service={item} compact />)}
        </ScrollView>

        <SectionHeader title="Mẫu nail thịnh hành" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {nailLooks.map((item) => <NailCard key={item.id} title={item.title} position={item.position} />)}
        </ScrollView>

        <SectionHeader title="Lịch hẹn sắp tới của bạn" onPress={() => router.push('/bookings')} />
        <AppointmentCard service="Sơn gel & Nail Art" time="09:00 · Thứ Bảy, 12/09/2026" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFCF9' },
  container: { paddingBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: '#2F2529', fontSize: 19, fontWeight: '800' },
  seeAll: { color: '#C75B7A', fontSize: 13, fontWeight: '600' },
  horizontalList: { paddingHorizontal: 16, gap: 10 },
});
