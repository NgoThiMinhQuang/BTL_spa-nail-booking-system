import { cancelBooking, fetchBookings, submitReview } from '@/features/booking/booking.service';
import type { Booking } from '@/features/booking/booking.types';
import { ApiError } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Filter = 'upcoming' | 'completed' | 'cancelled';

const filters: { key: Filter; label: string }[] = [
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'completed', label: 'Đã hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

function formatAppointment(value: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
  const calendarDate = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return { date: `${weekday}, ${calendarDate}`, time };
}

function BookingCard({ booking, filter, onChanged }: { booking: Booking; filter: Filter; onChanged: () => void }) {
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const starts = formatAppointment(booking.startsAt);
  const ends = formatAppointment(booking.endsAt);
  const isUpcoming = filter === 'upcoming';
  const isCompleted = filter === 'completed';

  /* Hủy lịch của chính mình. Luật ở backend (PENDING luôn được,
     CONFIRMED còn trên 2 giờ) nên ở đây chỉ hỏi lại cho chắc, lỗi hiện
     nguyên văn để khách biết vì sao. */
  function askCancel() {
    Alert.alert(
      'Hủy lịch hẹn',
      `Hủy lịch ${booking.serviceName ?? ''} lúc ${starts.time} ngày ${starts.date}?`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Hủy lịch', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setMessage('');
            try {
              await cancelBooking(booking.id);
              onChanged();
            } catch (e) {
              setMessage(e instanceof ApiError ? e.message : 'Không hủy được. Hãy thử lại.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  /* Đánh giá sau khi hoàn thành — mỗi lịch một lần, backend chặn đánh
     giá trùng (409). Trước đây nút này không gắn gì nên bấm không có
     tác dụng. */
  async function sendReview() {
    if (!rating) {
      setMessage('Hãy chọn số sao đánh giá.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await submitReview(booking.id, { rating, comment: comment.trim() || undefined });
      setShowReview(false);
      setMessage('Cảm ơn đánh giá của bạn!');
      onChanged();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Không gửi được đánh giá. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Image
        source={booking.serviceImageUrl ? { uri: booking.serviceImageUrl } : require('@/assets/images/nails/nail-collection-v2.png')}
        style={styles.serviceImage}
      />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.serviceName}>{booking.serviceName ?? 'Dịch vụ làm móng'}</Text>
          <Pressable hitSlop={10} onPress={() => setFavorite((value) => !value)}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color="#D97991" />
          </Pressable>
        </View>
        <Text style={styles.price}>{(booking.price ?? 0).toLocaleString('vi-VN')}đ</Text>
        <View style={styles.metaRow}><Ionicons name="calendar-outline" size={14} color="#7E6F73" /><Text style={styles.metaText}>{starts.date}</Text></View>
        <View style={styles.metaRow}><Ionicons name="time-outline" size={14} color="#7E6F73" /><Text style={styles.metaText}>{starts.time} - {ends.time}</Text></View>
        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={styles.staffText}>Nhân viên: {booking.staffName ?? 'Đang cập nhật'}</Text>
          {isUpcoming && <Pressable onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: booking.serviceId } })} style={[styles.actionButton, styles.pinkButton]}><Text style={styles.actionText}>Đổi lịch hẹn</Text></Pressable>}
          {isUpcoming && <Pressable disabled={busy} onPress={askCancel} style={[styles.actionButton, styles.redButton]}><Text style={styles.actionText}>Hủy</Text></Pressable>}
          {isCompleted && <Pressable disabled={busy} onPress={() => { setShowReview((v) => !v); setMessage(''); }} style={[styles.actionButton, styles.greenButton]}><Text style={styles.actionText}>Đánh giá</Text></Pressable>}
          {filter === 'cancelled' && <Pressable onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: booking.serviceId } })} style={[styles.actionButton, styles.grayButton]}><Text style={styles.grayButtonText}>Đặt lại</Text></Pressable>}
        </View>
        {!!message && <Text style={styles.cardMessage}>{message}</Text>}
        {isCompleted && showReview && (
          <View style={styles.reviewBox}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} hitSlop={8} onPress={() => setRating(star)}>
                  <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={26} color="#E5A62B" />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Chia sẻ cảm nhận (không bắt buộc)…"
              placeholderTextColor="#B5A5AF"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <Pressable disabled={busy} onPress={sendReview} style={[styles.actionButton, styles.greenButton, styles.reviewSend]}>
              <Text style={styles.actionText}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  /* Hiện đúng lý do thay vì một câu chung chung. Trước đây mọi lỗi đều hiện
     "kiểm tra kết nối máy chủ" nên không phân biệt được mất mạng (API_URL sai)
     với token sai (đăng nhập nhân viên trên app khách bị 403). */
  const toMessage = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 401) return 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.';
      return e.message || `Máy chủ trả lỗi ${e.status}.`;
    }
    return 'Không thể tải lịch hẹn. Hãy kiểm tra kết nối máy chủ.';
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { setBookings(await fetchBookings()); setError(''); }
    catch (e) { setError(toMessage(e)); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchBookings()
      .then((data) => { if (active) { setBookings(data); setError(''); } })
      .catch((e) => { if (active) setError(toMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    if (filter === 'completed') return booking.status === 'completed' || (new Date(booking.endsAt).getTime() < now && !['cancelled', 'no_show'].includes(booking.status));
    if (filter === 'cancelled') return booking.status === 'cancelled' || booking.status === 'no_show';
    return new Date(booking.endsAt).getTime() >= now && ['pending', 'confirmed', 'processing'].includes(booking.status);
  }), [bookings, filter, now]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.headerSide} onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color="#252124" /></Pressable>
        <Text style={styles.title}>Lịch hẹn của tôi</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.tabs}>
        {filters.map((item) => {
          const active = item.key === filter;
          return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{item.label}</Text></Pressable>;
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#D56B81" />}
        contentContainerStyle={styles.content}>
        {loading && <View style={styles.state}><ActivityIndicator size="large" color="#D56B81" /><Text style={styles.stateText}>Đang tải lịch hẹn...</Text></View>}
        {!loading && !!error && <View style={styles.state}><Ionicons name="cloud-offline-outline" size={38} color="#C66B7F" /><Text style={styles.stateTitle}>Không thể tải dữ liệu</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retryButton} onPress={refresh}><Text style={styles.retryText}>Thử lại</Text></Pressable></View>}
        {!loading && !error && visibleBookings.length === 0 && <View style={styles.state}><View style={styles.emptyIcon}><Ionicons name="calendar-outline" size={36} color="#D5738A" /></View><Text style={styles.stateTitle}>Chưa có lịch hẹn</Text><Text style={styles.stateText}>{filter === 'upcoming' ? 'Bạn chưa có lịch hẹn sắp tới.' : filter === 'completed' ? 'Chưa có lịch hẹn đã hoàn thành.' : 'Bạn chưa hủy lịch hẹn nào.'}</Text>{filter === 'upcoming' && <Pressable style={styles.bookButton} onPress={() => router.push('/booking/select-service')}><Text style={styles.bookText}>Đặt lịch ngay</Text></Pressable>}</View>}
        {visibleBookings.map((booking) => <BookingCard key={booking.id} booking={booking} filter={filter} onChanged={refresh} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF9FA' },
  header: { height: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#201C1E', fontSize: 26, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 18 },
  tab: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: '#D56B81', shadowColor: '#D56B81', shadowOpacity: .2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  tabText: { color: '#766A6E', fontSize: 14, fontWeight: '600' }, activeTabText: { color: '#FFF', fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 17 },
  card: { minHeight: 184, padding: 15, borderRadius: 18, backgroundColor: '#FFF', flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#F7ECEF', shadowColor: '#9D7781', shadowOpacity: .07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  serviceImage: { width: 108, height: 108, borderRadius: 13, backgroundColor: '#F4E5E9' },
  cardBody: { flex: 1 }, nameRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 8 }, serviceName: { flex: 1, color: '#30292B', fontSize: 17, fontWeight: '800' },
  price: { color: '#242022', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }, metaText: { color: '#756A6D', fontSize: 14, fontWeight: '500' },
  bottomRow: { minHeight: 40, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 }, staffText: { flex: 1, color: '#84787B', fontSize: 14 },
  actionButton: { minWidth: 92, height: 36, paddingHorizontal: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, pinkButton: { backgroundColor: '#F3A8B9' }, greenButton: { backgroundColor: '#86CBAE' }, grayButton: { backgroundColor: '#F0EAEC' }, redButton: { backgroundColor: '#E08080' }, actionText: { color: '#FFF', fontSize: 13, fontWeight: '800' }, grayButtonText: { color: '#8D6570', fontSize: 13, fontWeight: '800' },
  state: { minHeight: 310, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FBE7EC', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, stateTitle: { color: '#372E31', fontSize: 19, fontWeight: '800', marginTop: 10 }, stateText: { color: '#8A7C80', fontSize: 14, lineHeight: 24, textAlign: 'center', marginTop: 7 },
  retryButton: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 18, backgroundColor: '#F7DFE5' }, retryText: { color: '#9A5065', fontWeight: '800', fontSize: 14 }, bookButton: { marginTop: 18, height: 44, paddingHorizontal: 24, borderRadius: 22, backgroundColor: '#D56B81', alignItems: 'center', justifyContent: 'center' }, bookText: { color: '#4D3540', fontWeight: '800', fontSize: 14 },
  cardMessage: { color: '#9A5065', fontSize: 13, marginTop: 6 },
  reviewBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3E2E7', gap: 8 },
  starsRow: { flexDirection: 'row', gap: 6 },
  reviewInput: { minHeight: 64, borderWidth: 1, borderColor: '#EFE5EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#261B20', backgroundColor: '#FFF', textAlignVertical: 'top' },
  reviewSend: { alignSelf: 'flex-start' },
});
