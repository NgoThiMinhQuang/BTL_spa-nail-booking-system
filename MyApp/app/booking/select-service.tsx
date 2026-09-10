import { fetchServices } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { fetchStaff } from '@/features/staff/staff.service';
import type { StaffMember } from '@/features/staff/staff.types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#FFF8F8', surface: '#FFFFFF', primary: '#D44E73', primaryDark: '#B92F5C',
  primarySoft: '#FCE9EE', sage: '#587D73', sageSoft: '#E9F2EF', lavender: '#70637F',
  gold: '#E7A423', text: '#292530', muted: '#6F6877', line: '#F0E3E6',
};

export default function SelectServiceScreen() {
  const { staffId = '' } = useLocalSearchParams<{ staffId?: string }>();
  const [services, setServices] = useState<NailService[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(staffId);
  const [selectedId, setSelectedId] = useState('');
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchServices(), fetchStaff()])
      .then(([serviceData, staffData]) => {
        setServices(serviceData);
        setStaffList(staffData);
        setSelectedStaffId((current) => current && staffData.some((item) => item.id === current) ? current : (staffData[0]?.id ?? ''));
      })
      .catch(() => setError('Không thể tải thông tin đặt lịch từ máy chủ.'))
      .finally(() => setLoading(false));
  }, [staffId]);

  const staff = useMemo(() => staffList.find((item) => item.id === selectedStaffId) ?? null, [selectedStaffId, staffList]);

  const visibleServices = useMemo(() => {
    if (!staff) return [];
    const allowed = new Set(staff.services.map((service) => service.id));
    return services.filter((service) => allowed.has(service.id));
  }, [services, staff]);

  const continueBooking = () => {
    if (!selectedId || !selectedStaffId) return;
    router.push({ pathname: '/booking/confirm', params: { serviceId: selectedId, staffId: selectedStaffId } });
  };

  const chooseStaff = (id: string) => {
    setSelectedStaffId(id);
    setSelectedId('');
    setShowStaffPicker(false);
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.stateText}>Đang chuẩn bị dịch vụ...</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}><Ionicons name="arrow-back" size={23} color={COLORS.primary} /></Pressable>
        <Text style={styles.title}>Đặt lịch làm đẹp</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.progress}>
        {[1, 2, 3, 4].map((step) => <View key={step} style={styles.progressPart}>{step > 1 && <View style={styles.progressLine} />}<View style={[styles.step, step === 1 && styles.stepActive]}><Text style={[styles.stepNumber, step === 1 && styles.stepNumberActive]}>{step}</Text></View></View>)}
      </View>
      <View style={styles.stepLabels}><Text style={[styles.stepLabel, styles.stepLabelActive]}>Chọn dịch vụ{`\n`}Nhân viên</Text><Text style={styles.stepLabel}>Chọn ngày{`\n`}giờ</Text><Text style={styles.stepLabel}>Xác nhận{`\n`}thông tin</Text><Text style={styles.stepLabel}>Hoàn tất</Text></View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!!error && <View style={styles.error}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.primary} /><Text style={styles.errorText}>{error}</Text></View>}

        {staff && <View style={styles.staffCard}>
          {staff.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.staffPhoto} /> : <View style={[styles.staffPhoto, styles.fallback]}><Text style={styles.initial}>{staff.name.charAt(0)}</Text></View>}
          <View style={styles.staffInfo}>
            <View style={styles.staffNameRow}><Text numberOfLines={1} style={styles.staffName}>{staff.name}</Text><Pressable onPress={() => setShowStaffPicker((value) => !value)} style={styles.changeButton}><Text style={styles.changeText}>{showStaffPicker ? 'Đóng' : 'Thay đổi'}</Text></Pressable></View>
            <View style={styles.ratingRow}><Ionicons name="star" size={16} color={COLORS.gold} /><Text style={styles.rating}>{staff.rating.toFixed(1)}</Text><Text style={styles.reviews}>({staff.reviewCount} đánh giá)</Text></View>
            <View style={styles.staffMeta}><Ionicons name="briefcase" size={15} color={COLORS.lavender} /><Text style={styles.staffMetaText}>{staff.experienceYears} năm kinh nghiệm</Text></View>
            <View style={styles.staffMeta}><Ionicons name="ribbon-outline" size={16} color={COLORS.sage} /><Text numberOfLines={1} style={styles.staffMetaText}>Chuyên: {staff.services.slice(0, 2).map((item) => item.name).join(', ')}</Text></View>
            <View style={styles.quote}><Ionicons name="chatbox-ellipses" size={16} color={COLORS.primary} /><Text numberOfLines={2} style={styles.quoteText}>Làm đẹp không chỉ là công việc, mà là cách lan tỏa sự tự tin.</Text><Ionicons name="heart-outline" size={18} color={COLORS.primary} /></View>
          </View>
        </View>}

        {showStaffPicker && <View style={styles.staffPicker}>
          <Text style={styles.pickerTitle}>Chọn nhân viên</Text>
          <Text style={styles.pickerSubtitle}>Chọn người bạn muốn đồng hành trong buổi hẹn</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffOptions}>
            {staffList.map((item) => {
              const selected = item.id === selectedStaffId;
              return <Pressable key={item.id} onPress={() => chooseStaff(item.id)} style={[styles.staffOption, selected && styles.staffOptionSelected]}>
                <View style={styles.optionPhotoWrap}>{item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.optionPhoto} /> : <View style={[styles.optionPhoto, styles.fallback]}><Text style={styles.optionInitial}>{item.name.charAt(0)}</Text></View>}{selected && <View style={styles.optionCheck}><Ionicons name="checkmark" size={11} color="#FFF" /></View>}</View>
                <Text numberOfLines={1} style={[styles.optionName, selected && styles.optionNameSelected]}>{item.name}</Text>
                <View style={styles.optionRating}><Ionicons name="star" size={10} color={COLORS.gold} /><Text style={styles.optionRatingText}>{item.rating.toFixed(1)}</Text></View>
              </Pressable>;
            })}
          </ScrollView>
        </View>}

        <View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><View style={styles.sectionIcon}><Ionicons name="flower-outline" size={19} color={COLORS.primary} /></View><Text style={styles.sectionTitle}>Chọn dịch vụ</Text></View><Text style={styles.seeAll}>{visibleServices.length} dịch vụ</Text></View>

        <View style={styles.serviceList}>
          {visibleServices.map((item) => {
            const selected = item.id === selectedId;
            return <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={({ pressed }) => [styles.serviceCard, selected && styles.serviceCardSelected, pressed && styles.pressed]}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.serviceImage} /> : <View style={[styles.serviceImage, styles.fallback]}><Ionicons name="sparkles-outline" size={25} color={COLORS.primary} /></View>}
              <View style={styles.serviceInfo}>
                <Text numberOfLines={1} style={styles.serviceName}>{item.name}</Text>
                <Text numberOfLines={2} style={styles.description}>{item.description}</Text>
                <View style={styles.serviceBottom}><Text style={styles.price}>{item.price.toLocaleString('vi-VN')} đ</Text><View style={styles.duration}><Ionicons name="time-outline" size={15} color={COLORS.lavender} /><Text style={styles.durationText}>{item.duration} phút</Text></View></View>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <Ionicons name="checkmark" size={17} color="#FFF" />}</View>
            </Pressable>;
          })}
          {!visibleServices.length && !error && <View style={styles.empty}><Ionicons name="sparkles-outline" size={28} color={COLORS.sage} /><Text style={styles.stateText}>Chưa có dịch vụ phù hợp với nhân viên này.</Text></View>}
        </View>
      </ScrollView>

      <View style={styles.footer}><Pressable disabled={!selectedId || !selectedStaffId} onPress={continueBooking} style={({ pressed }) => [styles.continueButton, (!selectedId || !selectedStaffId) && styles.continueDisabled, pressed && selectedId && selectedStaffId && styles.pressed]}><Text style={styles.continueText}>Tiếp tục</Text><Ionicons name="arrow-forward" size={22} color="#FFF" /></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.background }, stateText: { color: COLORS.muted, fontSize: 11 },
  header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  progress: { height: 42, marginTop: 6, paddingHorizontal: 39, flexDirection: 'row', alignItems: 'center' }, progressPart: { flex: 1, flexDirection: 'row', alignItems: 'center' }, progressLine: { height: 2, flex: 1, backgroundColor: '#E5DFE3' }, step: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEECEF', alignItems: 'center', justifyContent: 'center' }, stepActive: { backgroundColor: COLORS.primary }, stepNumber: { color: COLORS.text, fontSize: 12, fontWeight: '800' }, stepNumberActive: { color: '#FFF' },
  stepLabels: { marginHorizontal: 18, flexDirection: 'row' }, stepLabel: { flex: 1, color: COLORS.muted, fontSize: 8, lineHeight: 11, textAlign: 'center' }, stepLabelActive: { color: COLORS.text, fontWeight: '800' },
  content: { paddingHorizontal: 14, paddingTop: 17, paddingBottom: 100 }, error: { padding: 12, marginBottom: 10, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: COLORS.primaryDark, fontSize: 10 },
  staffCard: { minHeight: 194, padding: 9, backgroundColor: '#FFF', flexDirection: 'row', borderWidth: 1, borderColor: '#F4E8E9' }, staffPhoto: { width: '37%', minHeight: 176, resizeMode: 'cover' }, fallback: { backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' }, initial: { color: COLORS.primary, fontSize: 38, fontWeight: '800' }, staffInfo: { flex: 1, paddingLeft: 14, paddingTop: 4 }, staffNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, staffName: { maxWidth: '62%', color: COLORS.text, fontSize: 19, fontWeight: '800', fontFamily: 'serif' }, changeButton: { paddingHorizontal: 9, paddingVertical: 7, backgroundColor: COLORS.primarySoft }, changeText: { color: COLORS.primaryDark, fontSize: 9, fontWeight: '800' }, ratingRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }, rating: { color: COLORS.text, fontSize: 12, fontWeight: '800' }, reviews: { color: COLORS.muted, fontSize: 8 }, staffMeta: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }, staffMetaText: { flex: 1, color: COLORS.muted, fontSize: 9 }, quote: { minHeight: 49, marginTop: 11, paddingHorizontal: 9, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 6 }, quoteText: { flex: 1, color: COLORS.muted, fontSize: 7, lineHeight: 11, fontStyle: 'italic' },
  staffPicker: { marginTop: 10, paddingVertical: 13, backgroundColor: '#FFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line }, pickerTitle: { paddingHorizontal: 13, color: COLORS.text, fontSize: 14, fontWeight: '800' }, pickerSubtitle: { paddingHorizontal: 13, marginTop: 3, color: COLORS.muted, fontSize: 8 }, staffOptions: { paddingHorizontal: 13, paddingTop: 12, gap: 9 }, staffOption: { width: 78, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#EEE7E9', backgroundColor: '#FFF' }, staffOptionSelected: { borderColor: COLORS.primary, backgroundColor: '#FFF8FA' }, optionPhotoWrap: { width: 52, height: 52 }, optionPhoto: { width: 52, height: 52, borderRadius: 26, resizeMode: 'cover' }, optionInitial: { color: COLORS.primary, fontSize: 18, fontWeight: '800' }, optionCheck: { position: 'absolute', right: -1, bottom: -1, width: 17, height: 17, borderRadius: 9, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, optionName: { width: 66, marginTop: 7, color: COLORS.text, fontSize: 9, fontWeight: '700', textAlign: 'center' }, optionNameSelected: { color: COLORS.primaryDark }, optionRating: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 2 }, optionRatingText: { color: COLORS.muted, fontSize: 8, fontWeight: '700' },
  sectionHeader: { marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' }, seeAll: { color: COLORS.primary, fontSize: 10, fontWeight: '700' },
  serviceList: { gap: 9 }, serviceCard: { minHeight: 112, padding: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center' }, serviceCardSelected: { borderColor: COLORS.primary, backgroundColor: '#FFFAFB' }, serviceImage: { width: 86, height: 94, resizeMode: 'cover' }, serviceInfo: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 5 }, serviceName: { color: COLORS.text, fontSize: 14, fontWeight: '800' }, description: { color: COLORS.muted, fontSize: 9, lineHeight: 13, marginTop: 5 }, serviceBottom: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, price: { color: COLORS.primaryDark, fontSize: 14, fontWeight: '800' }, duration: { flexDirection: 'row', alignItems: 'center', gap: 4 }, durationText: { color: COLORS.muted, fontSize: 9 }, radio: { width: 26, height: 26, borderRadius: 13, marginRight: 4, borderWidth: 2, borderColor: '#D6D2D8', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, pressed: { opacity: .82 }, empty: { paddingVertical: 55, alignItems: 'center', gap: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,.97)', borderTopWidth: 1, borderTopColor: COLORS.line }, continueButton: { height: 52, borderRadius: 26, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, continueDisabled: { opacity: .38 }, continueText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
