// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "@react-navigation/native";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { StatusBar } from "expo-status-bar";

export const unstable_settings = {
  initialRouteName: "(tabs)/main", // 🔹 Uygulama açılışında main.tsx çalışacak
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Ana sekme yapısı */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Auth sayfaları */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />

        {/* Uygulama sayfaları */}
        <Stack.Screen name="master" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="callpage" options={{ headerShown: false }} />
        <Stack.Screen name="groupcreate" options={{ headerShown: false }} />
        <Stack.Screen name="group/[groupId]" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[groupId]" options={{ headerShown: false }} />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
