import { NativeModules } from "react-native";

export const OCR_UNAVAILABLE_MESSAGE =
  "OCR is unavailable in this simulator build. Test OCR on a physical iPhone.";

type NativeModuleRegistry = Record<string, unknown>;

type TextRecognitionModule = {
  default: {
    recognize: (imageUri: string) => Promise<{ text: string }>;
  };
};

type RecognizeTextOptions = {
  loadModule?: () => Promise<TextRecognitionModule>;
  nativeModules?: NativeModuleRegistry;
};

function isMlkitLinkingError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("@react-native-ml-kit/text-recognition") &&
    error.message.includes("linked")
  );
}

export function createRecognizeTextFromImage({
  loadModule = () => import("@react-native-ml-kit/text-recognition"),
  nativeModules = NativeModules,
}: RecognizeTextOptions = {}) {
  return async (imageUri: string) => {
    if (!nativeModules.TextRecognition) {
      throw new Error(OCR_UNAVAILABLE_MESSAGE);
    }

    try {
      const { default: TextRecognition } = await loadModule();
      const recognized = await TextRecognition.recognize(imageUri);
      return recognized.text;
    } catch (error) {
      if (isMlkitLinkingError(error)) {
        throw new Error(OCR_UNAVAILABLE_MESSAGE);
      }

      throw error;
    }
  };
}

export const recognizeTextFromImage = createRecognizeTextFromImage();
