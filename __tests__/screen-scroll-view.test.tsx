import { render } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(),
}));

const mockUseSafeAreaInsets = jest.mocked(useSafeAreaInsets);

describe("ScreenScrollView", () => {
  beforeEach(() => {
    mockUseSafeAreaInsets.mockReturnValue({
      bottom: 34,
      left: 0,
      right: 0,
      top: 47,
    });
  });

  it("keeps the scroll viewport below the top safe area", () => {
    const { getByTestId, UNSAFE_getAllByType } = render(
      <ScreenScrollView
        bottomInsetPadding={40}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        testID="screen"
        topInsetPadding={16}
      >
        <Text>Feed</Text>
      </ScreenScrollView>
    );

    const containerStyle = StyleSheet.flatten(
      getByTestId("screen").props.contentContainerStyle
    );
    const viewport = UNSAFE_getAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.paddingTop === 47;
    });
    const viewportStyle = StyleSheet.flatten(viewport?.props.style);

    expect(containerStyle).toEqual(
      expect.objectContaining({
        paddingBottom: 74,
        paddingTop: 16,
      })
    );
    expect(viewportStyle).toEqual(
      expect.objectContaining({
        flex: 1,
        paddingTop: 47,
      })
    );
  });
});
