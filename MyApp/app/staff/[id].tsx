import { fetchStaffById } from '@/features/staff/staff.service';
import type { StaffDetail } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  ink: '#2D2830', muted: '#756D76', primary: '#D65376', primaryDark: '#B83D61',
  blush: '#FFF0F3', cream: '#FFFBF5', white: '#FFFFFF', line: '#F0E3E3',
  sage: '#547D73', sageSoft: '#EAF3EF', lavender: '#766288', lavenderSoft: '#F2ECF6',
  gold: '#E5A229', goldSoft: '#FFF3D9', green: '#359257',
};

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffDetail>();
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (id) fetchStaffById(id).then(setStaff).catch(() => setError('Không tải được thông tin nhân viên.'));
  }, [id]);

  if (error) return <SafeAreaView style={styles.center}><Ionicons name="cloud-offline-outline" size={38} color="#B86A5C" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Quay lại</Text></Pressable></SafeAreaView>;
  if (!staff) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loading}>Đang tải hồ sơ nhân viên...</Text></SafeAreaView>;

  const introduction = `${staff.name} có ${staff.experienceYears} năm kinh nghiệm trong lĩnh vực nail, nổi bật với ${staff.specialty || 'chăm sóc và làm đẹp móng'}. Luôn tỉ mỉ trong từng chi tiết và tư vấn mẫu phù hợp với phong cách riêng của mỗi khách hàng.`;
  const book = () => router.push({ pathname: '/booking/select-service', params: { staffId: staff.id } });
  const share = () => Share.share({ message: `Khám phá hồ sơ của ${staff.name} tại NailHouse — ${staff.rating.toFixed(1)} sao từ ${staff.reviewCount} đánh giá.` });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={COLORS.ink} /></Pressable>
          <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="flower-outline" size={16} color={COLORS.primary} /></View><View><Text style={styles.brandName}>Nail<Text style={styles.brandAccent}>House</Text></Text><Text style={styles.brandTagline}>Đẹp hơn mỗi ngày</Text></View></View>
          <View style={styles.actions}><Pressable onPress={() => setFavorite((value) => !value)} style={styles.iconButton}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={COLORS.primary} /></Pressable><Pressable onPress={share} style={styles.iconButton}><Ionicons name="share-social-outline" size={19} color={COLORS.lavender} /></Pressable></View>
        </View>

        <View style={styles.profileHero}>
          <View style={styles.photoWrap}>
            {staff.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.photo} /> : <View style={[styles.photo, styles.photoFallback]}><Text style={styles.photoInitial}>{staff.name.charAt(0)}</Text></View>}
            <View style={styles.statusPill}><View style={[styles.statusDot, !staff.worksToday && styles.statusDotOff]} /><Text style={[styles.statusText, !staff.worksToday && styles.statusTextOff]}>{staff.worksToday ? 'Đang nhận lịch' : 'Làm theo lịch'}</Text></View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.eyebrow}>CHUYÊN VIÊN NAILHOUSE</Text>
            <Text numberOfLines={2} style={styles.name}>{staff.name}</Text>
            <Text numberOfLines={2} style={styles.role}>{staff.specialty || 'Nail Artist'}</Text>
            <View style={styles.ratingRow}><Ionicons name="star" size={17} color={COLORS.gold} /><Text style={styles.rating}>{staff.rating.toFixed(1)}</Text><Text style={styles.reviewCount}>({staff.reviewCount} đánh giá)</Text></View>
            <View style={styles.stats}>
              <Stat icon="briefcase-outline" color={COLORS.primary} background={COLORS.blush} value={`${staff.experienceYears} năm`} label="Kinh nghiệm" />
              <Stat icon="chatbubble-outline" color={COLORS.sage} background={COLORS.sageSoft} value={`${staff.reviewCount}`} label="Đánh giá" />
              <Stat icon="sparkles-outline" color={COLORS.lavender} background={COLORS.lavenderSoft} value={`${staff.services.length}`} label="Dịch vụ" />
            </View>
            <View style={styles.signature}><View style={styles.signatureLine} /><Text style={styles.signatureText}>Tận tâm trong từng nét cọ</Text></View>
          </View>
        </View>

        <View style={[styles.section, styles.expertiseSection]}>
          <SectionHeader icon="diamond-outline" iconColor={COLORS.primary} title="Chuyên môn" />
          <View style={styles.tags}>{staff.services.slice(0, 6).map((service, index) => {
            const variants = [styles.tagPink, styles.tagSage, styles.tagLavender, styles.tagGold];
            const textVariants = [styles.tagTextPink, styles.tagTextSage, styles.tagTextLavender, styles.tagTextGold];
            return <View key={service.id} style={[styles.tag, variants[index % variants.length]]}><Text numberOfLines={1} style={[styles.tagText, textVariants[index % textVariants.length]]}>{service.name}</Text></View>;
          })}</View>
        </View>

        <View style={[styles.section, styles.introSection]}>
          <SectionHeader icon="document-text-outline" iconColor={COLORS.sage} title="Giới thiệu" />
          <Text style={styles.introduction}>{introduction}</Text>
          <View style={styles.quote}><Ionicons name="sparkles-outline" size={15} color={COLORS.gold} /><Text style={styles.quoteText}>“Làm đẹp là cách lan tỏa sự tự tin đến mọi người.”</Text></View>
        </View>

        <View style={styles.section}>
          <SectionHeader icon="images-outline" iconColor={COLORS.lavender} title="Mẫu nail đã thực hiện" count={staff.portfolio.length} />
          {staff.portfolio.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolio}>{staff.portfolio.map((item, index) => <View key={`${item.imageUrl}-${index}`}><Image source={{ uri: item.imageUrl }} style={styles.workImage} />{index === 0 && <View style={styles.featured}><Text style={styles.featuredText}>Nổi bật</Text></View>}</View>)}</ScrollView> : <Empty icon="images-outline" text="Chưa có hình ảnh công việc." />}
        </View>

        <View style={styles.section}>
          <SectionHeader icon="chatbubble-ellipses-outline" iconColor={COLORS.primary} title="Khách hàng nói gì" count={staff.reviews.length} />
          {staff.reviews.length ? staff.reviews.slice(0, 2).map((review) => <View key={review.id} style={styles.reviewCard}><View style={styles.reviewHeader}>{review.customerAvatarUrl ? <Image source={{ uri: review.customerAvatarUrl }} style={styles.reviewAvatar} /> : <View style={styles.reviewFallback}><Text style={styles.reviewInitial}>{review.customerName.charAt(0)}</Text></View>}<View style={styles.reviewIdentity}><Text numberOfLines={1} style={styles.reviewName}>{review.customerName}</Text><View style={styles.stars}>{Array.from({ length: 5 }).map((_, index) => <Ionicons key={index} name={index < review.rating ? 'star' : 'star-outline'} size={12} color={COLORS.gold} />)}</View></View><Text style={styles.date}>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</Text></View>{review.comment && <Text style={styles.comment}>{review.comment}</Text>}</View>) : <Empty icon="chatbubble-ellipses-outline" text="Chưa có đánh giá cho nhân viên này." />}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => Alert.alert('NailHouse', 'Tính năng trò chuyện sẽ sớm được cập nhật.')} style={styles.messageButton}><Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primaryDark} /><Text style={styles.messageText}>Tư vấn</Text></Pressable>
        <Pressable onPress={book} style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}><Ionicons name="calendar-outline" size={19} color="#FFF" /><Text style={styles.bookText}>Chọn nhân viên này</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ icon, color, background, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; background: string; value: string; label: string }) {
  return <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: background }]}><Ionicons name={icon} size={16} color={color} /></View><View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View></View>;
}

function SectionHeader({ icon, iconColor, title, count }: { icon: React.ComponentProps<typeof Ionicons>['name']; iconColor: string; title: string; count?: number }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionTitleWrap}><Ionicons name={icon} size={18} color={iconColor} /><Text style={styles.sectionTitle}>{title}</Text></View>{typeof count === 'number' && count > 0 && <View style={styles.countPill}><Text style={styles.countText}>{count}</Text></View>}</View>;
}

function Empty({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={22} color={COLORS.sage} /><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF9FA' }, scrollContent: { paddingBottom: 112, backgroundColor: '#FFF9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream, gap: 10, padding: 24 }, loading: { color: COLORS.muted, fontSize: 12 }, errorText: { color: '#7D5550', fontSize: 13, textAlign: 'center' }, backButton: { borderRadius: 16, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10 }, backText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  topBar: { height: 66, paddingHorizontal: 14, backgroundColor: '#FFF3F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.92)', alignItems: 'center', justifyContent: 'center' }, actions: { flexDirection: 'row', gap: 7 }, brand: { position: 'absolute', left: '38%', flexDirection: 'row', alignItems: 'center', gap: 6 }, brandIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFE5EB', alignItems: 'center', justifyContent: 'center' }, brandName: { color: COLORS.ink, fontSize: 16, fontWeight: '800', fontFamily: 'serif' }, brandAccent: { color: COLORS.primary }, brandTagline: { color: COLORS.muted, fontSize: 6 },
  profileHero: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 22, backgroundColor: '#FFF3F5', flexDirection: 'row' }, photoWrap: { width: '42%', height: 238, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.blush }, photo: { width: '100%', height: '100%', resizeMode: 'cover' }, photoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sageSoft }, photoInitial: { color: COLORS.sage, fontSize: 54, fontWeight: '800' }, statusPill: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.94)', flexDirection: 'row', alignItems: 'center', gap: 5 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green }, statusDotOff: { backgroundColor: COLORS.gold }, statusText: { color: COLORS.green, fontSize: 8, fontWeight: '800' }, statusTextOff: { color: '#956E28' }, profileInfo: { flex: 1, paddingLeft: 15, paddingTop: 8 }, eyebrow: { color: COLORS.primary, fontSize: 7, fontWeight: '800', letterSpacing: .8 }, name: { color: COLORS.ink, fontSize: 26, lineHeight: 30, fontWeight: '800', marginTop: 7, fontFamily: 'serif' }, role: { color: COLORS.lavender, fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 3 }, ratingRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }, rating: { color: COLORS.ink, fontSize: 13, fontWeight: '800' }, reviewCount: { color: COLORS.muted, fontSize: 8 }, signature: { marginTop: 12 }, signatureLine: { width: 25, height: 2, borderRadius: 1, backgroundColor: COLORS.gold }, signatureText: { color: COLORS.muted, fontSize: 8, lineHeight: 12, fontStyle: 'italic', marginTop: 5 },
  stats: { marginTop: 13, flexDirection: 'row', gap: 5 }, stat: { flex: 1, minHeight: 60, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,.76)', alignItems: 'center', justifyContent: 'center' }, statIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }, statValue: { color: COLORS.ink, fontSize: 9, fontWeight: '800', textAlign: 'center' }, statLabel: { color: COLORS.muted, fontSize: 6, marginTop: 1, textAlign: 'center' }, statDivider: { width: 1, height: 35, backgroundColor: COLORS.line },
  section: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 18, backgroundColor: '#FFF' }, expertiseSection: { marginTop: 0, paddingBottom: 13 }, introSection: { marginTop: 0, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#F5ECEC' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '800' }, countPill: { minWidth: 24, height: 20, paddingHorizontal: 6, backgroundColor: COLORS.blush, alignItems: 'center', justifyContent: 'center' }, countText: { color: COLORS.primary, fontSize: 8, fontWeight: '800' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { maxWidth: 145, height: 31, borderRadius: 16, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, tagPink: { backgroundColor: COLORS.blush }, tagSage: { backgroundColor: COLORS.sageSoft }, tagLavender: { backgroundColor: COLORS.lavenderSoft }, tagGold: { backgroundColor: COLORS.goldSoft }, tagText: { fontSize: 9, fontWeight: '700' }, tagTextPink: { color: COLORS.primaryDark }, tagTextSage: { color: COLORS.sage }, tagTextLavender: { color: COLORS.lavender }, tagTextGold: { color: '#94691E' },
  introduction: { color: '#665E67', fontSize: 11, lineHeight: 18 }, quote: { marginTop: 12, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: COLORS.goldSoft, flexDirection: 'row', alignItems: 'center', gap: 7 }, quoteText: { flex: 1, color: '#7E6740', fontSize: 9, lineHeight: 14, fontStyle: 'italic' }, portfolio: { gap: 9 }, workImage: { width: 128, height: 116, borderRadius: 5, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#F2EBE7' }, featured: { position: 'absolute', left: 7, bottom: 7, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(45,40,48,.68)' }, featuredText: { color: '#FFF', fontSize: 7, fontWeight: '700' },
  reviewCard: { marginTop: 8, padding: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5 }, reviewHeader: { flexDirection: 'row', alignItems: 'center' }, reviewAvatar: { width: 38, height: 38, borderRadius: 19 }, reviewFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.lavenderSoft, alignItems: 'center', justifyContent: 'center' }, reviewInitial: { color: COLORS.lavender, fontWeight: '800' }, reviewIdentity: { flex: 1, marginLeft: 9 }, reviewName: { color: COLORS.ink, fontSize: 11, fontWeight: '800' }, stars: { flexDirection: 'row', marginTop: 3 }, date: { color: '#9B9093', fontSize: 8 }, comment: { color: '#6E656D', fontSize: 10, lineHeight: 16, marginTop: 9, paddingLeft: 47 }, empty: { height: 62, paddingHorizontal: 12, backgroundColor: COLORS.sageSoft, flexDirection: 'row', alignItems: 'center', gap: 9 }, emptyText: { color: COLORS.sage, fontSize: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,.97)', borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: 'row', gap: 9 }, messageButton: { height: 48, width: 105, borderRadius: 16, backgroundColor: COLORS.blush, borderWidth: 1, borderColor: '#F5DDE4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, messageText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '800' }, bookButton: { flex: 1, height: 48, borderRadius: 16, backgroundColor: COLORS.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: .18, shadowRadius: 9, elevation: 4 }, bookText: { color: '#FFF', fontSize: 11, fontWeight: '800' }, pressed: { opacity: .86, transform: [{ scale: .99 }] },
});
