import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PaperProvider, adaptNavigationTheme } from "react-native-paper";
import { StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import db from "@/database";
import migrations from "@/drizzle/migrations";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import "react-native-get-random-values";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { paperTheme } from "@/constants/themes/paperTheme";

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme,
});

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: paperTheme.colors.primary,
  },
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on modals keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  const { success: migrationSuccess, error: migrationErrors } = useMigrations(
    db,
    migrations,
  );

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && migrationSuccess) {
      SplashScreen.hideAsync();
    }
  }, [loaded, migrationSuccess]);

  // Show loading screen while fonts or database are loading
  if (!loaded || !migrationSuccess) {
    if (migrationErrors) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Database initialization failed:</Text>
          <Text style={styles.errorMessage}>{migrationErrors.message}</Text>
        </View>
      );
    }
    return null; // Show splash screen
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar
          style="dark" // there is currently only a light theme, so make the statusbar dark.
          backgroundColor="transparent"
          translucent={true}
        />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="Welcome" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 10,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
