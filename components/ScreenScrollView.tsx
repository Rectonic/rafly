import { forwardRef, useMemo, type PropsWithChildren } from "react";
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenScrollViewProps = PropsWithChildren<
  ScrollViewProps & {
    bottomInsetPadding?: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    topInsetPadding?: number;
  }
>;

export const ScreenScrollView = forwardRef<ScrollView, ScreenScrollViewProps>(
  function ScreenScrollView(
    {
      bottomInsetPadding = 16,
      children,
      contentContainerStyle,
      topInsetPadding = 16,
      ...props
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle);
    const viewportStyle = useMemo(
      () => ({
        backgroundColor: flattenedContentStyle?.backgroundColor,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingTop: insets.top,
      }),
      [
        flattenedContentStyle?.backgroundColor,
        insets.left,
        insets.right,
        insets.top,
      ]
    );
    const safeContainerStyle = useMemo(
      () => ({
        paddingBottom: insets.bottom + bottomInsetPadding,
        paddingTop: topInsetPadding,
      }),
      [bottomInsetPadding, insets.bottom, topInsetPadding]
    );

    return (
      <View style={[styles.viewport, viewportStyle]}>
        <ScrollView
          {...props}
          contentContainerStyle={[contentContainerStyle, safeContainerStyle]}
          ref={ref}
          style={[styles.scrollView, props.style]}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  viewport: {
    flex: 1,
  },
});
