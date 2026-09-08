import { StyleSheet, View, type ViewProps } from 'react-native';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({ card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#4A2432', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 } });
