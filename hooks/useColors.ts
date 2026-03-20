import { useColorScheme } from 'react-native';
import { Colors, ColorScheme } from '@/constants/colors';

export function useColors() {
  const raw = useColorScheme() ?? 'light';
  const scheme: ColorScheme = raw === 'dark' ? 'dark' : 'light';
  return Colors[scheme];
}
