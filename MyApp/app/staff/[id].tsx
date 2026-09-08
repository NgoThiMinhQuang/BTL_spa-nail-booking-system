import { fetchStaffById } from '@/features/staff/staff.service';
import type { StaffDetail } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffDetail>();
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  useEffect(() => { if (id) fetchStaffById(id).then(setStaff).catch(() => setError('Không tải được thông tin nhân viên.')); }, [id]);

  if (error) return <SafeAreaView style={styles.center}><Ionicons name="cloud-offline-outline" size={38} color="#B86A5C" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Quay lại</Text></Pressable></SafeAreaView>;
  if (!staff) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#C25573" /><Text style={styles.loading}>Đang tải hồ sơ nhân viên...</Text></SafeAreaView>;

  const introduction = `${staff.name} có ${staff.experienceYears} năm kinh nghiệm trong lĩnh vực nail. Chuyên môn ${staff.specialty || 'chăm sóc và làm đẹp móng'}, luôn tư vấn mẫu phù hợp với phong cách và nhu cầu của từng khách hàng.`;

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        {staff.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.heroImage} /> : <View style={styles.heroFallback}><Text style={styles.heroInitial}>{staff.name.charAt(0)}</Text></View>}
        <View style={styles.heroShade} />
        <Pressable onPress={() => router.back()} style={[styles.roundButton, styles.back]}><Ionicons name="chevron-back" size={24} color="#FFF" /></Pressable>
        <View style={styles.heroActions}><Pressable onPress={() => setFavorite((value) => !value)} style={styles.roundButton}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={21} color={favorite ? '#F5B4C5' : '#FFF'} /></Pressable><View style={styles.roundButton}><Ionicons name="share-social-outline" size={20} color="#FFF" /></View></View>
        <View style={styles.heroCaption}><Text style={styles.captionScript}>Beautiful Nails</Text><Text style={styles.captionSmall}>Happier you</Text></View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.profileHeader}><View style={styles.profileCopy}><Text style={styles.name}>{staff.name}</Text><Text style={styles.role}>{staff.specialty || 'Nail Artist'}</Text></View><Pressable onPress={() => router.push({ pathname: '/booking/select-service', params: { staffId: staff.id } })} style={styles.bookButton}><Ionicons name="calendar-outline" size={16} color="#FFF" /><Text style={styles.bookText}>Đặt lịch ngay</Text></Pressable></View>
        <View style={styles.quickInfo}><View style={styles.quickItem}><Ionicons name="star" size={17} color="#E2A32D" /><View><Text style={styles.quickValue}>{staff.rating.toFixed(1)}</Text><Text style={styles.quickLabel}>{staff.reviewCount} đánh giá</Text></View></View><View style={styles.quickDivider} /><View style={styles.quickItem}><Ionicons name="ribbon-outline" size={18} color="#C25573" /><View><Text style={styles.quickValue}>{staff.experienceYears} năm</Text><Text style={styles.quickLabel}>Kinh nghiệm</Text></View></View><View style={styles.quickDivider} /><View style={styles.quickItem}><View style={[styles.statusDot, !staff.worksToday && styles.statusDotOff]} /><View><Text style={styles.quickValue}>{staff.worksToday ? 'Hôm nay' : 'Theo lịch'}</Text><Text style={styles.quickLabel}>Lịch làm việc</Text></View></View></View>
        <View style={styles.tags}>{staff.services.slice(0, 5).map((service, index) => <View key={service.id} style={[styles.tag, index % 3 === 1 && styles.tagSage, index % 3 === 2 && styles.tagGold]}><Text style={styles.tagText}>{service.name}</Text></View>)}</View>

        <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Giới thiệu</Text><View style={styles.introductionBox}><View style={styles.introductionLine} /><Text style={styles.introduction}>{introduction}</Text></View>

        <SectionHeader title="Hình ảnh thực tế" link={staff.portfolio.length > 4 ? 'Xem tất cả  ›' : undefined} />
        {staff.portfolio.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolio}>{staff.portfolio.map((item, index) => <Image key={`${item.imageUrl}-${index}`} source={{ uri: item.imageUrl }} style={styles.workImage} />)}</ScrollView> : <Empty icon="images-outline" text="Chưa có hình ảnh công việc." />}

        <SectionHeader title="Đánh giá từ khách hàng" link={staff.reviews.length > 1 ? 'Xem tất cả  ›' : undefined} />
        {staff.reviews.length ? staff.reviews.slice(0, 2).map((review) => <View key={review.id} style={styles.reviewCard}><View style={styles.reviewHeader}>{review.customerAvatarUrl ? <Image source={{ uri: review.customerAvatarUrl }} style={styles.reviewAvatar} /> : <View style={styles.reviewFallback}><Text style={styles.reviewInitial}>{review.customerName.charAt(0)}</Text></View>}<View style={styles.reviewIdentity}><Text style={styles.reviewName}>{review.customerName}</Text><View style={styles.stars}>{Array.from({ length: 5 }).map((_, index) => <Ionicons key={index} name={index < review.rating ? 'star' : 'star-outline'} size={12} color="#E2A32D" />)}</View></View><Text style={styles.date}>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</Text></View>{review.comment && <Text style={styles.comment}>{review.comment}</Text>}</View>) : <Empty icon="chatbubble-ellipses-outline" text="Chưa có đánh giá thật cho nhân viên này." />}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function SectionHeader({ title, link }: { title: string; link?: string }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{link && <Text style={styles.sectionLink}>{link}</Text>}</View>; }
function Empty({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={22} color="#6F8E87" /><Text style={styles.emptyText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEDDD7' }, scrollContent: { backgroundColor: '#EEDDD7' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF9', gap: 10, padding: 24 }, loading: { color: '#7E7376', fontSize: 11 }, errorText: { color: '#7D5550', fontSize: 12 }, backButton: { backgroundColor: '#C25573', paddingHorizontal: 19, paddingVertical: 9 }, backText: { color: '#FFF', fontWeight: '700' },
  hero: { height: 326, backgroundColor: '#D8C5BA' }, heroImage: { width: '100%', height: '100%' }, heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDEBE7' }, heroInitial: { color: '#568078', fontSize: 70, fontWeight: '800' }, heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(35,25,28,.1)' }, roundButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(45,36,38,.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,.35)', alignItems: 'center', justifyContent: 'center' }, back: { position: 'absolute', top: 13, left: 13 }, heroActions: { position: 'absolute', top: 13, right: 13, flexDirection: 'row', gap: 9 }, heroCaption: { position: 'absolute', left: 20, top: 91 }, captionScript: { color: '#FFF5ED', fontSize: 23, fontWeight: '700', fontStyle: 'italic', textShadowColor: 'rgba(50,30,35,.24)', textShadowRadius: 3 }, captionSmall: { color: '#FFF5ED', fontSize: 16, fontStyle: 'italic', marginTop: 2 },
  sheet: { marginTop: -22, paddingHorizontal: 18, paddingTop: 21, paddingBottom: 35, backgroundColor: '#FFFDF9', borderTopLeftRadius: 24, borderTopRightRadius: 24 }, profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, profileCopy: { flex: 1, paddingRight: 10 }, name: { color: '#30272A', fontSize: 23, fontWeight: '800', letterSpacing: -.3 }, role: { color: '#756A6D', fontSize: 10, marginTop: 4 }, bookButton: { height: 43, paddingHorizontal: 15, backgroundColor: '#C25573', borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }, bookText: { color: '#FFF', fontSize: 11, fontWeight: '800' }, quickInfo: { minHeight: 62, marginTop: 17, paddingHorizontal: 10, backgroundColor: '#F8F5EF', borderWidth: 1, borderColor: '#ECE5D9', flexDirection: 'row', alignItems: 'center' }, quickItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, quickDivider: { width: 1, height: 31, backgroundColor: '#E2DBD1' }, quickValue: { color: '#443A3D', fontSize: 10, fontWeight: '800' }, quickLabel: { color: '#968A8D', fontSize: 7, marginTop: 2 }, statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#77A26C' }, statusDotOff: { backgroundColor: '#C7A76A' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 }, tag: { backgroundColor: '#F7E3E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7 }, tagSage: { backgroundColor: '#E2EEEA' }, tagGold: { backgroundColor: '#F5EAD3' }, tagText: { color: '#66595D', fontSize: 8 }, sectionTitle: { color: '#392F32', fontSize: 16, fontWeight: '800' }, firstSectionTitle: { marginTop: 23 }, introductionBox: { marginTop: 9, padding: 13, backgroundColor: '#F1F6F4', borderWidth: 1, borderColor: '#DFEAE6', flexDirection: 'row' }, introductionLine: { width: 3, backgroundColor: '#6C9B91', marginRight: 10 }, introduction: { flex: 1, color: '#655D5F', fontSize: 10, lineHeight: 17 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#ECE6DC' }, sectionLink: { color: '#C25573', fontSize: 9, fontWeight: '700' },
  portfolio: { gap: 8 }, workImage: { width: 102, height: 98, borderRadius: 7, borderWidth: 1, borderColor: '#E7DED5', backgroundColor: '#EEE9E2' }, reviewCard: { padding: 13, backgroundColor: '#FFF9F7', borderWidth: 1, borderColor: '#EEDFE1', marginBottom: 8 }, reviewHeader: { flexDirection: 'row', alignItems: 'center' }, reviewAvatar: { width: 38, height: 38, borderRadius: 19 }, reviewFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3E3C8', alignItems: 'center', justifyContent: 'center' }, reviewInitial: { color: '#906A2E', fontWeight: '800' }, reviewIdentity: { flex: 1, marginLeft: 8 }, reviewName: { color: '#3E3437', fontSize: 11, fontWeight: '800' }, stars: { flexDirection: 'row', marginTop: 3 }, date: { color: '#9B9093', fontSize: 8 }, comment: { color: '#6E6467', fontSize: 10, lineHeight: 15, marginTop: 9 }, empty: { height: 58, paddingHorizontal: 12, backgroundColor: '#F1F6F4', borderWidth: 1, borderColor: '#E1EBE7', flexDirection: 'row', alignItems: 'center', gap: 9 }, emptyText: { color: '#6A7C78', fontSize: 10 },
});
