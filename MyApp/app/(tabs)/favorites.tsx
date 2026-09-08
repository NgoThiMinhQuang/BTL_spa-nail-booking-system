import { NailCard } from '@/components/home/NailCard';
import { StyleSheet, Text, View } from 'react-native';

export default function FavoritesScreen() {
  return <View style={styles.container}><Text style={styles.title}>Mẫu nail yêu thích</Text><NailCard title="Pink Blossom" /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 18, backgroundColor: '#FFF8FB' }, title: { fontSize: 28, fontWeight: '800' } });
