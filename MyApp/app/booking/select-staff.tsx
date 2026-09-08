import { Button } from '@/components/common/Button';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SelectStaffScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  return <View style={styles.container}><Text style={styles.title}>Chọn nhân viên</Text>{['Linh', 'An', 'Mai'].map((name) => <Button key={name} title={name} onPress={() => router.push({ pathname: '/booking/confirm', params: { serviceId, staffId: name } })} />)}</View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, gap: 14 }, title: { fontSize: 26, fontWeight: '800', marginBottom: 8 } });
