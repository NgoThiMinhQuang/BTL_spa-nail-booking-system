import { fetchServiceById } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const galleryUrl = (url: string, id: string) => `${url}${url.includes('?') ? '&' : '?'}gallery=${id}`;

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<NailService>();
  const [selectedImage, setSelectedImage] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchServiceById(id)
      .then((data) => { setService(data); setSelectedImage(data.images?.[0] ? galleryUrl(data.images[0].imageUrl, data.images[0].id) : data.imageUrl ?? ''); })
      .catch(() => setError('Không tìm thấy dịch vụ hoặc máy chủ chưa hoạt động.'));
  }, [id]);

  const gallery = useMemo(() => {
    if (!service) return [];
    const images = service.images?.map((image) => galleryUrl(image.imageUrl, image.id)) ?? [];
    return images.length > 0 ? images : service.imageUrl ? [service.imageUrl] : [];
  }, [service]);

  if (error) return <SafeAreaView style={styles.center}><Ionicons name="cloud-offline-outline" size={42} color="#D36E62" /><Text style={styles.errorTitle}>Không tải được dịch vụ</Text><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => router.back()} style={styles.backHome}><Text style={styles.backHomeText}>Quay lại</Text></Pressable></SafeAreaView>;
  if (!service) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#4D948A" /><Text style={styles.loading}>Đang tải chi tiết dịch vụ...</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><Ionicons name="chevron-back" size={24} color="#3B3436" /></Pressable>
        <View style={styles.brand}><View style={styles.logo}><Ionicons name="flower-outline" size={22} color="#BD5A78" /></View><View><Text style={styles.brandName}>Nail<Text style={styles.brandAccent}>House</Text></Text><View style={styles.location}><Ionicons name="location" size={9} color="#4D948A" /><Text style={styles.locationText}>Diamond Plaza, Q.1</Text></View></View></View>
        <View style={styles.headerRight}><Pressable style={styles.headerButton}><Ionicons name="notifications-outline" size={22} color="#3B3436" /><View style={styles.notificationDot} /></Pressable><View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.galleryRow}>
          <View style={styles.gallerySection}>
            <Image source={{ uri: selectedImage || service.imageUrl || '' }} style={styles.heroImage} />
            <Pressable onPress={() => setFavorite((value) => !value)} style={styles.favoriteButton}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={23} color={favorite ? '#E36071' : '#6B8580'} /></Pressable>
            <View style={styles.bestSeller}><Ionicons name="ribbon-outline" size={12} color="#A66D20" /><Text style={styles.bestSellerText}>Best Seller</Text></View>
            <View style={styles.counter}><Text style={styles.counterText}>{Math.max(gallery.indexOf(selectedImage) + 1, 1)}/{Math.max(gallery.length, 1)}</Text></View>
          </View>
          <View style={styles.verticalThumbnails}>
            {gallery.slice(0, 3).map((url, index) => (
              <Pressable key={`${url}-${index}`} onPress={() => setSelectedImage(url)} style={[styles.verticalThumbnailWrap, selectedImage === url && styles.verticalThumbnailActive]}>
                <Image source={{ uri: url }} style={styles.verticalThumbnail} />
                {index === 2 && gallery.length > 3 && <View style={styles.moreOverlay}><Text style={styles.moreText}>+{gallery.length - 3}</Text></View>}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.categoryRating}><View style={styles.categoryPill}><Text style={styles.categoryText}>{service.categoryName?.toUpperCase() ?? 'DỊCH VỤ NAIL'}</Text></View><View style={styles.rating}><Ionicons name="star" size={16} color="#E8A931" /><Text style={styles.ratingValue}>{Number(service.rating ?? 0).toFixed(1)}</Text><Text style={styles.reviewCount}>({service.reviewCount ?? 0} đánh giá)</Text></View></View>
          <Text style={styles.title}>{service.name}</Text>
          <View style={styles.priceLine}><Text style={styles.price}>{service.price.toLocaleString('vi-VN')}đ</Text><View style={styles.duration}><Ionicons name="time-outline" size={17} color="#4D948A" /><Text style={styles.durationText}>{service.duration} phút</Text></View></View>

          <View style={styles.recommendation}><View style={styles.recommendIcon}><Ionicons name="flower-outline" size={21} color="#B75978" /></View><View style={styles.recommendCopy}><Text style={styles.recommendTitle}>Lựa chọn được yêu thích</Text><Text style={styles.recommendText}>Phù hợp cho vẻ đẹp thanh lịch, nữ tính và hiện đại.</Text></View><Ionicons name="sparkles-outline" size={20} color="#C09BD1" /></View>

          <View style={styles.descriptionHeader}><Text style={styles.sectionTitle}>Mô tả dịch vụ</Text><Pressable onPress={() => setExpanded((value) => !value)} style={styles.expandButton}><Text style={styles.expandText}>{expanded ? 'Thu gọn' : 'Xem thêm'}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#4D948A" /></Pressable></View>
          <Text numberOfLines={expanded ? undefined : 3} style={styles.description}>{service.description || 'Dịch vụ được thực hiện bởi nghệ nhân chuyên nghiệp với sản phẩm chất lượng cao, quy trình an toàn và chăm sóc kỹ lưỡng.'}</Text>

          <Text style={[styles.sectionTitle, styles.benefitTitle]}>Điểm nổi bật</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benefitList}>
            {service.benefits?.map((benefit) => <View key={benefit.id} style={[styles.benefitCard, { backgroundColor: `${benefit.color ?? '#4D948A'}14`, borderColor: `${benefit.color ?? '#4D948A'}35` }]}><View style={[styles.benefitIcon, { backgroundColor: `${benefit.color ?? '#4D948A'}20` }]}><Ionicons name={(benefit.icon ?? 'sparkles-outline') as IconName} size={20} color={benefit.color ?? '#4D948A'} /></View><Text style={styles.benefitName}>{benefit.title}</Text><Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text></View>)}
          </ScrollView>

          {!!service.steps?.length && <View style={styles.processSection}>
            <View style={styles.processHeader}>
              <Text style={styles.sectionTitle}>Quy trình thực hiện</Text>
              <View style={styles.processTime}><Ionicons name="time-outline" size={14} color="#4D7F78" /><Text style={styles.processTimeText}>{service.steps.reduce((total, step) => total + Number(step.estimatedMinutes), 0)} phút dự kiến</Text></View>
            </View>
            <View style={styles.steps}>
              {service.steps.map((step, index) => <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepNumber, index % 2 === 1 && styles.stepNumberAlt]}><Text style={styles.stepNumberText}>{step.stepNumber}</Text></View>
                  {index < service.steps!.length - 1 && <View style={styles.stepLine} />}
                </View>
                <View style={styles.stepContent}><View style={styles.stepTitleRow}><Text style={styles.stepTitle}>{step.title}</Text>{step.estimatedMinutes > 0 && <Text style={styles.stepMinutes}>{step.estimatedMinutes} phút</Text>}</View>{step.description && <Text style={styles.stepDescription}>{step.description}</Text>}</View>
              </View>)}
            </View>
          </View>}

          <View style={styles.detailSection}>
            <View style={styles.simpleHeader}><Text style={styles.sectionTitle}>Chọn kỹ thuật viên</Text><Pressable onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id } })}><Text style={styles.simpleLink}>Xem tất cả  ›</Text></Pressable></View>
            {service.availableStaff?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffList}>
              {service.availableStaff.map((staff) => {
                const selected = selectedStaffId === staff.id;
                return <Pressable key={staff.id} onPress={() => setSelectedStaffId(staff.id)} style={[styles.staffCard, selected && styles.staffCardSelected]}>
                  {staff.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.staffAvatar} /> : <View style={styles.staffAvatarFallback}><Text style={styles.staffInitial}>{staff.name.charAt(0)}</Text></View>}
                  <View style={styles.staffInfo}><Text numberOfLines={1} style={styles.staffName}>{staff.name}</Text><View style={styles.staffRating}><Ionicons name="star" size={12} color="#E2A22E" /><Text style={styles.staffRatingText}>{Number(staff.rating).toFixed(1)}</Text></View><Text numberOfLines={1} style={styles.staffSpecialty}>{staff.specialty}</Text></View>
                  {selected && <Ionicons name="checkmark-circle" size={18} color="#C25573" />}
                </Pressable>;
              })}
            </ScrollView> : <Text style={styles.emptySection}>Chưa có kỹ thuật viên nhận dịch vụ này.</Text>}
          </View>

          <View style={styles.detailSection}>
            <View style={styles.simpleHeader}><Text style={styles.sectionTitle}>Đánh giá khách hàng</Text>{!!service.reviews?.length && <Text style={styles.simpleLink}>Xem tất cả  ›</Text>}</View>
            {service.reviews?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewList}>
              {service.reviews.map((review) => <View key={review.id} style={styles.reviewCard}><View style={styles.reviewHeader}>{review.customerAvatarUrl ? <Image source={{ uri: review.customerAvatarUrl }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><Text style={styles.reviewInitial}>{review.customerName.charAt(0)}</Text></View>}<View style={styles.reviewIdentity}><Text style={styles.reviewName}>{review.customerName}</Text><View style={styles.reviewStars}>{Array.from({ length: 5 }).map((_, index) => <Ionicons key={index} name={index < review.rating ? 'star' : 'star-outline'} size={11} color="#E2A22E" />)}</View></View><Text style={styles.reviewDate}>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</Text></View>{review.comment && <Text numberOfLines={3} style={styles.reviewComment}>{review.comment}</Text>}{review.imageUrl && <Image source={{ uri: review.imageUrl }} style={styles.reviewImage} />}</View>)}
            </ScrollView> : <View style={styles.noReview}><Ionicons name="chatbubble-ellipses-outline" size={22} color="#7D9691" /><Text style={styles.noReviewText}>Chưa có đánh giá thật cho dịch vụ này.</Text></View>}
          </View>

          {!!service.relatedServices?.length && <View style={styles.detailSection}>
            <View style={styles.simpleHeader}><Text style={styles.sectionTitle}>Mẫu liên quan</Text><Pressable onPress={() => router.push('/services')}><Text style={styles.simpleLink}>Xem tất cả  ›</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
              {service.relatedServices.map((related) => <Pressable key={related.id} onPress={() => router.push({ pathname: '/service/[id]', params: { id: related.id } })} style={styles.relatedCard}>{related.imageUrl ? <Image source={{ uri: related.imageUrl }} style={styles.relatedImage} /> : <View style={styles.relatedImagePlaceholder} />}<Text numberOfLines={1} style={styles.relatedName}>{related.name}</Text><Text style={styles.relatedPrice}>{Number(related.price).toLocaleString('vi-VN')}đ</Text></Pressable>)}
            </ScrollView>
          </View>}
        </View>
      </ScrollView>

      <View style={styles.footer}><View><Text style={styles.footerLabel}>Giá dịch vụ</Text><Text style={styles.footerPrice}>{service.price.toLocaleString('vi-VN')}đ</Text></View><Pressable onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: service.id, staffId: selectedStaffId || undefined } })} style={({ pressed }) => [styles.bookButton, pressed && styles.bookPressed]}><Ionicons name="calendar-outline" size={19} color="#FFF" /><Text style={styles.bookText}>Đặt lịch ngay</Text></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDF8' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#FFFDF8' }, loading: { color: '#7B7474', fontSize: 12, marginTop: 12 }, errorTitle: { color: '#44383B', fontSize: 18, fontWeight: '800', marginTop: 12 }, errorText: { color: '#86777B', fontSize: 12, textAlign: 'center', marginTop: 5 }, backHome: { marginTop: 18, backgroundColor: '#4D948A', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 }, backHomeText: { color: '#FFF', fontWeight: '800' },
  header: { height: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFDF8', borderBottomWidth: 1, borderBottomColor: '#EEEAE2' }, headerButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 7 }, logo: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E7B4C2', alignItems: 'center', justifyContent: 'center' }, brandName: { color: '#363032', fontSize: 17, fontWeight: '700' }, brandAccent: { color: '#B95070' }, location: { flexDirection: 'row', alignItems: 'center', gap: 2 }, locationText: { color: '#76817E', fontSize: 7 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 7 }, notificationDot: { position: 'absolute', right: 6, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#E45F70' }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DDEEEA', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#397B73', fontWeight: '800' },
  scrollContent: { paddingBottom: 18 }, galleryRow: { height: 256, margin: 14, flexDirection: 'row', gap: 8 }, gallerySection: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#E8EEE9' }, heroImage: { width: '100%', height: '100%' }, favoriteButton: { position: 'absolute', top: 11, right: 11, width: 39, height: 39, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.94)', alignItems: 'center', justifyContent: 'center' }, bestSeller: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3D8', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 }, bestSellerText: { color: '#96651F', fontSize: 8, fontWeight: '800' }, counter: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(42,50,48,.68)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 }, counterText: { color: '#FFF', fontSize: 9, fontWeight: '700' }, verticalThumbnails: { width: 69, gap: 7 }, verticalThumbnailWrap: { flex: 1, padding: 2, borderRadius: 13, borderWidth: 2, borderColor: '#E8E3DB', overflow: 'hidden', backgroundColor: '#FFF' }, verticalThumbnailActive: { borderColor: '#4D948A' }, verticalThumbnail: { width: '100%', height: '100%', borderRadius: 9 }, moreOverlay: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 9, backgroundColor: 'rgba(49,58,56,.48)', alignItems: 'center', justifyContent: 'center' }, moreText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: 17 }, categoryRating: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, categoryPill: { backgroundColor: '#E3F1EE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }, categoryText: { color: '#397B73', fontSize: 8, fontWeight: '900', letterSpacing: .7 }, rating: { flexDirection: 'row', alignItems: 'center', gap: 3 }, ratingValue: { color: '#3D3638', fontSize: 12, fontWeight: '800' }, reviewCount: { color: '#92898B', fontSize: 9 }, title: { color: '#30282A', fontSize: 25, fontWeight: '800', marginTop: 10 }, priceLine: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 7 }, price: { color: '#D15D68', fontSize: 22, fontWeight: '900' }, duration: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E7F3F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }, durationText: { color: '#397B73', fontSize: 11, fontWeight: '700' },
  recommendation: { marginTop: 16, minHeight: 68, padding: 12, borderRadius: 17, backgroundColor: '#F4EFF9', borderWidth: 1, borderColor: '#E9DDF2', flexDirection: 'row', alignItems: 'center', gap: 10 }, recommendIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FCE8EC', alignItems: 'center', justifyContent: 'center' }, recommendCopy: { flex: 1 }, recommendTitle: { color: '#57445D', fontSize: 12, fontWeight: '800' }, recommendText: { color: '#807184', fontSize: 9, lineHeight: 13, marginTop: 2 },
  descriptionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19 }, sectionTitle: { color: '#342D2F', fontSize: 17, fontWeight: '800' }, expandButton: { flexDirection: 'row', alignItems: 'center', gap: 2 }, expandText: { color: '#397B73', fontSize: 10, fontWeight: '700' }, description: { color: '#776E70', fontSize: 11, lineHeight: 18, marginTop: 8 }, benefitTitle: { marginTop: 20, marginBottom: 10 }, benefitList: { gap: 8, paddingBottom: 4 }, benefitCard: { width: 94, minHeight: 91, padding: 9, borderRadius: 15, borderWidth: 1, alignItems: 'center' }, benefitIcon: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, benefitName: { color: '#4A4143', fontSize: 10, fontWeight: '800', marginTop: 6 }, benefitSubtitle: { color: '#8A7F82', fontSize: 8, marginTop: 2, textAlign: 'center' },
  processSection: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E8E3DC' }, processHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, processTime: { flexDirection: 'row', alignItems: 'center', gap: 4 }, processTimeText: { color: '#4D7F78', fontSize: 10, fontWeight: '600' }, steps: { paddingLeft: 2 }, stepRow: { flexDirection: 'row', minHeight: 79 }, stepRail: { width: 36, alignItems: 'center' }, stepNumber: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center' }, stepNumberAlt: { backgroundColor: '#F2E7D2' }, stepNumberText: { color: '#3E6F68', fontSize: 11, fontWeight: '800' }, stepLine: { width: 1, flex: 1, backgroundColor: '#D9D6CF', marginVertical: 4 }, stepContent: { flex: 1, paddingLeft: 10, paddingBottom: 17 }, stepTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, stepTitle: { flex: 1, color: '#3A3234', fontSize: 13, fontWeight: '700', lineHeight: 18 }, stepMinutes: { color: '#9A7A43', fontSize: 9, marginTop: 2 }, stepDescription: { color: '#7E7577', fontSize: 10, lineHeight: 15, marginTop: 4, paddingRight: 5 },
  detailSection: { marginTop: 25, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E8E3DC' }, simpleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, simpleLink: { color: '#B8506E', fontSize: 10, fontWeight: '600' }, emptySection: { color: '#847A7D', fontSize: 11, paddingVertical: 12 },
  staffList: { gap: 9 }, staffCard: { width: 185, minHeight: 83, padding: 10, borderWidth: 1, borderColor: '#E5E1DA', backgroundColor: '#FFFDF9', flexDirection: 'row', alignItems: 'center', gap: 9 }, staffCardSelected: { borderColor: '#C25573', backgroundColor: '#FFF3F6' }, staffAvatar: { width: 52, height: 52, borderRadius: 26 }, staffAvatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E1EFEC', alignItems: 'center', justifyContent: 'center' }, staffInitial: { color: '#397B73', fontSize: 18, fontWeight: '800' }, staffInfo: { flex: 1 }, staffName: { color: '#3A3234', fontSize: 13, fontWeight: '800' }, staffRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }, staffRatingText: { color: '#665B5E', fontSize: 10, fontWeight: '700' }, staffSpecialty: { color: '#8A7E81', fontSize: 8, marginTop: 4 },
  reviewList: { gap: 10 }, reviewCard: { width: 265, minHeight: 122, padding: 12, borderWidth: 1, borderColor: '#E8E3DC', backgroundColor: '#FFF' }, reviewHeader: { flexDirection: 'row', alignItems: 'center' }, reviewAvatar: { width: 36, height: 36, borderRadius: 18 }, reviewAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2E7D6', alignItems: 'center', justifyContent: 'center' }, reviewInitial: { color: '#946B2E', fontWeight: '800' }, reviewIdentity: { flex: 1, marginLeft: 8 }, reviewName: { color: '#3D3436', fontSize: 11, fontWeight: '800' }, reviewStars: { flexDirection: 'row', marginTop: 3 }, reviewDate: { color: '#A1989A', fontSize: 8 }, reviewComment: { color: '#71676A', fontSize: 10, lineHeight: 15, marginTop: 9 }, reviewImage: { width: 48, height: 48, marginTop: 8 }, noReview: { height: 58, backgroundColor: '#F1F6F4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 }, noReviewText: { color: '#687B77', fontSize: 10 },
  relatedList: { gap: 10 }, relatedCard: { width: 132, paddingBottom: 8, backgroundColor: '#FAF7EF', borderWidth: 1, borderColor: '#EEE8DA' }, relatedImage: { width: 130, height: 96 }, relatedImagePlaceholder: { width: 130, height: 96, backgroundColor: '#E5EFEC' }, relatedName: { color: '#443A3D', fontSize: 10, fontWeight: '700', marginTop: 7, paddingHorizontal: 7 }, relatedPrice: { color: '#B8506E', fontSize: 11, fontWeight: '800', marginTop: 3, paddingHorizontal: 7 },
  footer: { paddingHorizontal: 17, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#EBE7DE', backgroundColor: '#FFFDF9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, footerLabel: { color: '#91878A', fontSize: 9 }, footerPrice: { color: '#C25573', fontSize: 18, fontWeight: '900', marginTop: 2 }, bookButton: { minWidth: 190, height: 48, borderRadius: 24, backgroundColor: '#C25573', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, bookPressed: { opacity: .75 }, bookText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
