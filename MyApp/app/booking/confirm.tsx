import { createBooking, fetchAvailability } from '@/features/booking/booking.service';
import { fetchServiceById } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { fetchStaffById } from '@/features/staff/staff.service';
import type { StaffDetail } from '@/features/staff/staff.types';
import { ApiError } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background: '#FFF9F7', surface: '#FFFFFF', primary: '#A96370', primarySoft: '#F4E4E4', sage: '#738A7C', sageSoft: '#E8F0EC', gold: '#D69A42', text: '#30282A', muted: '#8A7D80', line: '#EFE3E0' };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDays() {
  return Array.from({ length: 14 }, (_, index) => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + index);
    return { key: dateKey(value), day: value.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'), number: value.getDate(), month: value.getMonth() + 1 };
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
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchServiceById(serviceId), fetchStaffById(staffId), fetchAvailability(serviceId, staffId, days[0].key)])
      .then(([serviceData, staffData, availability]) => { setService(serviceData); setStaff(staffData); setSlots(availability.slots); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin đặt lịch.'))
      .finally(() => setLoading(false));
  }, [days, serviceId, staffId]);

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
    setLoading(true);
    setError('');
    fetchAvailability(serviceId, staffId, date)
      .then((availability) => setSlots(availability.slots))
      .catch((reason: unknown) => { setSlots([]); setError(reason instanceof Error ? reason.message : 'Không tải được giờ trống.'); })
      .finally(() => setLoading(false));
  };

  const submit = async () => {
    if (!selectedTime) return;
    setSubmitting(true);
    try {
      await createBooking({ serviceId, staffId, date: selectedDate, time: selectedTime, note });
      Alert.alert('Đặt lịch thành công', 'Lịch hẹn đang chờ cửa hàng xác nhận.', [{ text: 'Xem lịch hẹn', onPress: () => router.replace('/bookings') }]);
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : 'Không thể tạo lịch hẹn. Vui lòng thử lại.';
      Alert.alert('Chưa thể đặt lịch', message);
      if (reason instanceof ApiError && reason.status === 409) chooseDate(selectedDate);
    } finally { setSubmitting(false); }
  };

  if (loading && !service) return <SafeAreaView style={styles.safeArea}><View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Đang chuẩn bị lịch trống...</Text></View></SafeAreaView>;

  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={23} color={COLORS.text} /></Pressable><View style={styles.heading}><Text style={styles.title}>Đặt lịch hẹn</Text><Text style={styles.subtitle}>Chọn thời gian thuận tiện cho bạn</Text></View><View style={styles.iconButton} /></View>
    <View style={styles.steps}><View style={styles.stepDone}><Ionicons name="checkmark" size={13} color="#FFF" /></View><View style={styles.stepLineDone} /><View style={styles.stepDone}><Ionicons name="checkmark" size={13} color="#FFF" /></View><View style={styles.stepLine} /><View style={styles.stepActive}><Text style={styles.stepNumber}>3</Text></View></View>
    <View style={styles.stepLabels}><Text style={styles.stepLabel}>Dịch vụ</Text><Text style={styles.stepLabel}>Chuyên viên</Text><Text style={[styles.stepLabel, styles.stepLabelActive]}>Thời gian</Text></View>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={19} color={COLORS.primary} /><Text style={styles.errorText}>{error}</Text></View>}
      <View style={styles.summaryCard}>
        {service?.imageUrl ? <Image source={{ uri: service.imageUrl }} style={styles.serviceImage} /> : <View style={[styles.serviceImage, styles.imageFallback]}><Ionicons name="sparkles" size={25} color={COLORS.primary} /></View>}
        <View style={styles.summaryInfo}><Text style={styles.summaryEyebrow}>DỊCH VỤ ĐÃ CHỌN</Text><Text numberOfLines={1} style={styles.summaryName}>{service?.name}</Text><View style={styles.metaRow}><Ionicons name="time-outline" size={14} color={COLORS.sage} /><Text style={styles.meta}>{service?.duration} phút</Text><Text style={styles.dot}>•</Text><Text style={styles.price}>{service?.price.toLocaleString('vi-VN')}đ</Text></View></View>
        <Pressable onPress={() => router.replace('/booking/select-service')}><Text style={styles.change}>Đổi</Text></Pressable>
      </View>
      <View style={styles.staffRow}>{staff?.avatarUrl ? <Image source={{ uri: staff.avatarUrl }} style={styles.staffAvatar} /> : <View style={[styles.staffAvatar, styles.imageFallback]}><Text style={styles.initial}>{staff?.name.charAt(0)}</Text></View>}<View style={styles.staffInfo}><Text style={styles.summaryEyebrow}>CHUYÊN VIÊN</Text><Text style={styles.staffName}>{staff?.name}</Text><View style={styles.metaRow}><Ionicons name="star" size={12} color={COLORS.gold} /><Text style={styles.meta}>{staff?.rating.toFixed(1)} · {staff?.experienceYears} năm kinh nghiệm</Text></View></View><Pressable onPress={() => router.back()}><Text style={styles.change}>Đổi</Text></Pressable></View>

      <Text style={styles.sectionTitle}>Chọn ngày</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((item) => { const active = selectedDate === item.key; return <Pressable key={item.key} onPress={() => chooseDate(item.key)} style={[styles.dayCard, active && styles.dayCardActive]}><Text style={[styles.dayName, active && styles.dayTextActive]}>{item.key === days[0].key ? 'Hôm nay' : item.day}</Text><Text style={[styles.dayNumber, active && styles.dayTextActive]}>{item.number}</Text><Text style={[styles.dayMonth, active && styles.dayTextActive]}>Tháng {item.month}</Text></Pressable>; })}
      </ScrollView>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Chọn giờ</Text><View style={styles.available}><View style={styles.availableDot} /><Text style={styles.availableText}>Giờ còn trống</Text></View></View>
      {loading ? <ActivityIndicator style={styles.slotLoader} color={COLORS.primary} /> : slots.length ? <View style={styles.slots}>{slots.map((time) => { const active = time === selectedTime; return <Pressable key={time} onPress={() => setSelectedTime(time)} style={[styles.slot, active && styles.slotActive]}><Text style={[styles.slotText, active && styles.slotTextActive]}>{time}</Text></Pressable>; })}</View> : <View style={styles.noSlots}><Ionicons name="calendar-outline" size={23} color={COLORS.sage} /><Text style={styles.muted}>Ngày này chưa có giờ trống, bạn hãy chọn ngày khác.</Text></View>}

      <Text style={styles.sectionTitle}>Ghi chú cho cửa hàng</Text>
      <View style={styles.noteBox}><TextInput value={note} onChangeText={setNote} maxLength={300} multiline placeholder="Ví dụ: móng yếu, cần tư vấn màu nhẹ nhàng..." placeholderTextColor="#B2A6A8" style={styles.noteInput} /><Text style={styles.counter}>{note.length}/300</Text></View>
      <View style={styles.policy}><Ionicons name="information-circle-outline" size={18} color={COLORS.sage} /><Text style={styles.policyText}>Vui lòng đến trước 10 phút. Lịch hẹn sẽ ở trạng thái chờ xác nhận sau khi đặt.</Text></View>
    </ScrollView>

    <View style={styles.footer}><View><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.total}>{service?.price.toLocaleString('vi-VN')}đ</Text></View><Pressable disabled={!selectedTime || submitting} onPress={submit} style={[styles.submit, (!selectedTime || submitting) && styles.submitDisabled]}>{submitting ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.submitText}>Xác nhận đặt lịch</Text><Ionicons name="arrow-forward" size={18} color="#FFF" /></>}</Pressable></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:COLORS.background},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},muted:{color:COLORS.muted,fontSize:11,textAlign:'center'},header:{paddingHorizontal:14,paddingTop:7,flexDirection:'row',alignItems:'center'},iconButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},heading:{flex:1,alignItems:'center'},title:{fontSize:21,fontWeight:'800',color:COLORS.text},subtitle:{fontSize:10,color:COLORS.muted,marginTop:3},steps:{paddingTop:14,paddingHorizontal:48,flexDirection:'row',alignItems:'center'},stepDone:{width:23,height:23,borderRadius:12,backgroundColor:COLORS.primary,alignItems:'center',justifyContent:'center'},stepActive:{width:25,height:25,borderRadius:13,backgroundColor:COLORS.primarySoft,borderWidth:2,borderColor:COLORS.primary,alignItems:'center',justifyContent:'center'},stepNumber:{fontSize:10,fontWeight:'800',color:COLORS.primary},stepLineDone:{flex:1,height:2,backgroundColor:COLORS.primary},stepLine:{flex:1,height:2,backgroundColor:'#E9DCDC'},stepLabels:{paddingHorizontal:31,marginTop:5,flexDirection:'row',justifyContent:'space-between'},stepLabel:{width:70,textAlign:'center',fontSize:8,color:COLORS.muted},stepLabelActive:{color:COLORS.primary,fontWeight:'700'},content:{padding:14,paddingBottom:24,gap:14},errorBox:{padding:11,borderRadius:12,backgroundColor:COLORS.primarySoft,flexDirection:'row',alignItems:'center',gap:7},errorText:{flex:1,fontSize:10,color:'#7D5159'},summaryCard:{padding:10,borderRadius:16,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.line,flexDirection:'row',alignItems:'center'},serviceImage:{width:64,height:64,borderRadius:12},imageFallback:{backgroundColor:COLORS.primarySoft,alignItems:'center',justifyContent:'center'},summaryInfo:{flex:1,paddingHorizontal:10},summaryEyebrow:{fontSize:8,fontWeight:'800',color:COLORS.sage,letterSpacing:.5},summaryName:{fontSize:13,fontWeight:'800',color:COLORS.text,marginTop:3},metaRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:5},meta:{fontSize:9,color:COLORS.muted},dot:{fontSize:9,color:'#C9BDBF'},price:{fontSize:10,color:COLORS.primary,fontWeight:'800'},change:{fontSize:10,color:COLORS.primary,fontWeight:'800'},staffRow:{padding:11,borderRadius:16,backgroundColor:COLORS.sageSoft,flexDirection:'row',alignItems:'center'},staffAvatar:{width:48,height:48,borderRadius:24},initial:{fontSize:18,fontWeight:'800',color:COLORS.sage},staffInfo:{flex:1,paddingHorizontal:10},staffName:{fontSize:12,fontWeight:'800',color:COLORS.text,marginTop:2},sectionTitle:{fontSize:14,fontWeight:'800',color:COLORS.text},days:{gap:8},dayCard:{width:68,height:82,borderRadius:15,backgroundColor:COLORS.surface,borderWidth:1,borderColor:COLORS.line,alignItems:'center',justifyContent:'center'},dayCardActive:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},dayName:{fontSize:8,color:COLORS.muted},dayNumber:{fontSize:20,fontWeight:'800',color:COLORS.text,marginVertical:2},dayMonth:{fontSize:8,color:COLORS.muted},dayTextActive:{color:'#FFF'},sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},available:{flexDirection:'row',alignItems:'center',gap:4},availableDot:{width:6,height:6,borderRadius:3,backgroundColor:'#75A46E'},availableText:{fontSize:8,color:COLORS.sage},slots:{flexDirection:'row',flexWrap:'wrap',gap:8},slot:{width:'22.8%',height:38,borderRadius:11,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.surface,alignItems:'center',justifyContent:'center'},slotActive:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},slotText:{fontSize:11,fontWeight:'700',color:COLORS.text},slotTextActive:{color:'#FFF'},slotLoader:{height:54},noSlots:{padding:18,borderRadius:13,backgroundColor:COLORS.sageSoft,alignItems:'center',gap:7},noteBox:{minHeight:88,borderRadius:14,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.surface,padding:11},noteInput:{minHeight:54,color:COLORS.text,fontSize:11,textAlignVertical:'top'},counter:{alignSelf:'flex-end',fontSize:8,color:COLORS.muted},policy:{padding:11,borderRadius:12,backgroundColor:'#FFF5E4',flexDirection:'row',alignItems:'center',gap:7},policyText:{flex:1,fontSize:9,lineHeight:14,color:'#76685D'},footer:{padding:12,borderTopWidth:1,borderTopColor:COLORS.line,backgroundColor:COLORS.surface,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},totalLabel:{fontSize:9,color:COLORS.muted},total:{fontSize:17,fontWeight:'800',color:COLORS.primary,marginTop:2},submit:{height:48,minWidth:190,borderRadius:15,backgroundColor:COLORS.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},submitDisabled:{opacity:.45},submitText:{color:'#FFF',fontSize:12,fontWeight:'800'},
});
