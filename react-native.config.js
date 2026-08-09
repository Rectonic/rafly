const disableIosMlkit = process.env.LASTBITE_DISABLE_IOS_MLKIT === "1";

module.exports = {
  dependencies: disableIosMlkit
    ? {
        "@react-native-ml-kit/text-recognition": {
          platforms: {
            ios: null,
          },
        },
      }
    : {},
};
