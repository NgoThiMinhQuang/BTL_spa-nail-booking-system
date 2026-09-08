import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

export function Banner() {
  return (
    <View style={styles.wrapper}>
      <ImageBackground source={require('@/assets/images/banner/nail-banner-v2.png')} imageStyle={styles.image} style={styles.banner}>
        <View style={styles.copy}>
          <Text style={styles.script}>Nails</Text>
          <Text style={styles.title}>LÀ NGÔN NGỮ{`\n`}CỦA SỰ TỰ TIN</Text>
          <Text style={styles.caption}>Đẹp hơn mỗi ngày{`\n`}cùng NailHouse</Text>
          <Pressable onPress={() => router.push('/booking/select-service')} style={styles.button}><Text style={styles.buttonText}>ĐẶT LỊCH NGAY</Text><Ionicons name="arrow-forward" size={14} color="#FFF" /></Pressable>
        </View>
      </ImageBackground>
      <View style={styles.dots}><View style={[styles.dot, styles.active]} /><View style={styles.dot} /><View style={styles.dot} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginTop: 10 }, banner: { height: 190, overflow: 'hidden', justifyContent: 'center' }, image: { borderRadius: 17 },
  copy: { width: '57%', paddingLeft: 19 }, script: { color: '#B84068', fontSize: 39, fontStyle: 'italic', fontWeight: '500', lineHeight: 42 },
  title: { color: '#794151', fontSize: 16, lineHeight: 18, fontWeight: '800' }, caption: { color: '#866D74', fontSize: 9, lineHeight: 12, marginTop: 4, textAlign: 'center', width: 105 },
  button: { marginTop: 10, backgroundColor: '#C95277', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7 }, buttonText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  dots: { position: 'absolute', right: 17, bottom: 10, flexDirection: 'row', gap: 6 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.8)' }, active: { width: 8, backgroundColor: '#CD5779' },
});
