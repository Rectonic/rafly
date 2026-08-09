import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";

import { useT } from "@/i18n";
import {
  LocaleProvider,
  useLocale,
  useSetLocale,
} from "@/lib/locale-store";

const mockGetItem = jest.fn((_key: string) => Promise.resolve("en"));
const mockSetItem = jest.fn((_key: string, _value: string) => Promise.resolve());

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
}));

function LocaleProbe() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <View>
      <Text testID="locale-value">{locale}</Text>
      <Text testID="settings-title">{t.settings.title}</Text>
      <Pressable
        onPress={() => void setLocale("ru")}
        testID="switch-language-ru"
      >
        <Text>RU</Text>
      </Pressable>
    </View>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  it("updates visible UI copy immediately after switching language", async () => {
    const screen = render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("settings-title")).toHaveTextContent("Settings")
    );

    fireEvent.press(screen.getByTestId("switch-language-ru"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-title")).toHaveTextContent("Настройки")
    );
    expect(screen.getByTestId("locale-value")).toHaveTextContent("ru");
    expect(mockSetItem).toHaveBeenCalledWith("lastbite-locale", "ru");
  });
});
