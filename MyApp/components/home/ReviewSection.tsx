import { fetchRecentReviews, type RecentReview } from "@/features/home/home.service";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

export function ReviewSection() {
  const [reviews, setReviews] = useState<RecentReview[] | null>(null);

  useEffect(() => {
    fetchRecentReviews(6).then(setReviews).catch(() => setReviews([]));
  }, []);

  /* Chưa tải xong thì hiện khung chờ; không có đánh giá thật thì nói rõ
     chứ không bịa review và ảnh mạng. */
  if (reviews === null) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Đang tải đánh giá...</Text>
      </View>
    );
  }
  if (reviews.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Chưa có đánh giá nào. Trải nghiệm xong hãy để lại cảm nhận nhé!</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewList}>
      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <View style={styles.header}>
            {review.customerAvatarUrl ? (
              <Image source={{ uri: review.customerAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {(review.customerName || 'K').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.name}>{review.customerName}</Text>
              <View style={styles.stars}>
                {[...Array(Math.max(0, Math.min(5, review.rating)))].map((_, i) => (
                  <Ionicons key={i} name="star" size={12} color="#F2C94C" />
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.comment} numberOfLines={3}>"{review.comment || 'Khách hàng chấm ' + review.rating + ' sao.'}"</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reviewList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: 280,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5ECEF',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5ECEF',
  },
  avatarText: { color: '#A04763', fontSize: 16, fontWeight: '700' },
  placeholder: { paddingHorizontal: 16, paddingVertical: 10 },
  placeholderText: { color: '#867C7F', fontSize: 13 },
  name: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '700',
  },
  stars: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 2,
  },
  comment: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
