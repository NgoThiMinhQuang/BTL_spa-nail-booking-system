import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

export function NailCard({ title, position = '50%' }: { title: string; position?: string }) {
  return <View style={styles.wrapper}><ImageBackground source={require('@/assets/images/nails/nail-collection-v2.png')} resizeMode="cover" imageStyle={styles.image} style={styles.card}><View style={styles.heart}><Ionicons name="heart-outline" size={17} color="#FFF" /></View></ImageBackground><Text numberOfLines={1} style={styles.title}>{title}</Text><Text style={styles.hidden}>{position}</Text></View>;
}
const styles = StyleSheet.create({ wrapper: { width: 112 }, card: { width: 112, height: 102, overflow: 'hidden' }, image: { borderRadius: 11 }, heart: { position: 'absolute', right: 7, bottom: 6, textShadowColor: '#6A3C49', textShadowRadius: 4 }, title: { color: '#54464A', fontSize: 10, marginTop: 5 }, hidden: { display: 'none' } });
