import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../(tabs)/Firebaseconfig";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";

export default function Message() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [userList, setUserList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [menuOpenIndex, setMenuOpenIndex] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [showForwardPopup, setShowForwardPopup] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Kullanıcı oturumu
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else router.push("/login");
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const userData: { [key: string]: string } = {};
      const userArr: any[] = [];
      snapshot.docs.forEach((doc) => {
        userData[doc.id] = doc.data().email;
        userArr.push({ id: doc.id, ...doc.data() });
      });
      setUsers(userData);
      setUserList(userArr);
    });

    return () => {
      unsubAuth();
      unsubUsers();
    };
  }, []);

  // 🔹 Mesajları yükle
  useEffect(() => {
    if (!currentUser || !users[userId]) return;
    const chatId = [currentUser.email, users[userId]].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const unsub = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // 🔹 isDeleted = true olanları filtrele
        const visibleMessages = (data.messages || []).filter(
          (msg: any) => msg.isDeleted !== true
        );
        setMessages(visibleMessages);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId, users, currentUser]);

  // 🔹 Mesaj gönder
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !users[userId]) return;
    const receiverEmail = users[userId];
    const chatId = [currentUser.email, receiverEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const senderDoc = await getDoc(doc(db, "users", currentUser.email));
    const senderUsername = senderDoc.exists()
      ? senderDoc.data()?.username
      : "Bilinmeyen Kullanıcı";

    const msgData: any = {
      senderId: currentUser.email,
      username: senderUsername,
      text: newMessage.trim(),
      timestamp: Timestamp.now(),
      status: "sent",
      isDeleted: false, // 🔹 yeni mesajlarda varsayılan false
    };

    if (replyTo) {
      msgData.replyTo = {
        text: replyTo.text,
        username:
          replyTo.senderId === currentUser.email ? "Sen" : replyTo.username,
      };
    }

    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(msgData) });
    } else {
      await setDoc(chatRef, {
        participants: [currentUser.email, receiverEmail],
        messages: [msgData],
      });
    }

    setNewMessage("");
    setReplyTo(null);
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  // 🔹 Mesaj sil (artık fiziksel değil, sadece görünmez)
  const handleDelete = async (index: number) => {
    if (!currentUser || !users[userId]) return;
    const receiverEmail = users[userId];
    const chatId = [currentUser.email, receiverEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const docSnap = await getDoc(chatRef);

    if (docSnap.exists()) {
      const allMessages = docSnap.data().messages || [];
      allMessages[index].isDeleted = true; // 🔹 mesaj işaretlendi
      await updateDoc(chatRef, { messages: allMessages });
    }

    setToast("Mesaj gizlendi");
    setMenuOpenIndex(null);
  };

  // 🔹 Enter ile gönderme (Shift + Enter = yeni satır)
  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      sendMessage();
      Keyboard.dismiss();
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setToast("Mesaj kopyalandı");
    setMenuOpenIndex(null);
  };

  const handleForward = (msg: any) => {
    setForwardMsg(msg);
    setShowForwardPopup(true);
    setMenuOpenIndex(null);
  };

  const forwardMessageTo = async (targetId: string) => {
    if (!currentUser) return;
    const targetEmail = targetId;
    const chatId = [currentUser.email, targetEmail].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const fwd = {
      senderId: currentUser.email,
      username: "Sen",
      text: forwardMsg.text,
      forwarded: true,
      timestamp: Timestamp.now(),
      status: "sent",
      isDeleted: false, // 🔹 iletilen mesaj da görünür
    };

    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(fwd) });
    } else {
      await setDoc(chatRef, {
        participants: [currentUser.email, targetEmail],
        messages: [fwd],
      });
    }

    setShowForwardPopup(false);
    setForwardMsg(null);
    setToast("Mesaj iletildi");
  };

  const closeMenu = () => {
    if (menuOpenIndex !== null) setMenuOpenIndex(null);
  };

  // 🔹 Mesaj render
  const renderMessage = ({ item, index }: any) => {
    const isOwn = item.senderId === currentUser?.email;
    return (
      <TouchableWithoutFeedback onPress={closeMenu}>
        <TouchableOpacity
          onLongPress={() => setMenuOpenIndex(index)}
          activeOpacity={0.8}
          style={[styles.message, isOwn ? styles.sent : styles.received]}
        >
          {item.replyTo && (
            <View style={styles.replyBox}>
              <Text style={styles.replyName}>{item.replyTo.username}</Text>
              <Text style={styles.replyText}>{item.replyTo.text}</Text>
            </View>
          )}
          {item.forwarded && (
            <Text style={styles.forwardLabel}>İletilmiş mesaj</Text>
          )}
          <View style={styles.msgHeader}>
            <TouchableOpacity
              onPress={() =>
                setMenuOpenIndex(menuOpenIndex === index ? null : index)
              }
            >
              <Feather name="more-vertical" size={16} color="#fff" />
            </TouchableOpacity>
            {menuOpenIndex === index && (
              <View style={styles.menuBox}>
                <Pressable
                  onPress={() => {
                    setReplyTo(item);
                    closeMenu();
                  }}
                >
                  <Text style={styles.menuText}>Cevapla</Text>
                </Pressable>
                <Pressable onPress={() => handleForward(item)}>
                  <Text style={styles.menuText}>İlet</Text>
                </Pressable>
                <Pressable onPress={() => handleCopy(item.text)}>
                  <Text style={styles.menuText}>Kopyala</Text>
                </Pressable>
                {isOwn && (
                  <Pressable onPress={() => handleDelete(index)}>
                    <Text style={[styles.menuText, { color: "#b00020" }]}>
                      Sil
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <Text style={styles.msgText}>{item.text}</Text>
          {isOwn && (
            <Text style={styles.status}>
              {item.status === "read"
                ? "okundu"
                : item.status === "delivered"
                ? "iletildi"
                : "gönderildi"}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={closeMenu}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        {/* Üst Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.username}>{users[userId]}</Text>
          <View style={{ flexDirection: "row", gap: 15 }}>
            <Feather name="phone" size={20} color="#fff" />
            <Feather name="video" size={20} color="#fff" />
          </View>
        </View>

        {/* Mesaj Listesi */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#800020" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ padding: 10 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Cevap kutusu */}
        {replyTo && (
          <View style={styles.replyPreview}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyName}>
                {replyTo.senderId === currentUser?.email
                  ? "Sen"
                  : replyTo.username}
              </Text>
              <Text style={styles.replyText}>{replyTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Feather name="x" size={20} color="#800020" />
            </TouchableOpacity>
          </View>
        )}

        {/* Girdi alanı */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            multiline
            value={newMessage}
            onChangeText={setNewMessage}
            onKeyPress={handleKeyPress} // 🔹 Enter = gönder
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Feather name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Toast */}
        {toast && (
          <View style={styles.toast}>
            <Text style={{ color: "#fff" }}>{toast}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f5f2" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#800020",
  },
  username: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  message: {
    maxWidth: "75%",
    padding: 10,
    marginVertical: 4,
    borderRadius: 10,
  },
  sent: { alignSelf: "flex-end", backgroundColor: "#800020" },
  received: { alignSelf: "flex-start", backgroundColor: "#d8b88c" },
  msgText: { color: "#fff" },
  status: {
    alignSelf: "flex-end",
    fontSize: 11,
    color: "#e0e0e0",
    marginTop: 2,
  },
  msgHeader: { position: "absolute", top: 5, right: 8, zIndex: 10 },
  menuBox: {
    position: "absolute",
    top: 20,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 6,
    elevation: 5,
  },
  menuText: { fontSize: 13, paddingVertical: 4, color: "#333" },
  replyBox: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#fff",
    padding: 5,
    borderRadius: 6,
    marginBottom: 4,
  },
  replyName: { fontWeight: "bold", fontSize: 13, color: "#fff" },
  replyText: { fontSize: 13, color: "#fff" },
  forwardLabel: { fontSize: 11, color: "#eee", marginBottom: 3 },
  inputBar: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
  },
  sendBtn: {
    backgroundColor: "#800020",
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  replyPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f1e5e9",
    borderLeftWidth: 4,
    borderLeftColor: "#800020",
    padding: 8,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#800020",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
