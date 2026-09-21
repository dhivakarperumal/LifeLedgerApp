const { withAndroidStyles } = require("expo/config-plugins");

module.exports = function withAndroidNavigationBarColor(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults?.resources?.style ?? [];
    const appTheme = styles.find((style) => style.$?.name === "AppTheme");

    if (!appTheme) {
      return config;
    }

    const colors = [
      {
        $: { name: "android:navigationBarColor", "tools:targetApi": "29" },
        _: "#000000",
      },
      {
        $: {
          name: "android:windowLightNavigationBar",
          "tools:targetApi": "30",
        },
        _: "false",
      },
    ];

    appTheme.item = [
      ...(appTheme.item ?? []).filter(
        (item) =>
          item?.$?.name !== "android:navigationBarColor" &&
          item?.$?.name !== "android:windowLightNavigationBar",
      ),
      ...colors,
    ];

    return config;
  });
};
