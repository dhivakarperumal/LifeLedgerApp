const { withAndroidStyles } = require("expo/config-plugins");

module.exports = function withAndroidNavigationBarColor(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults?.resources?.style ?? [];
    const appThemes = styles.filter((style) =>
      ["AppTheme", "Theme.App.SplashScreen"].includes(style.$?.name),
    );

    if (!appThemes.length) {
      return config;
    }

    const navigationBarItems = [
      {
        $: { name: "android:navigationBarColor", "tools:targetApi": "29" },
        _: "#000000",
      },
      {
        $: {
          name: "android:navigationBarDividerColor",
          "tools:targetApi": "28",
        },
        _: "#000000",
      },
      {
        $: {
          name: "android:windowLightNavigationBar",
          "tools:targetApi": "30",
        },
        _: "false",
      },
      {
        $: {
          name: "android:enforceNavigationBarContrast",
          "tools:targetApi": "29",
        },
        _: "false",
      },
    ];

    for (const theme of appThemes) {
      theme.item = [
        ...(theme.item ?? []).filter(
          (item) =>
            !navigationBarItems.some(
              (navigationBarItem) =>
                item?.$?.name === navigationBarItem.$.name,
            ),
        ),
        ...navigationBarItems,
      ];
    }

    return config;
  });
};
