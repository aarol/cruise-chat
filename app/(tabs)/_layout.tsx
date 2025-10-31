import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useTheme } from "react-native-paper";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";

// Material Design 3 tab bar icon component
function TabBarIcon(props: {
  name: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  size?: number;
}) {
  return <MaterialIcons size={24} {...props} />;
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 16,
          paddingTop: 8,
          elevation: 8,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        headerTitleStyle: {
          color: theme.colors.onSurface,
          fontSize: 22,
          fontWeight: "500",
        },
        headerTintColor: theme.colors.onSurface,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "General Chat",
          tabBarIcon: ({ color, size = 24 }) => (
            <TabBarIcon name="chat" color={color} size={size} />
          ),
          tabBarLabel: "Chat",
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: "Rooms",
          tabBarIcon: ({ color, size = 24 }) => (
            <TabBarIcon name="group" color={color} size={size} />
          ),
          tabBarLabel: "Rooms",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size = 24 }) => (
            <TabBarIcon name="settings" color={color} size={size} />
          ),
          tabBarLabel: "Settings",
        }}
      />
    </Tabs>
  );
}
