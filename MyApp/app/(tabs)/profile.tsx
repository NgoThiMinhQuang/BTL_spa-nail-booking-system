import { Avatar } from '@/components/common/Avatar';
import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return <View style={styles.container}><Avatar source={require('@/assets/images/avatar/user.png')} size={88} /><Text style={styles.title}>Khách hàng</Text><Text style={styles.subtitle}>Quản lý thông tin và lịch hẹn của bạn</Text></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', padding: 32, gap: 10, backgroundColor: '#FFF8FB' }, title: { fontSize: 24, fontWeight: '800' }, subtitle: { color: '#806F78' } });
