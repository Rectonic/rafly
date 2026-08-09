import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";

import { Scanner } from "@/components/seller/Scanner";

const mockCreateElement = React.createElement;
const mockView = View;
const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean } | null = { granted: false };

jest.mock("expo-camera", () => ({
  CameraView: () => mockCreateElement(mockView, { testID: "camera-view" }),
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));

jest.mock("expo-linking", () => ({
  openSettings: jest.fn(),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "ru",
}));

jest.mock("@/lib/text-recognition", () => ({
  recognizeTextFromImage: jest.fn(),
}));

describe("Scanner localization", () => {
  beforeEach(() => {
    mockPermission = { granted: false };
    mockRequestPermission.mockReset();
  });

  it("renders camera permission actions in Russian", () => {
    const screen = render(
      <Scanner
        mode="barcode"
        onClose={jest.fn()}
        onScan={jest.fn()}
        visible
      />
    );

    expect(screen.getByText("Сканировать штрих-код")).toBeTruthy();
    expect(screen.getByText("Для сканирования нужен доступ к камере.")).toBeTruthy();
    expect(screen.getByText("Разрешить доступ")).toBeTruthy();
    expect(screen.getByText("Открыть настройки")).toBeTruthy();
    expect(screen.getByText("Закрыть")).toBeTruthy();
    expect(screen.queryByText("Scan barcode")).toBeNull();
    expect(screen.queryByText("Grant access")).toBeNull();
  });

  it("renders OCR capture actions in Russian", () => {
    mockPermission = { granted: true };

    const screen = render(
      <Scanner
        mode="ocr"
        onClose={jest.fn()}
        onScan={jest.fn()}
        visible
      />
    );

    expect(screen.getByText("Считать срок годности")).toBeTruthy();
    expect(screen.getByText("Снять этикетку")).toBeTruthy();
    expect(screen.queryByText("Read expiry date")).toBeNull();
    expect(screen.queryByText("Capture label")).toBeNull();
  });
});
