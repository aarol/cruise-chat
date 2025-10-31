import { MD3LightTheme } from "react-native-paper";

const generatedTheme = {
  colors: {
    primary: "#FFCF00",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E6D89D",
    onPrimaryContainer: "#332900",
    secondary: "#FFCF00",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#E6D89D",
    onSecondaryContainer: "#002133",
    tertiary: "#DDB900",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E6DA9D",
    onTertiaryContainer: "#332B00",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#E6ACA9",
    onErrorContainer: "#330B09",
    background: "#fcfcfb",
    onBackground: "#333330",
    surface: "#fdfdfdff",
    onSurface: "#333330",
    surfaceVariant: "#e6e6e4ff",
    onSurfaceVariant: "#666252",
    outline: "#99937a",
    elevation: {
      level0: "transparent",
      level1: "rgb(248, 243, 242)",
      level2: "rgba(240, 240, 240, 1)",
      level3: "rgba(244, 244, 244, 1)",
      level4: "rgba(236, 236, 236, 1)",
      level5: "rgba(235, 235, 235, 1)",
    },
    surfaceDisabled: "rgba(30, 27, 22, 0.12)",
    onSurfaceDisabled: "rgba(30, 27, 22, 0.38)",
    backdrop: "rgba(54, 48, 36, 0.4)",
  },
};

export const paperTheme = {
  ...MD3LightTheme,
  ...generatedTheme,
};

export type AppTheme = typeof paperTheme;
