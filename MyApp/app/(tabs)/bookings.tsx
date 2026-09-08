import { StyleSheet, Text, View } from 'react-native';

export default function BookingsScreen() {
  return <View style={styles.container}><Text style={styles.title}>Lịch hẹn của bạn</Text><View style={styles.notice}><Text style={styles.noticeText}>Danh sách lịch hẹn sẽ được tải từ tài khoản khách hàng.</Text></View></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 18, backgroundColor: '#FFF8FB' }, title: { fontSize: 28, fontWeight: '800' }, notice: { backgroundColor: '#EDF4F1', borderRadius: 14, padding: 16 }, noticeText: { color: '#49645F' } });
