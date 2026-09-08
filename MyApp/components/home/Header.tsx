import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

export function Header({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'K';
  return (
    <View>
      <View style={styles.topRow}>
        <View style={styles.brandRow}><View style={styles.logo}><Ionicons name="flower-outline" size={27} color="#C65C7A" /></View><View><Text style={styles.brand}>Nail<Text style={styles.brandAccent}>House</Text></Text><Text style={styles.slogan}>BEAUTY NAILS · BETTER YOU</Text></View></View>
        <View style={styles.actions}><View style={styles.bell}><Ionicons name="notifications-outline" size={23} color="#30272A" /><View style={styles.badge} /></View>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>}</View>
      </View>
      <Text style={styles.greeting}>Xin chào, <Text style={styles.name}>{name}!</Text> 👋</Text>
      <Text style={styles.subGreeting}>Cùng NailHouse làm đẹp mỗi ngày 💕</Text>
    </View>
  );
}

const styles = StyleSheet.create({ topRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, logo: { width: 36, height: 36, borderWidth: 1, borderColor: '#E6A1B5', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, brand: { color: '#333', fontSize: 20, fontWeight: '700' }, brandAccent: { color: '#C75879' }, slogan: { color: '#8F7D83', fontSize: 6.5, letterSpacing: 1.15, marginTop: 1 }, actions: { flexDirection: 'row', gap: 12, alignItems: 'center' }, bell: { position: 'relative' }, badge: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#D33E64', top: 1, right: 1 }, avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#F0D3D9', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, avatarImage: { width: 39, height: 39, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' }, avatarText: { color: '#86475A', fontSize: 16, fontWeight: '800' }, greeting: { paddingHorizontal: 16, fontSize: 18, fontWeight: '600', color: '#35292D' }, name: { color: '#C85073', fontWeight: '800' }, subGreeting: { paddingHorizontal: 16, color: '#8A7B80', fontSize: 12, marginTop: 2 } });
