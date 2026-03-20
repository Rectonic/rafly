import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/colors';

export function useColors() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  return Colors[scheme];
}
