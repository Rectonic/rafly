import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patchFile(relativePath, replacements) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    return;
  }

  let contents = fs.readFileSync(filePath, "utf8");
  let patched = contents;

  for (const [from, to] of replacements) {
    patched = patched.replace(from, to);
  }

  if (patched !== contents) {
    fs.writeFileSync(filePath, patched);
    console.log(`Patched ${relativePath}`);
  }
}

patchFile("node_modules/expo-constants/scripts/get-app-config-ios.sh", [
  ["PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)", 'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")'],
]);

patchFile("node_modules/expo-constants/scripts/build/getAppConfig.js", [
  [
    `const { exp } = (0, config_1.getConfig)(projectRoot, {
    isPublicConfig: true,
    skipSDKVersionRequirement: true,
});`,
    `let exp;
const appJsonPath = path_1.default.join(projectRoot, 'app.json');
if (fs_1.default.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs_1.default.readFileSync(appJsonPath, 'utf8'));
    if (appJson && typeof appJson.expo === 'object') {
        exp = appJson.expo;
    }
}
if (!exp) {
    exp = (0, config_1.getConfig)(projectRoot, {
        isPublicConfig: true,
        skipSDKVersionRequirement: true,
    }).exp;
}
fs_1.default.mkdirSync(destinationDir, { recursive: true });`,
  ],
]);

patchFile("node_modules/react-native/scripts/react_native_pods_utils/script_phases.sh", [
  [
    'JS_SRCS=$(find $PODS_TARGET_SRCROOT/$SRCS_DIR -type f -name "$SRCS_PATTERN" -print0 | xargs -0)',
    'JS_SRCS=$(find "$PODS_TARGET_SRCROOT/$SRCS_DIR" -type f -name "$SRCS_PATTERN" -print0 | xargs -0)',
  ],
]);
