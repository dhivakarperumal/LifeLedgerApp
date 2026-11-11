const { withGradleProperties } = require("expo/config-plugins");

const properties = [
  { key: "expo.android.cmakeObjectPathMax", value: "1024" },
  { key: "android.cmakeVersion", value: "3.31.6" },
];

module.exports = function withAndroidCmakeObjectPathMax(config) {
  return withGradleProperties(config, (config) => {
    for (const { key, value } of properties) {
      const property = config.modResults.find(
        (item) => item.type === "property" && item.key === key,
      );

      if (property) {
        property.value = value;
      } else {
        config.modResults.push({
          type: "property",
          key,
          value,
        });
      }
    }

    return config;
  });
};
