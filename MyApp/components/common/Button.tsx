import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

type Props = PressableProps & { title: string };

export function Button({ title, style, ...props }: Props) {
  return <Pressable style={(state) => [styles.button, state.pressed && styles.pressed, typeof style === 'function' ? style(state) : style]} {...props}><Text style={styles.text}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({ button: { backgroundColor: '#C94F7C', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center' }, pressed: { opacity: 0.75 }, text: { color: '#FFF', fontSize: 16, fontWeight: '700' } });
