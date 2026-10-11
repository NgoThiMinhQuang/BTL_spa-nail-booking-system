import { fetchInbox, markNotificationRead, type InboxItem } from '@/features/notifications/notification.service';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = { background: '#FFF9FA', surface: '#FFFFFF', pink: '#D56B81', text: '#30282B', muted: '#8A7D81', line: '#F0E7E9' };

export default function NotificationsScreen() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const inbox = await fetchInbox();
      setItems(inbox.items);
    } catch {
      /* Mất mạng thì giữ danh sách cũ. */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function openItem(item: InboxItem) {
    if (item.status !== 'READ') {
      try {
        await markNotificationRead(item.id);
      } catch {
        /* Lỗi mạng thì lần mở sau đánh dấu lại. */
      }
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status: 'READ' } : row)));
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#D56B81" />}
        contentContainerStyle={styles.container}
      >
        <Text style={styles.title}>Thông báo</Text>
        <Text style={styles.subtitle}>Lịch hẹn bị ảnh hưởng, đổi lịch và hoàn tiền hiện ở đây.</Text>
        {loading && items.length === 0 ? (
          <ActivityIndicator size="large" color="#D56B81" style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={34} color="#A89A9D" />
            <Text style={styles.emptyText}>Chưa có thông báo nào.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const unread = item.status !== 'READ';
              return (
                <Pressable key={item.id} onPress={() => openItem(item)}
                  style={[styles.card, unread && styles.cardUnread]}>
                  <View style={styles.cardHead}>
                    {unread && <View style={styles.dot} />}
                    <Text style={[styles.cardTitle, unread && styles.cardTitleUnread]}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardBody}>{item.body}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 12 },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  list: { gap: 10 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  cardUnread: { borderColor: '#EFC3CE', backgroundColor: '#FFF5F7' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.pink },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardTitleUnread: { fontWeight: '800' },
  cardBody: { color: '#5A4A52', fontSize: 13.5, lineHeight: 20, marginTop: 6 },
});
