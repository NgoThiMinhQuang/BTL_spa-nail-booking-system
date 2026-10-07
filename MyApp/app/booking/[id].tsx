import { cancelBooking, fetchBookingDetail, submitReview } from '@/features/booking/booking.service';
import type { BookingDetail } from '@/features/booking/booking.types';
import { ApiError } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_TEXT: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
  const calendar = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return { date: `${weekday}, ${calendar}`, time };
}

function Row({ icon, label, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color="#7E6F73" />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setBooking(await fetchBookingDetail(String(id)));
    } catch {
      setError('Không tải được chi tiết lịch hẹn.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function askCancel() {
    if (!booking) return;
    Alert.alert('Hủy lịch hẹn', 'Bạn có chắc muốn hủy lịch này?', [
      { text: 'Giữ lại', style: 'cancel' },
      {
        text: 'Hủy lịch', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setMessage('');
          try {
            await cancelBooking(booking.id);
            await load();
          } catch (e) {
            setMessage(e instanceof ApiError ? e.message : 'Không hủy được. Hãy thử lại.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function sendReview() {
    if (!booking) return;
    if (!rating) {
      setMessage('Hãy chọn số sao đánh giá.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await submitReview(booking.id, { rating, comment: comment.trim() || undefined });
      setShowReview(false);
      await load();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Không gửi được đánh giá. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#D56B81" />
        <Text style={styles.hint}>Đang tải chi tiết…</Text>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={38} color="#C66B7F" />
        <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
        <Text style={styles.hint}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const starts = formatDateTime(booking.startsAt);
  const ends = formatDateTime(booking.endsAt);
  const cancellable = ['pending', 'confirmed'].includes(booking.status);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.headerSide} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#252124" />
        </Pressable>
        <Text style={styles.title}>Chi tiết lịch hẹn</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image
          source={booking.serviceImageUrl ? { uri: booking.serviceImageUrl } : require('@/assets/images/nails/nail-collection-v2.png')}
          style={styles.banner}
        />

        <View style={styles.card}>
          <Text style={styles.serviceName}>{booking.serviceName ?? 'Dịch vụ làm móng'}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusPill}>{STATUS_TEXT[booking.status] ?? booking.status}</Text>
            <Text style={styles.price}>{(booking.total ?? 0).toLocaleString('vi-VN')}đ</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thời gian & nhân viên</Text>
          <Row icon="calendar-outline" label="Ngày">{<Text style={styles.rowText}>{starts.date}</Text>}</Row>
          <Row icon="time-outline" label="Giờ">{<Text style={styles.rowText}>{starts.time} - {ends.time}</Text>}</Row>
          <Row icon="person-outline" label="Nhân viên">
            {<Text style={styles.rowText}>{booking.staffName ?? 'Đang cập nhật'}{booking.staffPhone ? ` · ${booking.staffPhone}` : ''}</Text>}
          </Row>
          {!!booking.note && (
            <Row icon="document-text-outline" label="Ghi chú">{<Text style={styles.rowText}>{booking.note}</Text>}</Row>
          )}
          {!!booking.cancelReason && (
            <Row icon="close-circle-outline" label="Lý do hủy">{<Text style={styles.rowText}>{booking.cancelReason}</Text>}</Row>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <Row icon="card-outline" label="Trạng thái">
            {<Text style={styles.rowText}>
              {booking.paymentStatus === 'PAID' ? 'Đã thanh toán'
                : booking.paymentStatus === 'DEPOSITED'
                  ? `Đã cọc ${(booking.paidAmount ?? 0).toLocaleString('vi-VN')}đ`
                  : booking.paymentStatus === 'REFUNDED'
                    ? 'Đã hoàn cọc'
                    : 'Chưa thanh toán'}
            </Text>}
          </Row>
          <Row icon="cash-outline" label="Tổng tiền">{<Text style={styles.rowText}>{(booking.total ?? 0).toLocaleString('vi-VN')}đ</Text>}</Row>
          <Row icon="wallet-outline" label="Còn lại">{<Text style={styles.rowText}>{(booking.remaining ?? 0).toLocaleString('vi-VN')}đ</Text>}</Row>
        </View>

        {booking.addons.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dịch vụ phát sinh ({booking.addons.length})</Text>
            {booking.addons.map((addon) => (
              <View key={addon.id} style={styles.addonRow}>
                <Text style={styles.addonName}>{addon.name} ×{addon.quantity}</Text>
                <Text style={styles.addonPrice}>
                  {(addon.price * addon.quantity).toLocaleString('vi-VN')}đ
                </Text>
              </View>
            ))}
          </View>
        )}

        {booking.images.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ảnh mẫu đã gửi ({booking.images.length})</Text>
            <View style={styles.imagesRow}>
              {booking.images.map((image) => (
                <Image key={image.id} source={{ uri: image.url }} style={styles.thumb} />
              ))}
            </View>
          </View>
        )}

        {booking.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đánh giá</Text>
            {booking.review ? (
              <View>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name={star <= booking.review!.rating ? 'star' : 'star-outline'} size={20} color="#E5A62B" />
                  ))}
                </View>
                {!!booking.review.comment && <Text style={styles.reviewComment}>{booking.review.comment}</Text>}
              </View>
            ) : showReview ? (
              <View>
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
                <Pressable disabled={busy} onPress={sendReview} style={[styles.button, styles.greenButton, busy && styles.disabledButton]}>
                  <Text style={styles.buttonText}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable disabled={busy} onPress={() => setShowReview(true)} style={[styles.button, styles.greenButton]}>
                <Text style={styles.buttonText}>Đánh giá buổi làm</Text>
              </Pressable>
            )}
          </View>
        )}

        {!!message && <Text style={styles.message}>{message}</Text>}

        {cancellable && (
          <Pressable disabled={busy} onPress={askCancel} style={[styles.button, styles.redButton, busy && styles.disabledButton]}>
            <Text style={styles.buttonText}>Hủy lịch hẹn</Text>
          </Pressable>
        )}
        {booking.status === 'cancelled' && (
          <Pressable
            onPress={() => router.push({ pathname: '/booking/select-staff', params: { serviceId: booking.serviceId } })}
            style={[styles.button, styles.pinkButton]}
          >
            <Text style={styles.buttonText}>Đặt lại lịch mới</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF9FA' },
  center: { flex: 1, backgroundColor: '#FFF9FA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  hint: { color: '#8A7C80', fontSize: 14, textAlign: 'center' },
  errorTitle: { color: '#372E31', fontSize: 18, fontWeight: '700', marginTop: 10 },
  retryButton: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 18, backgroundColor: '#F7DFE5' },
  retryText: { color: '#9A5065', fontWeight: '700', fontSize: 14 },
  header: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#201C1E', fontSize: 20, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  banner: { width: '100%', height: 190, borderRadius: 18, backgroundColor: '#F4E5E9' },
  card: { padding: 15, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F7ECEF', gap: 4 },
  serviceName: { color: '#30292B', fontSize: 17, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  statusPill: { fontSize: 12, fontWeight: '600', color: '#9A5065', backgroundColor: '#F7DFE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  price: { color: '#D56B81', fontSize: 18, fontWeight: '800' },
  sectionTitle: { color: '#372E31', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  rowLabel: { color: '#A89A9E', fontSize: 13, width: 78 },
  rowValue: { flex: 1 },
  rowText: { color: '#30292B', fontSize: 14 },
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  addonName: { flex: 1, color: '#30292B', fontSize: 14 },
  addonPrice: { color: '#30292B', fontSize: 14, fontWeight: '600' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: '#F4E5E9' },
  starsRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  reviewComment: { color: '#5A4A52', fontSize: 14, lineHeight: 21, marginTop: 6 },
  reviewInput: { minHeight: 64, borderWidth: 1, borderColor: '#EFE5EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#261B20', backgroundColor: '#FFF', textAlignVertical: 'top', marginTop: 8 },
  message: { color: '#9A5065', fontSize: 13, textAlign: 'center' },
  button: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pinkButton: { backgroundColor: '#D56B81' },
  greenButton: { backgroundColor: '#43A66E' },
  redButton: { backgroundColor: '#CE4A62' },
  disabledButton: { opacity: 0.45 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
