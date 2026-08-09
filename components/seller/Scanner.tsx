import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useT } from "@/i18n";
import { parseExpiryDate, type ExpiryResult } from "@/lib/seller/expiry-parser";
import { recognizeTextFromImage } from "@/lib/text-recognition";

type ScannerProps = {
  mode: "barcode" | "ocr";
  onClose: () => void;
  onScan: (value: string | ExpiryResult) => void;
  visible: boolean;
};

export function Scanner({ mode, onClose, onScan, visible }: ScannerProps) {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (mode !== "barcode") {
        return;
      }

      onScan(result.data);
      onClose();
    },
    [mode, onClose, onScan]
  );

  const captureForOcr = useCallback(async () => {
    if (mode !== "ocr" || !cameraRef.current || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setOcrError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      const recognizedText = await recognizeTextFromImage(photo.uri);
      onScan(parseExpiryDate(recognizedText));
      onClose();
    } catch (error) {
      setOcrError(
        error instanceof Error ? error.message : t.scanner.unableToReadLabel
      );
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, mode, onClose, onScan, t.scanner.unableToReadLabel]);

  const content = useMemo(() => {
    if (!permission) {
      return <ActivityIndicator color="#16C79A" />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.body}>{t.scanner.cameraRequired}</Text>
          <Pressable
            accessibilityLabel={t.scanner.grantCameraAccess}
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={styles.button}
            testID="scanner-grant-access-button"
          >
            <Text style={styles.buttonText}>{t.scanner.grantAccess}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t.scanner.openSettings}
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={styles.secondaryButton}
            testID="scanner-open-settings-button"
          >
            <Text style={styles.secondaryButtonText}>{t.scanner.openSettings}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrap}>
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "qr"],
          }}
          onBarcodeScanned={mode === "barcode" ? onBarcodeScanned : undefined}
          ref={cameraRef}
          style={styles.camera}
        />
        {mode === "ocr" ? (
          <>
            {ocrError ? <Text style={styles.errorText}>{ocrError}</Text> : null}
            <Pressable
              accessibilityLabel={t.scanner.captureLabel}
              accessibilityRole="button"
              onPress={() => void captureForOcr()}
              style={styles.button}
              testID="scanner-capture-label-button"
            >
              <Text style={styles.buttonText}>
                {isProcessing ? t.scanner.reading : t.scanner.captureLabel}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }, [
    captureForOcr,
    isProcessing,
    mode,
    ocrError,
    onBarcodeScanned,
    permission,
    requestPermission,
    t.scanner.cameraRequired,
    t.scanner.captureLabel,
    t.scanner.grantAccess,
    t.scanner.grantCameraAccess,
    t.scanner.openSettings,
    t.scanner.reading,
  ]);

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="scanner-modal">
          <Text style={styles.title}>
            {mode === "barcode" ? t.scanner.scanBarcode : t.scanner.readExpiryDate}
          </Text>
          {content}
          <Pressable
            accessibilityLabel={t.scanner.closeScanner}
            accessibilityRole="button"
            onPress={onClose}
            style={styles.secondaryButton}
            testID="scanner-close-button"
          >
            <Text style={styles.secondaryButtonText}>{t.scanner.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#4B5563",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#16C79A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  camera: {
    borderRadius: 16,
    height: 280,
    width: "100%",
  },
  cameraWrap: {
    gap: 12,
    width: "100%",
  },
  center: {
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 18,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  secondaryButton: {
    alignSelf: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    gap: 16,
    padding: 20,
    width: "100%",
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
});
