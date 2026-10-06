import { useFavorites } from "@/contexts/FavoritesContext";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, Pressable, Image } from "react-native";

export function NailCard({
  id,
  title,
  imageUrl,
  isReversed = false,
  index = 0,
}: {
  id?: string;
  title: string;
  imageUrl?: string;
  isReversed?: boolean;
  index?: number;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = id ? isFavorite(id) : false;

  const handleFavorite = () => {
    if (id) {
      toggleFavorite({ id, name: title, imageUrl, type: 'design' });
    }
  };
  const getLocalImage = (i: number) => {
    if (i === 0) return require('@/assets/images/nails/nail_blush_french.png');
    if (i === 1) return require('@/assets/images/nails/nail_pink_blossom.png');
    if (i === 2) return require('@/assets/images/nails/nail_nude_garden.png');
    return require('@/assets/images/nails/nail-collection-v2.png');
  };

  const source = getLocalImage(index);

  return (
    <Pressable style={({ pressed }) => [
      styles.cardContainer,
      pressed && { opacity: 0.9 }
    ]}>
      {isReversed ? (
        <>
          {/* Content Side (Left) */}
          <View style={styles.contentBox}>
            <Text style={styles.subtitle}>Hot Trend</Text>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <View style={styles.actionButton}>
              <Text style={styles.actionText}>Khám phá</Text>
              <Ionicons name="arrow-forward" size={14} color="#D56B81" />
            </View>
          </View>

          {/* Image Side (Right) */}
          <View style={styles.imageBox}>
            <Image
              source={source}
              resizeMode="cover"
              style={styles.image}
            />
            <Pressable onPress={handleFavorite} style={[styles.heart, { right: 8 }]}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={16} color={isFav ? "#D56B81" : "#FFF"} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Image Side (Left) */}
          <View style={styles.imageBox}>
            <Image
              source={source}
              resizeMode="cover"
              style={styles.image}
            />
            <Pressable onPress={handleFavorite} style={[styles.heart, { left: 8 }]}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={16} color={isFav ? "#D56B81" : "#FFF"} />
            </Pressable>
          </View>

          {/* Content Side (Right) */}
          <View style={styles.contentBox}>
            <Text style={styles.subtitle}>Hot Trend</Text>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <View style={styles.actionButton}>
              <Text style={styles.actionText}>Khám phá</Text>
              <Ionicons name="arrow-forward" size={14} color="#D56B81" />
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F5ECEF',
  },
  imageBox: {
    width: '50%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heart: {
    position: 'absolute',
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  contentBox: {
    width: '50%',
    padding: 16,
    justifyContent: 'center',
  },
  subtitle: {
    color: '#D56B81',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: '#333333',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#D56B81',
    fontSize: 14,
    fontWeight: '700',
  },
});
