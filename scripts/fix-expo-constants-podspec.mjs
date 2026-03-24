import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function replaceOnce(filePath, oldText, newText) {
  if (!existsSync(filePath)) {
    return;
  }

  const file = readFileSync(filePath, "utf8");

  if (file.includes(newText)) {
    return;
  }

  if (!file.includes(oldText)) {
    throw new Error(`Expected text not found in ${filePath}`);
  }

  writeFileSync(filePath, file.replace(oldText, newText));
}

replaceOnce(
  join(
    process.cwd(),
    "node_modules",
    "expo-constants",
    "ios",
    "EXConstants.podspec",
  ),
  ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",',
  ':script => "#{env_vars}bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",',
);

replaceOnce(
  join(process.cwd(), "ios", "LastBite.xcodeproj", "project.pbxproj"),
  "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`",
  '\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"',
);
