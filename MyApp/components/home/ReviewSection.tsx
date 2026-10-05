import { Ionicons } from "@expo/vector-icons";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

export function ReviewSection() {
  const reviews = [
    {
      id: 1,
      name: 'Ngọc Lan',
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
      comment: 'Nhân viên vô cùng nhiệt tình, làm móng rất kỹ và đẹp. Không gian spa chill lắm luôn!',
      rating: 5,
    },
    {
      id: 2,
      name: 'Bích Phương',
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e',
      comment: 'Mình đã book lịch ở đây 3 lần và chưa bao giờ thất vọng. Dụng cụ cực kỳ sạch sẽ và vô trùng tốt.',
      rating: 5,
    },
    {
      id: 3,
      name: 'Lê Mai',
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f',
      comment: 'Các bạn tư vấn màu sơn rất hợp với da mình. Sẽ quay lại nhiều lần nữa!',
      rating: 5,
    },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewList}>
      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <View style={styles.header}>
            <Image source={{ uri: review.avatar }} style={styles.avatar} />
            <View>
              <Text style={styles.name}>{review.name}</Text>
              <View style={styles.stars}>
                {[...Array(review.rating)].map((_, i) => (
                  <Ionicons key={i} name="star" size={12} color="#F2C94C" />
                ))}
              </View>
            </View>
          </View>
          <Text style={styles.comment} numberOfLines={3}>"{review.comment}"</Text>
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
