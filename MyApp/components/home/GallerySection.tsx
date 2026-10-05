import { Image, ScrollView, StyleSheet, View } from "react-native";

export function GallerySection() {
  const images = [
    { id: 1, uri: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=600&q=80' }, // Hands / nails working
    { id: 2, uri: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80' }, // Hands
    { id: 3, uri: 'https://images.unsplash.com/photo-1596178018260-1e52db0eb867?w=600&q=80' }, // Spa interior
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryList}>
      {images.map((img) => (
        <View key={img.id} style={styles.imageContainer}>
          <Image source={{ uri: img.uri }} style={styles.image} resizeMode="cover" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  galleryList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  imageContainer: {
    width: 260,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
