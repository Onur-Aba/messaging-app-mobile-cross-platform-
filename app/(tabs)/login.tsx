// app/(tabs)/login.tsx
import { router } from "expo-router";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "./Firebaseconfig";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 🔹 Kullanıcı zaten giriş yapmış mı kontrol et
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Kullanıcı zaten giriş yaptıysa direkt master sayfasına gönder
        router.replace("/(tabs)/master");
      } else {
        setCheckingAuth(false); // Giriş yapılmamış, formu göster
      }
    });

    return unsubscribe; // cleanup
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Lütfen email ve şifre alanlarını doldurun.");
      setShowPopup(true);
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/(tabs)/master"); // ✅ yönlendirme
    } catch (err: any) {
      let errorMessage = "Bilinmeyen bir hata oluştu.";
      if (err.code === "auth/invalid-credential") {
        errorMessage = "Email ya da parola yanlış, lütfen tekrar deneyin.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage =
          "Çok fazla başarısız giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Geçersiz email formatı.";
      }
      setError(errorMessage);
      setShowPopup(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToRegister = () => {
    router.push("/(tabs)/register");
  };

  if (checkingAuth) {
    // 🔹 Giriş durumu kontrol edilirken yükleniyor göstergesi
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#800020" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Giriş Yap</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Şifre"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Giriş Yap</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Hesabın yok mu?{" "}
        <Text onPress={handleGoToRegister} style={styles.registerLink}>
          Kayıt Ol
        </Text>
      </Text>

      {/* Popup (Modal) */}
      <Modal
        visible={showPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPopup(false)}
      >
        <Pressable
          style={styles.popupOverlay}
          onPress={() => setShowPopup(false)}
        >
          <View style={styles.popup}>
            <Text style={styles.popupText}>{error}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#222",
  },
  input: {
    height: 45,
    width: "90%",
    backgroundColor: "#fff",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    width: "90%",
    backgroundColor: "#800020",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerText: {
    marginTop: 15,
    fontSize: 14,
    color: "#333",
  },
  registerLink: {
    color: "#800020",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  popup: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    maxWidth: 300,
    alignItems: "center",
    elevation: 5,
  },
  popupText: {
    color: "#333",
    fontSize: 16,
    textAlign: "center",
  },
});
