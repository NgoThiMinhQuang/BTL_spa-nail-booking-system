import { createDepositIntent, fetchBookingDetail } from '@/features/booking/booking.service';
import type { DepositIntent } from '@/features/booking/booking.service';
import type { BookingDetail } from '@/features/booking/booking.types';
import { BookingProgress } from '@/components/booking/BookingProgress';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

const C={bg:'#FFF8F8',pink:'#D56B81',dark:'#9A5065',soft:'#FCE8ED',green:'#42A66C',sage:'#557C72',gold:'#E7A423',text:'#292530',muted:'#6D6875',line:'#EEE3E6'};
const vnd=(n:number)=>`${Number(n).toLocaleString('vi-VN')} đ`;

type Phase='loading'|'pay'|'success'|'expired';

export default function Deposit(){
 const {bookingId=''}=useLocalSearchParams<{bookingId?:string}>();
 const [phase,setPhase]=useState<Phase>('loading');
 const [detail,setDetail]=useState<BookingDetail|null>(null);
 const [intent,setIntent]=useState<DepositIntent|null>(null);
 const [error,setError]=useState('');
 const [checking,setChecking]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 const timer=useRef<ReturnType<typeof setInterval>|null>(null);

 const refresh=useCallback(async()=>{
  if(!bookingId)return null;
  const d=await fetchBookingDetail(bookingId);
  setDetail(d);
  return d;
 },[bookingId]);

 /* Đã cọc từ trước (trả rồi quay lại) thì vào thẳng thành công. */
 const applyStatus=useCallback((d:BookingDetail)=>{
  if(d.paymentStatus==='DEPOSITED'||d.paymentStatus==='PAID'||d.status==='confirmed'){setPhase('success');return true}
  if(d.status==='cancelled'){setPhase('expired');return true}
  return false;
 },[]);

 useEffect(()=>{
  (async()=>{
   try{
    const d=await refresh();
    if(!d){setError('Không tìm thấy lịch hẹn.');return}
    if(applyStatus(d))return;
    const it=await createDepositIntent(bookingId);
    setIntent(it);setPhase('pay');
   }catch(e){
    const msg=e instanceof Error?e.message:'';
    if(/quá .* chờ đặt cọc|hết hạn/i.test(msg)){setPhase('expired');return}
    setError(msg||'Không tải được thông tin đặt cọc.');
   }
  })();
 },[bookingId,refresh,applyStatus]);

 /* Đếm ngược giữ chỗ. Hết giờ thì kiểm tra lại (sweeper đã hủy). */
 useEffect(()=>{
  if(phase!=='pay'||!intent?.expiresAt)return;
  timer.current=setInterval(()=>setNow(Date.now()),1000);
  return()=>{if(timer.current)clearInterval(timer.current)};
 },[phase,intent?.expiresAt]);

 /* Quay lại app sau khi trả trên trình duyệt thì kiểm tra ngay. */
 const checkPaid=useCallback(async()=>{
  setChecking(true);setError('');
  try{
   const d=await refresh();
   if(d&&!applyStatus(d))setError('Chưa ghi nhận thanh toán. Nếu bạn vừa trả tiền, đợi vài giây rồi bấm lại.');
  }catch(e){setError(e instanceof Error?e.message:'Không kiểm tra được thanh toán.')}
  finally{setChecking(false)}
 },[refresh,applyStatus]);

 useEffect(()=>{
  const sub=AppState.addEventListener('change',(s)=>{
   if(s==='active'&&phase==='pay')checkPaid();
  });
  return()=>sub.remove();
 },[phase,bookingId,checkPaid]);

 const pay=useCallback(async()=>{
  if(!intent?.paymentUrl)return;
  try{
   await WebBrowser.openBrowserAsync(intent.paymentUrl,{showTitle:true});
  }catch{setError('Không mở được trang thanh toán.')}
  finally{checkPaid()}
 },[intent,checkPaid]);

 if(phase==='loading')return <SafeAreaView style={s.center}><ActivityIndicator color={C.pink}/><Text style={s.muted}>Đang chuẩn bị thanh toán...</Text></SafeAreaView>;

 if(phase==='success'&&detail){
  const start=detail.startsAt?new Date(detail.startsAt):null;
  const dateText=start?new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(start):'';
  const timeText=start?`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`:'';
  return <SafeAreaView style={s.success}><View style={s.successMain}><View style={s.check}><Ionicons name="checkmark" size={45} color="#FFF"/></View><Text style={s.successTitle}>Đặt lịch thành công!</Text><Text style={s.successText}>Bạn đã đặt cọc: <Text style={s.strong}>{vnd(detail.paidAmount??intent?.deposit??0)}</Text>{`\n`}Còn lại thanh toán tại salon: <Text style={s.strong}>{vnd(detail.remaining??intent?.remaining??0)}</Text></Text><View style={s.ticket}><Row icon="time-outline" text={`${timeText}`}/><Row icon="calendar-outline" text={dateText}/><Row icon="person-outline" text={detail.staffName??'Chuyên viên do salon phân công'}/></View></View><View style={s.successBtns}><Pressable onPress={()=>router.replace('/bookings')} style={s.primary}><Text style={s.primaryText}>Xem lịch hẹn</Text></Pressable><Pressable onPress={()=>router.replace('/')} style={s.secondary}><Text style={s.secondaryText}>Về trang chủ</Text></Pressable></View></SafeAreaView>;
 }

 if(phase==='expired'){
  return <SafeAreaView style={s.center}><View style={s.warn}><Ionicons name="time-outline" size={40} color={C.dark}/></View><Text style={s.expTitle}>Lịch đã hết hạn giữ chỗ</Text><Text style={s.expText}>Quá 15 phút chờ đặt cọc nên lịch bị hủy tự động.{`\n`}Vui lòng đặt lịch mới.</Text><Pressable onPress={()=>router.replace('/booking/select-service')} style={s.primary}><Text style={s.primaryText}>Đặt lịch mới</Text></Pressable></SafeAreaView>;
 }

 const left=intent?.expiresAt?Math.max(0,Math.floor((new Date(intent.expiresAt).getTime()-now)/1000)):0;
 const leftText=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
 return <SafeAreaView edges={['top']} style={s.safe}>
  <View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color={C.pink}/></Pressable><Text style={s.title}>Thanh toán cọc</Text><View style={s.back}/></View>
  <BookingProgress currentStep={4} />
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   {!!error&&<View style={s.error}><Text style={s.errorText}>{error}</Text></View>}
   <View style={s.timerBox}><Ionicons name="timer-outline" size={20} color={C.dark}/><Text style={s.timerText}>Giữ chỗ còn <Text style={s.timerNum}>{leftText}</Text></Text></View>
   <View style={s.box}><View style={s.boxTitle}><Ionicons name="receipt-outline" size={22} color={C.pink}/><Text style={s.boxTitleText}>Tổng thanh toán</Text></View>
    <BillRow label={`Giá dịch vụ${detail?.serviceName?` (${detail.serviceName})`:''}`} value={vnd(intent?.total??detail?.total??0)}/>
    <BillRow label="Tiền cọc 30%" value={vnd(intent?.deposit??0)} strong/>
    <BillRow label="Thanh toán tại salon" value={vnd(intent?.remaining??0)}/>
    {intent?.mock&&<Text style={s.mockNote}>Chế độ thử nghiệm: trang thanh toán giả lập, không trừ tiền thật.</Text>}
   </View>
   <View style={s.box}><View style={s.boxTitle}><Ionicons name="calendar" size={22} color={C.pink}/><Text style={s.boxTitleText}>Lịch hẹn của bạn</Text></View>
    <Row icon="person-outline" text={detail?.staffName??'Bất kỳ chuyên viên'}/>
   </View>
  </ScrollView>
  <View style={s.footer}>
   <Pressable disabled={checking} onPress={pay} style={[s.payBtn,checking&&{opacity:.6}]}><Text style={s.payText}>Thanh toán cọc {vnd(intent?.deposit??0)}</Text><Ionicons name="arrow-forward" size={22} color="#FFF"/></Pressable>
   <Pressable disabled={checking} onPress={checkPaid} style={s.checkBtn}>{checking?<ActivityIndicator color={C.pink}/>:<Text style={s.checkText}>Tôi đã thanh toán</Text>}</Pressable>
  </View>
 </SafeAreaView>;
}
function BillRow({label,value,strong}:{label:string;value:string;strong?:boolean}){return <View style={s.billRow}><Text numberOfLines={1} style={s.billLabel}>{label}</Text><Text style={[s.billValue,strong&&s.billStrong]}>{value}</Text></View>}
function Row({icon,text}:{icon:React.ComponentProps<typeof Ionicons>['name'];text:string}){return <View style={s.row}><Ionicons name={icon} size={18} color={C.muted}/><Text numberOfLines={1} style={s.rowText}>{text}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:24},muted:{color:C.muted,fontSize:14},header:{height:58,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{width:42,height:42,alignItems:'center',justifyContent:'center'},title:{fontSize:22,fontWeight:'700',color:C.text},content:{padding:14,paddingBottom:170,gap:11},error:{padding:11,backgroundColor:C.soft,borderRadius:10},errorText:{color:C.dark,fontSize:14},timerBox:{padding:12,backgroundColor:'#FFF2D9',borderRadius:12,flexDirection:'row',alignItems:'center',gap:8},timerText:{color:'#866624',fontSize:14},timerNum:{fontWeight:'800',fontSize:16},box:{padding:14,backgroundColor:'#FFF',borderRadius:14},boxTitle:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:6},boxTitleText:{fontSize:17,fontWeight:'700',color:C.text},billRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:9,borderTopWidth:1,borderTopColor:C.line},billLabel:{flex:1,fontSize:14,color:C.muted,marginRight:8},billValue:{fontSize:15,color:C.text,fontWeight:'600'},billStrong:{color:C.dark,fontWeight:'800',fontSize:16},mockNote:{fontSize:12,color:C.muted,marginTop:8,fontStyle:'italic'},row:{marginTop:11,flexDirection:'row',alignItems:'center',gap:8},rowText:{flex:1,fontSize:14,color:C.muted},footer:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:14,paddingTop:11,paddingBottom:26,gap:8,backgroundColor:'rgba(255,255,255,.97)',borderTopWidth:1,borderTopColor:C.line},payBtn:{height:54,borderRadius:27,backgroundColor:C.pink,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},payText:{color:'#FFF',fontSize:16,fontWeight:'700'},checkBtn:{height:46,borderRadius:23,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.pink},checkText:{color:C.pink,fontSize:15,fontWeight:'700'},success:{flex:1,backgroundColor:C.bg,justifyContent:'space-between',padding:24},successMain:{alignItems:'center',marginTop:60},check:{width:90,height:90,borderRadius:45,backgroundColor:C.green,alignItems:'center',justifyContent:'center'},successTitle:{fontSize:22,fontWeight:'800',color:C.text,marginTop:16},successText:{fontSize:15,color:C.muted,textAlign:'center',lineHeight:24,marginTop:10},strong:{fontWeight:'800',color:C.text},ticket:{marginTop:16,width:'100%',backgroundColor:'#FFF',borderRadius:14,padding:14},successBtns:{gap:10},primary:{height:54,borderRadius:27,backgroundColor:C.pink,alignItems:'center',justifyContent:'center'},primaryText:{color:'#FFF',fontSize:16,fontWeight:'700'},secondary:{height:54,borderRadius:27,borderWidth:1,borderColor:C.pink,alignItems:'center',justifyContent:'center'},secondaryText:{color:C.pink,fontSize:16,fontWeight:'700'},warn:{width:84,height:84,borderRadius:42,backgroundColor:C.soft,alignItems:'center',justifyContent:'center'},expTitle:{fontSize:20,fontWeight:'800',color:C.text},expText:{fontSize:14,color:C.muted,textAlign:'center',lineHeight:22}});
