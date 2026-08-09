import {
  createRecognizeTextFromImage,
  OCR_UNAVAILABLE_MESSAGE,
} from "@/lib/text-recognition";

describe("createRecognizeTextFromImage", () => {
  it("reports OCR unavailable before importing ML Kit when the native module is absent", async () => {
    const loadModule = jest.fn();
    const recognizeText = createRecognizeTextFromImage({
      loadModule,
      nativeModules: {},
    });

    await expect(recognizeText("file:///label.jpg")).rejects.toThrow(
      OCR_UNAVAILABLE_MESSAGE
    );
    expect(loadModule).not.toHaveBeenCalled();
  });

  it("returns recognized text when the native module is linked", async () => {
    const recognize = jest.fn().mockResolvedValue({
      blocks: [],
      text: "Best before 2026-06-01",
    });
    const recognizeText = createRecognizeTextFromImage({
      loadModule: async () => ({
        default: { recognize },
      }),
      nativeModules: { TextRecognition: {} },
    });

    await expect(recognizeText("file:///label.jpg")).resolves.toBe(
      "Best before 2026-06-01"
    );
    expect(recognize).toHaveBeenCalledWith("file:///label.jpg");
  });

  it("normalizes ML Kit linking errors to the simulator OCR message", async () => {
    const recognizeText = createRecognizeTextFromImage({
      loadModule: async () => ({
        default: {
          recognize: async () => {
            throw new Error(
              "The package '@react-native-ml-kit/text-recognition' doesn't seem to be linked."
            );
          },
        },
      }),
      nativeModules: { TextRecognition: {} },
    });

    await expect(recognizeText("file:///label.jpg")).rejects.toThrow(
      OCR_UNAVAILABLE_MESSAGE
    );
  });
});
