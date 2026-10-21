import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { NotificationRouter } from "@/src/components/notification-router";
import { queryClient } from "@/src/query-client";
import { SettingsProvider } from "@/src/settings-context";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <SettingsProvider>
            <KeyboardProvider>
              <StatusBar style="light" />
              {Platform.OS !== "web" ? <NotificationRouter /> : null}
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#0B0F19" },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="alarm-setup"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen name="calendar" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="kathas" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="tracker" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="katha/[id]" options={{ animation: "slide_from_right" }} />
                <Stack.Screen
                  name="share"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
              </Stack>
            </KeyboardProvider>
            </SettingsProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
