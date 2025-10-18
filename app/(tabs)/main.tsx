// ver1/app/(tabs)/main.tsx
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { auth } from "../(tabs)/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import { router } from "expo-router";

const Main: React.FC = () => {
  useEffect(() => {
    // 🔹 Kullanıcı oturum durumuna göre yönlendir
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Giriş yapılmış -> ana sayfaya yönlendir
        router.replace("/master");
      } else {
        // Giriş yapılmamış -> login ekranına yönlendir
        router.replace("/login");
      }
    });

    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#800020" />
      <Text style={styles.text}>Yükleniyor...</Text>
    </View>
  );
};

export default Main;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: 10,
    color: "#333",
    fontSize: 16,
  },
});
