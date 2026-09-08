import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

export function NailCard({ title, imageUrl }: { title: string; imageUrl?: string }) {
  const source = imageUrl ? { uri: imageUrl } : require('@/assets/images/nails/nail-collection-v2.png');
  return <View style={styles.wrapper}><ImageBackground source={source} resizeMode="cover" imageStyle={styles.image} style={styles.card}><View style={styles.heart}><Ionicons name="heart-outline" size={17} color="#FFF" /></View></ImageBackground><Text numberOfLines={1} style={styles.title}>{title}</Text></View>;
}
const styles = StyleSheet.create({ wrapper: { width: 112 }, card: { width: 112, height: 102, overflow: 'hidden' }, image: { borderRadius: 11 }, heart: { position: 'absolute', right: 7, bottom: 6 }, title: { color: '#54464A', fontSize: 10, marginTop: 5 } });
