/* global afterEach, describe, expect, it, jest */

const loadConfig = () => {
  jest.resetModules();
  return require("../react-native.config");
};

describe("react-native.config", () => {
  const originalDisableFlag = process.env.LASTBITE_DISABLE_IOS_MLKIT;

  afterEach(() => {
    if (originalDisableFlag === undefined) {
      delete process.env.LASTBITE_DISABLE_IOS_MLKIT;
    } else {
      process.env.LASTBITE_DISABLE_IOS_MLKIT = originalDisableFlag;
    }
  });

  it("keeps ML Kit autolinked for normal builds", () => {
    delete process.env.LASTBITE_DISABLE_IOS_MLKIT;

    expect(loadConfig()).toEqual({ dependencies: {} });
  });

  it("disables ML Kit iOS autolinking for simulator QA builds", () => {
    process.env.LASTBITE_DISABLE_IOS_MLKIT = "1";

    expect(loadConfig()).toEqual({
      dependencies: {
        "@react-native-ml-kit/text-recognition": {
          platforms: {
            ios: null,
          },
        },
      },
    });
  });
});
