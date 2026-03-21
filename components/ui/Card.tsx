import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Card({ style, children, ...rest }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.shadow,
        { shadowColor: colors.foreground },
      ]}
    >
      <View
        style={[
          styles.clip,
          { backgroundColor: colors.card, borderColor: colors.border },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 16,
    // iOS shadow on outer view (not clipped by overflow:hidden)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  clip: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
