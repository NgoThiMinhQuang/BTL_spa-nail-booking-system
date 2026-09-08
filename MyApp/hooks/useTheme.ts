import { Colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';

export function useTheme() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colorScheme, colors: Colors[colorScheme] };
}
