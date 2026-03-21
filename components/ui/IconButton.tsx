import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

interface IconButtonProps extends PressableProps {
  style?: ViewStyle;
  size?: number;
  children: React.ReactNode;
}

export function IconButton({ children, style, size = 36, ...rest }: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    // Dark scrim for use over images (e.g. offer card photo).
    // Override via `style` prop when using on plain backgrounds.
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pressed: { opacity: 0.7 },
});
