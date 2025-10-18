// app/register.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { auth, db } from "../(tabs)/Firebaseconfig";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";
import { router } from "expo-router";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Hata", "Şifreler uyuşmuyor.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Hata", "Lütfen bir kullanıcı adı girin.");
      return;
    }

    setLoading(true);

    try {
      // Kullanıcı adı kontrolü
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        Alert.alert("Hata", "Bu kullanıcı adı zaten alınmış.");
        setLoading(false);
        return;
      }

      // Yeni kullanıcı oluşturma
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", email), {
        uid: user.uid,
        username,
        email,
      });

      Alert.alert("Başarılı 🎉", "Kayıt işlemi tamamlandı!");
      router.replace("/login"); // ✅ Login ekranına yönlendir
    } catch (error) {
      Alert.alert("Hata", "Kayıt başarısız oldu. Lütfen tekrar deneyin.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.push("/login"); // ✅ router.push ile yönlendirme
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kayıt Ol</Text>

      <TextInput
        style={styles.input}
        placeholder="Kullanıcı Adı"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Şifreyi Onayla"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Kayıt Ol</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Hesabın var mı?{" "}
        <Text style={styles.registerLink} onPress={handleGoToLogin}>
          Giriş Yap
        </Text>
      </Text>
    </View>
  );
};

export default Register;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
    color: "#333",
  },
  input: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#800020",
    paddingVertical: 14,
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
    marginTop: 18,
    fontSize: 15,
    color: "#333",
    textAlign: "center",
  },
  registerLink: {
    color: "#800020",
    textDecorationLine: "underline",
  },
});
