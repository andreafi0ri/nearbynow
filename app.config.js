// app.config.js — extends app.json, adds native-only plugins conditionally.
//
// @rnmapbox/maps has a broken ESM module structure (lib/module/index.js uses
// extensionless ESM imports) that crashes Node.js when Expo loads it as a
// plugin via the package name. To avoid this, the plugin is applied here via
// its direct CJS path only when not building for web.
//
// Web builds:  `expo export -p web` → EXPO_PLATFORM=web → plugin skipped
// Native builds: `expo prebuild`   → no EXPO_PLATFORM  → plugin applied

const appJson = require("./app.json");

const isWeb = process.env.EXPO_PLATFORM === "web" || process.env.VERCEL === "1";

module.exports = ({ config }) => {
  const base = { ...appJson.expo, ...config };

  const nativePlugins = isWeb
    ? []
    : [
        [
          // Use direct CJS path to bypass the broken ESM main entry.
          // .default because withMapbox.js exports the plugin as exports.default
          require("./node_modules/@rnmapbox/maps/app.plugin.js").default,
          { RNMapboxMapsDownloadToken: "EXPO_PUBLIC_MAPBOX_KEY" },
        ],
      ];

  return {
    ...base,
    plugins: [...(base.plugins ?? []), ...nativePlugins],
  };
};
