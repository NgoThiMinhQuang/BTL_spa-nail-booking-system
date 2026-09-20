import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const STEPS = [
  'Chọn dịch vụ\nNhân viên',
  'Chọn ngày\ngiờ',
  'Xác nhận\nthông tin',
  'Hoàn tất',
];

export function BookingProgress({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const completedWidth = `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` as `${number}%`;

  return <View style={styles.wrapper}>
    <View style={styles.stepsArea}>
      <View style={styles.track}><View style={[styles.completedTrack, { width: completedWidth }]} /></View>
      <View style={styles.stepRow}>
        {STEPS.map((_, index) => {
          const step = index + 1;
          const completed = step < currentStep;
          const active = step === currentStep;
          return <View key={step} style={[styles.circle, completed && styles.completedCircle, active && styles.activeCircle]}>
            {completed ? <Ionicons name="checkmark" size={18} color="#FFF" /> : <Text style={[styles.number, active && styles.activeNumber]}>{step}</Text>}
          </View>;
        })}
      </View>
    </View>
    <View style={styles.labels}>
      {STEPS.map((label, index) => <Text key={label} style={[styles.label, index + 1 === currentStep && styles.activeLabel]}>{label}</Text>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { paddingTop: 7, paddingBottom: 8 },
  stepsArea: { height: 38, marginHorizontal: 48, justifyContent: 'center' },
  track: { position: 'absolute', left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: '#E4DFE1', overflow: 'hidden' },
  completedTrack: { height: 3, borderRadius: 2, backgroundColor: '#D56B81' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEECEF', borderWidth: 3, borderColor: '#FFF9FA', alignItems: 'center', justifyContent: 'center' },
  completedCircle: { backgroundColor: '#55A875' }, activeCircle: { backgroundColor: '#D56B81' },
  number: { color: '#332E35', fontSize: 15, fontWeight: '800' }, activeNumber: { color: '#FFF' },
  labels: { marginTop: 4, paddingHorizontal: 17, flexDirection: 'row' },
  label: { flex: 1, minHeight: 34, color: '#8A8188', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  activeLabel: { color: '#30282B', fontWeight: '800' },
});
