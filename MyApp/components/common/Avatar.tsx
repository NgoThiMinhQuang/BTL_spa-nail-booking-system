import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';

export function Avatar({ source, size = 44 }: { source: ImageSourcePropType; size?: number }) {
  return <Image source={source} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
}

const styles = StyleSheet.create({ image: { backgroundColor: '#F2DDE5' } });
