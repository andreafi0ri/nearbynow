const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.resolverMainFields = ["react-native", "browser", "main"];

const rnPkg   = path.resolve(__dirname, "node_modules/react-native");
const emptyMod = path.resolve(__dirname, "src/stubs/empty.js");

// Packages that are native-only and have no web equivalent — stub them out.
const NATIVE_ONLY = new Set([
  "react-native-maps",
  "react-native-maps/lib/decorateMapComponent",
  "@rnmapbox/maps",
  "@react-native-community/geolocation",
  "expo-notifications",
  "expo-device",
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    // 1. Bare `react-native` → react-native-web.
    if (moduleName === "react-native") {
      return { type: "sourceFile", filePath: require.resolve("react-native-web") };
    }

    // 2. Native-only packages → empty stub so they don't throw at load time.
    if (NATIVE_ONLY.has(moduleName) || moduleName.startsWith("react-native-maps/") || moduleName.startsWith("@rnmapbox/maps/")) {
      return { type: "sourceFile", filePath: emptyMod };
    }

    // 3. `react-native/Libraries/…` path imports → try react-native-web equivalent,
    //    fall back to an empty stub so native bridge code never executes.
    if (moduleName.startsWith("react-native/")) {
      const webPath = moduleName.replace(/^react-native\//, "react-native-web/");
      try {
        return { type: "sourceFile", filePath: require.resolve(webPath) };
      } catch {
        return { type: "sourceFile", filePath: emptyMod };
      }
    }

    // 4. Relative imports FROM inside node_modules/react-native/ → empty stub.
    //    Prevents Platform.ios.js → NativeModules → BatchedBridge chain on web.
    const from = context.originModulePath ?? "";
    if (from.startsWith(rnPkg + "/") && !from.includes("/react-native-web/")) {
      return { type: "sourceFile", filePath: emptyMod };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
