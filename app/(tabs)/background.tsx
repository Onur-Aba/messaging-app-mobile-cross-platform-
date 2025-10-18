import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../(tabs)/Firebaseconfig";
import Notification from "../(tabs)/notification"; // RN versiyonu olacak
import { router } from "expo-router"; // ✅ eklendi

interface MessageData {
  senderId: string;
  text: string;
  timestamp: any;
}

const Background: React.FC = () => {
  const [notification, setNotification] = useState<{
    senderName: string;
    messagePreview: string;
    onOpenChat: () => void;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<null | {
    from: string;
    to: string;
  }>(null);

  const currentUser = auth.currentUser;
  const lastShownTimestamps = useRef<{ [chatId: string]: number }>({});

  // 📩 Mesaj bildirimi dinleyicisi
  useEffect(() => {
    if (!currentUser) return;

    const usersRef = collection(db, "users");
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const usersMap: { [uid: string]: { email: string; username?: string } } = {};
      snapshot.forEach((docSnap) => {
        usersMap[docSnap.id] = {
          email: docSnap.data().email,
          username: docSnap.data().username,
        };
      });

      Object.entries(usersMap).forEach(([_, user]) => {
        if (user.email === currentUser.email) return;

        const chatId = [currentUser.email, user.email].sort().join("_");
        const chatRef = doc(db, "chats", chatId);

        onSnapshot(chatRef, (docSnap) => {
          if (!docSnap.exists()) return;

          const messages: MessageData[] = docSnap.data().messages || [];
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) return;

          const lastTimestamp = lastMessage.timestamp?.seconds || 0;
          const prevTimestamp = lastShownTimestamps.current[chatId] || 0;

          if (lastTimestamp === prevTimestamp) return;
          if (lastMessage.senderId === currentUser.email) return;

          const senderUid = Object.entries(usersMap).find(
            ([, val]) => val.email === lastMessage.senderId
          )?.[0];

          const senderName =
            usersMap[senderUid || ""]?.username || lastMessage.senderId;

          setNotification({
            senderName,
            messagePreview: lastMessage.text,
            onOpenChat: () =>
              router.push({
                pathname: "/(tabs)/message",
                params: { userId: senderUid },
              }), // ✅ yönlendirme değiştirildi
          });

          lastShownTimestamps.current[chatId] = lastTimestamp;
        });
      });
    });

    return () => unsubscribeUsers();
  }, []);

  // 📞 Gelen arama dinleyicisi
  useEffect(() => {
    if (!currentUser) return;

    const callsRef = collection(db, "calls");
    const unsub = onSnapshot(callsRef, (snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.to === currentUser.email && data.status === "ringing") {
          setIncomingCall({ from: data.from, to: currentUser.email ?? "" });
        }
      });
    });

    return () => unsub();
  }, []);

  return (
    <>
      {notification && (
        <Notification
          senderName={notification.senderName}
          messagePreview={notification.messagePreview}
          onClose={() => setNotification(null)}
          onOpenChat={notification.onOpenChat}
        />
      )}

      <Modal visible={!!incomingCall} transparent animationType="fade">
        {incomingCall && (
          <View style={styles.overlay}>
            <View style={styles.popupContainer}>
              <Text style={styles.title}>
                {incomingCall.from} sizi arıyor
              </Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.accept]}
                  onPress={() => {
                    router.push({
                      pathname: "/(tabs)/master",
                      params: {
                        caller: incomingCall.from,
                        callee: incomingCall.to,
                        isCaller: "false",
                      },
                    }); // ✅ yönlendirme güncellendi
                    setIncomingCall(null);
                  }}
                >
                  <Text style={styles.buttonText}>Kabul Et</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.reject]}
                  onPress={() => setIncomingCall(null)}
                >
                  <Text style={styles.buttonText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    alignItems: "center",
    width: "80%",
  },
  title: {
    fontSize: 18,
    marginBottom: 16,
    color: "#333",
    textAlign: "center",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  accept: {
    backgroundColor: "#4CAF50",
  },
  reject: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default Background;
