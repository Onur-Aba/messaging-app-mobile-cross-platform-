// app/invite.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { auth, db } from "../(tabs)/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { useLocalSearchParams, router } from "expo-router";

export default function InvitePage() {
  const { groupId, token } = useLocalSearchParams<{ groupId?: string; token?: string }>();

  const [inviteData, setInviteData] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  // 🔹 Kullanıcı oturumunu dinle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return unsub;
  }, []);

  // 🔹 Daveti yükle
  useEffect(() => {
    const loadInvite = async () => {
      if (!groupId || !token) return;
      try {
        const inviteRef = doc(db, "groups", groupId, "invites", token);
        const snap = await getDoc(inviteRef);
        if (snap.exists()) setInviteData(snap.data());
      } catch (error) {
        console.error("Davet yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInvite();
  }, [groupId, token]);

  // 🔹 Gruba katıl
  const handleJoinGroup = async () => {
    if (!currentUser || !inviteData) return;

    try {
      const groupRef = doc(db, "groups", inviteData.groupId);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) {
        Alert.alert("Hata", "Grup bulunamadı!");
        return;
      }

      const groupData = groupSnap.data();
      const alreadyMember = (groupData.members || []).some(
        (m: any) => m.email === currentUser.email
      );

      if (alreadyMember) {
        Alert.alert("Bilgi", "Zaten bu grubun üyesisiniz!");
        router.push({
          pathname: "/(tabs)/GroupPage",
          params: { groupId: inviteData.groupId },
        });
        return;
      }

      await updateDoc(groupRef, {
        members: arrayUnion({
          email: currentUser.email,
          role: "member",
          joinedAt: Timestamp.now(),
        }),
      });

      setJoined(true);
      Alert.alert("Başarılı 🎉", "Gruba başarıyla katıldınız!");
      router.push({
        pathname: "/(tabs)/GroupPage",
        params: { groupId: inviteData.groupId },
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Hata", "Gruba katılırken bir sorun oluştu!");
    }
  };

  // 🔹 Ekran durumuna göre render
  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#5865f2" />
        <Text style={styles.text}>Yükleniyor...</Text>
      </View>
    );

  if (!inviteData)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Davet geçersiz veya süresi dolmuş.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 Davet Edildiniz!</Text>
      <Text style={styles.text}>
        <Text style={styles.bold}>{inviteData.inviter}</Text> sizi{" "}
        <Text style={styles.bold}>{inviteData.groupName}</Text> grubuna davet etti.
      </Text>

      {currentUser ? (
        <TouchableOpacity style={styles.button} onPress={handleJoinGroup}>
          <Text style={styles.buttonText}>
            {joined ? "Katıldınız 🎉" : "Gruba Katıl"}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.text}>Katılmak için giriş yapın.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1f22",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  text: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 8,
  },
  bold: {
    color: "#fff",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#5865f2",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
