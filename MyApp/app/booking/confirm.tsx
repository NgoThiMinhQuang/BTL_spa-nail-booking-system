import { fetchAvailability } from '@/features/booking/booking.service';
import { fetchServiceById } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { fetchStaffById } from '@/features/staff/staff.service';
import type { StaffDetail } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background: '#FFF8F8', surface: '#FFFFFF', primary: '#D54C72', primaryDark: '#B92F5B', primarySoft: '#FCE8ED', sage: '#557C72', gold: '#E8A521', text: '#28242E', muted: '#6D6874', line: '#EEE4E6' };
const DISPLAY_SLOTS = Array.from({ length: 19 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDays() {
  return Array.from({ length: 14 }, (_, index) => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + index);
    return { key: dateKey(value), label: value.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'), number: value.getDate(), month: value.getMonth() + 1, year: value.getFullYear() };
  });
}

export default function ConfirmBookingScreen() {
  const { serviceId = '', staffId = '' } = useLocalSearchParams<{ serviceId?: string; staffId?: string }>();
  const days = useMemo(() => buildDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0].key);
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [service, setService] = useState<NailService | null>(null);
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(days[0].key + 'T00:00:00'));

  useEffect(() => {
    Promise.all([fetchServiceById(serviceId), fetchStaffById(staffId), fetchAvailability(serviceId, staffId, days[0].key)])
      .then(([serviceData, staffData, availability]) => { setService(serviceData); setStaff(staffData); setSlots(availability.slots); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin đặt lịch.'))
      .finally(() => setLoading(false));
  }, [days, serviceId, staffId]);

  const chooseDate = (date: string) => {
    setSelectedDate(date); setSelectedTime(''); setLoading(true); setError('');
    fetchAvailability(serviceId, staffId, date)
      .then((availability) => setSlots(availability.slots))
      .catch((reason: unknown) => { setSlots([]); setError(reason instanceof Error ? reason.message : 'Không tải được giờ trống.'); })
      .finally(() => setLoading(false));
  };

  const slotGroups = useMemo(() => [
    { title: 'Buổi sáng', slots: DISPLAY_SLOTS.filter((time) => Number(time.slice(0, 2)) < 12) },
    { title: 'Buổi chiều', slots: DISPLAY_SLOTS.filter((time) => { const hour = Number(time.slice(0, 2)); return hour >= 12 && hour < 17; }) },
    { title: 'Buổi tối', slots: DISPLAY_SLOTS.filter((time) => Number(time.slice(0, 2)) >= 17) },
  ], []);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: count }, (_, index) => {
      const value = new Date(year, month, index + 1);
      return { number: index + 1, key: dateKey(value), enabled: days.some((day) => day.key === dateKey(value)) };
    })];
  }, [calendarMonth, days]);

  const continueToReview = () => {
    if (!selectedTime) return;
    router.push({ pathname: '/booking/review', params: { serviceId, staffId, date: selectedDate, time: selectedTime, demo: slots.length ? '0' : '1' } });
  };

  if (loading && !service) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.stateText}>Đang chuẩn bị lịch trống...</Text></SafeAreaView>;

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={COLORS.primary} /></Pressable><Text style={styles.title}>Đặt lịch làm đẹp</Text><View style={styles.iconButton} /></View>

    <View style={styles.progress}><View style={styles.progressTrack} /><View style={styles.progressTrackDone} />{[1, 2, 3, 4].map((step) => step === 1 ? <View key={step} style={[styles.step, styles.stepDone]}><Ionicons name="checkmark" size={17} color="#FFF" /></View> : <View key={step} style={[styles.step, step === 2 && styles.stepActive]}><Text style={[styles.stepNumber, step === 2 && styles.stepNumberActive]}>{step}</Text></View>)}</View>
    <View style={styles.stepLabels}><Text style={styles.stepLabel}>Chọn dịch vụ{`\n`}Nhân viên</Text><Text style={[styles.stepLabel, styles.stepLabelActive]}>Chọn ngày{`\n`}giờ</Text><Text style={styles.stepLabel}>Xác nhận{`\n`}thông tin</Text><Text style={styles.stepLabel}>Hoàn tất</Text></View>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={20} color={COLORS.primary} /><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.staffCard}>
        {staff?.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.staffImage} /> : <View style={[styles.staffImage, styles.fallback]}><Text style={styles.initial}>{staff?.name.charAt(0)}</Text></View>}
        <View style={styles.staffInfo}><View style={styles.rowBetween}><Text numberOfLines={1} style={styles.staffName}>{staff?.name}</Text><Pressable onPress={() => router.replace({ pathname: '/booking/select-service', params: { staffId } })} style={styles.changeButton}><Text style={styles.changeText}>Thay đổi</Text></Pressable></View><View style={styles.ratingRow}><Ionicons name="star" size={17} color={COLORS.gold} /><Text style={styles.rating}>{staff?.rating.toFixed(1)}</Text><Text style={styles.reviews}>({staff?.reviewCount} đánh giá)</Text></View><View style={styles.metaRow}><Ionicons name="briefcase" size={17} color={COLORS.muted} /><Text style={styles.metaText}>{staff?.experienceYears} năm kinh nghiệm</Text></View><View style={styles.metaRow}><Ionicons name="ribbon-outline" size={18} color={COLORS.sage} /><Text numberOfLines={1} style={styles.metaText}>Chuyên: {staff?.services.slice(0, 2).map((item) => item.name).join(', ')}</Text></View></View>
      </View>

      <View style={styles.serviceCard}>
        {service?.imageUrl ? <Image source={{ uri: service.imageUrl }} style={styles.serviceImage} /> : <View style={[styles.serviceImage, styles.fallback]}><Ionicons name="sparkles" size={25} color={COLORS.primary} /></View>}
        <View style={styles.serviceInfo}><Text style={styles.serviceName}>{service?.name}</Text><Text numberOfLines={1} style={styles.serviceDescription}>{service?.description}</Text><View style={styles.serviceMeta}><Text style={styles.price}>{service?.price.toLocaleString('vi-VN')} đ</Text><Text style={styles.separator}>|</Text><Ionicons name="time-outline" size={17} color={COLORS.muted} /><Text style={styles.duration}>{service?.duration} phút</Text></View></View>
        <Pressable onPress={() => router.replace({ pathname: '/booking/select-service', params: { staffId } })} style={styles.changeButton}><Text style={styles.changeText}>Thay đổi</Text></Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}><View style={styles.panelTitleRow}><Ionicons name="calendar" size={22} color={COLORS.primary} /><Text style={styles.panelTitle}>Chọn ngày</Text></View><View style={styles.monthNav}><Text style={styles.month}>Tháng {calendarMonth.getMonth() + 1}, {calendarMonth.getFullYear()}</Text><Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} hitSlop={8}><Ionicons name="chevron-back" size={20} color={COLORS.text} /></Pressable><Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={COLORS.text} /></Pressable></View></View>
        <View style={styles.weekdays}>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>{calendarCells.map((item, index) => item ? <Pressable key={item.key} disabled={!item.enabled} onPress={() => chooseDate(item.key)} style={[styles.calendarDay, item.key === selectedDate && styles.calendarDayActive]}><Text style={[styles.calendarDayText, !item.enabled && styles.calendarDayDisabled, item.key === selectedDate && styles.calendarDayTextActive]}>{item.number}</Text>{item.enabled && <View style={[styles.calendarDot, item.key === selectedDate && styles.calendarDotActive]} />}</Pressable> : <View key={`blank-${index}`} style={styles.calendarDay} />)}</View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelTitleRow}><Ionicons name="time-outline" size={24} color={COLORS.primary} /><Text style={styles.panelTitle}>Chọn giờ</Text></View>
        {loading ? <ActivityIndicator style={styles.slotLoader} color={COLORS.primary} /> : <>{!slots.length && <View style={styles.demoNotice}><Ionicons name="flask-outline" size={18} color={COLORS.primary} /><Text style={styles.demoNoticeText}>Đang dùng khung giờ mẫu để xem trước giao diện.</Text></View>}{slotGroups.map((group) => <View key={group.title} style={styles.timeGroup}><Text style={styles.timeGroupTitle}>{group.title}</Text><View style={styles.slots}>{group.slots.map((time) => { const active = selectedTime === time; const available = !slots.length || slots.includes(time); return <Pressable key={time} disabled={!available} onPress={() => setSelectedTime(time)} style={[styles.slot, !available && styles.slotDisabled, active && styles.slotActive]}><Text style={[styles.slotText, !available && styles.slotTextDisabled, active && styles.slotTextActive]}>{time}</Text></Pressable>; })}</View></View>)}</>}
        <View style={styles.notice}><View style={styles.noticeIcon}><Text style={styles.noticeMark}>!</Text></View><Text style={styles.noticeText}>Thời gian làm dịch vụ: <Text style={styles.noticeStrong}>{service?.duration} phút</Text>{`\n`}Vui lòng đến sớm 10 phút để được phục vụ tốt nhất.</Text><Ionicons name="flower-outline" size={23} color="#F4BBC9" /></View>
      </View>
    </ScrollView>

    <View style={styles.footer}><Pressable disabled={!selectedTime} onPress={continueToReview} style={[styles.continueButton, !selectedTime && styles.disabled]}><Text style={styles.continueText}>Tiếp tục</Text><Ionicons name="arrow-forward" size={22} color="#FFF" /></Pressable></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, center: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 10 }, stateText: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  progress: { height: 43, marginTop: 5, marginHorizontal: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressTrack: { position: 'absolute', left: 14, right: 14, top: 21, height: 2, backgroundColor: '#DDDADD' }, progressTrackDone: { position: 'absolute', left: 14, top: 21, width: '33%', height: 2, backgroundColor: '#42A66C' }, step: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#EDEBED', alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: '#42A66C' }, stepActive: { backgroundColor: COLORS.primary }, stepNumber: { color: COLORS.text, fontSize: 13, fontWeight: '800' }, stepNumberActive: { color: '#FFF' }, stepLabels: { marginHorizontal: 18, flexDirection: 'row' }, stepLabel: { flex: 1, color: COLORS.muted, fontSize: 10, lineHeight: 14, textAlign: 'center' }, stepLabelActive: { color: COLORS.text, fontWeight: '800' },
  content: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 105, gap: 11 }, errorBox: { padding: 12, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: COLORS.primaryDark, fontSize: 12 },
  staffCard: { minHeight: 132, padding: 9, backgroundColor: '#FFF', flexDirection: 'row' }, staffImage: { width: 108, minHeight: 114, resizeMode: 'cover' }, fallback: { backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' }, initial: { color: COLORS.primary, fontSize: 34, fontWeight: '800' }, staffInfo: { flex: 1, paddingLeft: 14, paddingVertical: 4 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, staffName: { maxWidth: '60%', color: COLORS.text, fontSize: 19, fontWeight: '800' }, changeButton: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS.primarySoft }, changeText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '800' }, ratingRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, rating: { color: COLORS.text, fontSize: 13, fontWeight: '800' }, reviews: { color: COLORS.muted, fontSize: 11 }, metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }, metaText: { flex: 1, color: COLORS.muted, fontSize: 11 },
  serviceCard: { minHeight: 94, padding: 9, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, serviceImage: { width: 78, height: 76, resizeMode: 'cover' }, serviceInfo: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 3 }, serviceName: { color: COLORS.text, fontSize: 16, fontWeight: '800' }, serviceDescription: { color: COLORS.muted, fontSize: 11, marginTop: 5 }, serviceMeta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7 }, price: { color: COLORS.primaryDark, fontSize: 15, fontWeight: '800' }, separator: { color: '#AAA2A8', fontSize: 15 }, duration: { color: COLORS.muted, fontSize: 12 },
  panel: { padding: 14, backgroundColor: '#FFF' }, panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, panelTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' }, monthNav: { flexDirection: 'row', alignItems: 'center', gap: 9 }, month: { color: COLORS.text, fontSize: 12, fontWeight: '700' }, weekdays: { marginTop: 17, flexDirection: 'row' }, weekday: { width: '14.285%', color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' }, calendarGrid: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap' }, calendarDay: { width: '14.285%', height: 39, alignItems: 'center', justifyContent: 'center' }, calendarDayActive: { backgroundColor: COLORS.primary }, calendarDayText: { color: COLORS.text, fontSize: 13, fontWeight: '700' }, calendarDayDisabled: { color: '#C7C2C6', fontWeight: '500' }, calendarDayTextActive: { color: '#FFF' }, calendarDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: '#EFA7B8' }, calendarDotActive: { backgroundColor: '#FFF' },
  timeGroup: { marginTop: 15 }, timeGroupTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }, slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, slot: { width: '23.2%', height: 42, borderWidth: 1, borderColor: '#DCD6DA', alignItems: 'center', justifyContent: 'center' }, slotDisabled: { backgroundColor: '#F7F5F6', borderColor: '#EEE9EC' }, slotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, slotText: { color: COLORS.text, fontSize: 12 }, slotTextDisabled: { color: '#B9B2B7' }, slotTextActive: { color: '#FFF', fontWeight: '800' }, slotLoader: { height: 90 }, empty: { paddingVertical: 32, alignItems: 'center', gap: 8 }, noAvailability: { marginTop: 14, padding: 10, backgroundColor: '#EFF5F2', flexDirection: 'row', alignItems: 'center', gap: 7 }, noAvailabilityText: { flex: 1, color: COLORS.sage, fontSize: 11, lineHeight: 15 }, demoNotice: { marginTop: 14, padding: 10, backgroundColor: '#FFF2D9', flexDirection: 'row', alignItems: 'center', gap: 7 }, demoNoticeText: { flex: 1, color: '#866624', fontSize: 11, lineHeight: 15 }, notice: { minHeight: 62, marginTop: 16, paddingHorizontal: 10, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 10 }, noticeIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EF758E', alignItems: 'center', justifyContent: 'center' }, noticeMark: { color: '#FFF', fontSize: 17, fontWeight: '800' }, noticeText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 16 }, noticeStrong: { color: COLORS.text, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,.97)', borderTopWidth: 1, borderTopColor: COLORS.line }, continueButton: { height: 54, borderRadius: 27, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, disabled: { opacity: .4 }, continueText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
