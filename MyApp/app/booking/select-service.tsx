import { fetchServices } from '@/features/service/service.service';
import type { NailService } from '@/features/service/service.types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background:'#FFF9F7',surface:'#FFF',primary:'#A96370',primarySoft:'#F4E4E4',sage:'#738A7C',sageSoft:'#E8F0EC',text:'#30282A',muted:'#8A7D80',line:'#EFE3E0' };
const ALL = 'Tất cả';

export default function SelectServiceScreen() {
  const [services, setServices] = useState<NailService[]>([]);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(ALL);

  useEffect(() => { fetchServices().then(setServices).catch(() => setError('Không thể tải dịch vụ từ máy chủ.')); }, []);
  const categories = useMemo(() => [ALL, ...Array.from(new Set(services.map((item) => item.categoryName).filter((name): name is string => Boolean(name))))], [services]);
  const visible = useMemo(() => services.filter((item) => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return (category === ALL || item.categoryName === category) && (!query || `${item.name} ${item.description}`.toLocaleLowerCase('vi').includes(query));
  }), [category, keyword, services]);

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={23} color={COLORS.text} /></Pressable><View style={styles.heading}><Text style={styles.title}>Chọn dịch vụ</Text><Text style={styles.subtitle}>Bước đầu tiên cho cuộc hẹn của bạn</Text></View><View style={styles.iconButton} /></View>
    <View style={styles.steps}><View style={styles.stepActive}><Text style={styles.stepNumber}>1</Text></View><View style={styles.stepLine} /><View style={styles.step}><Text style={styles.stepMuted}>2</Text></View><View style={styles.stepLine} /><View style={styles.step}><Text style={styles.stepMuted}>3</Text></View></View>
    <View style={styles.stepLabels}><Text style={styles.stepLabelActive}>Dịch vụ</Text><Text style={styles.stepLabel}>Chuyên viên</Text><Text style={styles.stepLabel}>Thời gian</Text></View>
    <View style={styles.search}><Ionicons name="search-outline" size={18} color={COLORS.primary} /><TextInput value={keyword} onChangeText={setKeyword} placeholder="Bạn muốn làm dịch vụ gì?" placeholderTextColor="#B2A6A8" style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    {!services.length && !error ? <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
      {!!error && <View style={styles.error}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.primary} /><Text style={styles.errorText}>{error}</Text></View>}
      {visible.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname:'/booking/select-staff', params:{ serviceId:item.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {item.imageUrl ? <Image source={{ uri:item.imageUrl }} style={styles.image} /> : <View style={[styles.image,styles.imageFallback]}><Ionicons name="sparkles-outline" size={28} color={COLORS.primary} /></View>}
        <View style={styles.info}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><Text numberOfLines={2} style={styles.description}>{item.description}</Text><View style={styles.meta}><View style={styles.metaItem}><Ionicons name="time-outline" size={13} color={COLORS.sage} /><Text style={styles.metaText}>{item.duration} phút</Text></View><Text style={styles.price}>{item.price.toLocaleString('vi-VN')}đ</Text></View></View>
        <View style={styles.arrow}><Ionicons name="chevron-forward" size={17} color={COLORS.primary} /></View>
      </Pressable>)}
      {!visible.length && !error && <View style={styles.empty}><Ionicons name="search-outline" size={30} color={COLORS.sage} /><Text style={styles.emptyText}>Không tìm thấy dịch vụ phù hợp.</Text></View>}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({safeArea:{flex:1,backgroundColor:COLORS.background},header:{paddingHorizontal:14,paddingTop:7,flexDirection:'row',alignItems:'center'},iconButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},heading:{flex:1,alignItems:'center'},title:{fontSize:21,fontWeight:'800',color:COLORS.text},subtitle:{fontSize:10,color:COLORS.muted,marginTop:3},steps:{paddingTop:14,paddingHorizontal:48,flexDirection:'row',alignItems:'center'},stepActive:{width:25,height:25,borderRadius:13,backgroundColor:COLORS.primarySoft,borderWidth:2,borderColor:COLORS.primary,alignItems:'center',justifyContent:'center'},step:{width:23,height:23,borderRadius:12,backgroundColor:'#F0E6E4',alignItems:'center',justifyContent:'center'},stepNumber:{fontSize:10,fontWeight:'800',color:COLORS.primary},stepMuted:{fontSize:9,fontWeight:'700',color:'#A99A9D'},stepLine:{flex:1,height:2,backgroundColor:'#E9DCDC'},stepLabels:{paddingHorizontal:31,marginTop:5,flexDirection:'row',justifyContent:'space-between'},stepLabel:{width:70,textAlign:'center',fontSize:8,color:COLORS.muted},stepLabelActive:{width:70,textAlign:'center',fontSize:8,color:COLORS.primary,fontWeight:'800'},search:{height:43,marginHorizontal:14,marginTop:15,borderRadius:14,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.surface,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:8},searchInput:{flex:1,fontSize:11,color:COLORS.text},categories:{paddingHorizontal:14,paddingVertical:12,gap:8},category:{height:34,paddingHorizontal:15,borderRadius:12,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.surface,alignItems:'center',justifyContent:'center'},categoryActive:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},categoryText:{fontSize:10,fontWeight:'700',color:COLORS.muted},categoryTextActive:{color:'#FFF'},center:{flex:1,alignItems:'center',justifyContent:'center'},list:{paddingHorizontal:14,paddingBottom:28,gap:10},card:{minHeight:110,padding:9,borderRadius:17,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.surface,flexDirection:'row',alignItems:'center'},pressed:{opacity:.75,transform:[{scale:.99}]},image:{width:90,height:90,borderRadius:13},imageFallback:{backgroundColor:COLORS.primarySoft,alignItems:'center',justifyContent:'center'},info:{flex:1,paddingHorizontal:11},name:{fontSize:14,fontWeight:'800',color:COLORS.text},description:{fontSize:9,lineHeight:14,color:COLORS.muted,marginTop:4},meta:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:9},metaItem:{flexDirection:'row',alignItems:'center',gap:4},metaText:{fontSize:9,color:COLORS.sage},price:{fontSize:12,fontWeight:'800',color:COLORS.primary},arrow:{width:25,height:25,borderRadius:13,backgroundColor:COLORS.primarySoft,alignItems:'center',justifyContent:'center'},error:{padding:12,borderRadius:13,backgroundColor:COLORS.primarySoft,flexDirection:'row',alignItems:'center',gap:8},errorText:{fontSize:10,color:COLORS.primary},empty:{paddingVertical:65,alignItems:'center',gap:8},emptyText:{fontSize:11,color:COLORS.muted}});
