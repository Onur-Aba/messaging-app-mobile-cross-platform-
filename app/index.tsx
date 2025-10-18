// app/index.tsx
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "./(tabs)/Firebaseconfig";

export default function Index() {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Eğer kullanıcı zaten giriş yaptıysa master sayfasına git
        router.replace("/(tabs)/master");
      } else {
        // Eğer giriş yapılmamışsa login sayfasına git
        router.replace("/(tabs)/login");
      }
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  if (checkingAuth) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#800020" />
      </View>
    );
  }

  return null;
}
