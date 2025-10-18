// app/(tabs)/GroupPage.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../(tabs)/Firebaseconfig";
import { Feather } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function GroupPage() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const groupKey = groupId;
  const [categories, setCategories] = useState<any[]>([]);
  const [channelsMap, setChannelsMap] = useState<Record<string, any[]>>({});
  const [activeChannel, setActiveChannel] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [usernamesCache, setUsernamesCache] = useState<Record<string, string>>({});

  const scrollViewRef = useRef<ScrollView>(null);

  // 🔹 Kullanıcıyı dinle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else router.push("/(tabs)/login"); // ✅ yönlendirme değişti
    });
    return unsub;
  }, []);

  // 🔹 Kategoriler
  useEffect(() => {
    if (!groupKey) return;
    const catRef = collection(db, "groups_channels", groupKey, "field");
    const unsub = onSnapshot(catRef, (snap) => {
      const cats: any[] = [];
      snap.forEach((d) => cats.push({ id: d.id, ...d.data() }));
      setCategories(cats);
    });
    return unsub;
  }, [groupKey]);

  // 🔹 Kanallar
  useEffect(() => {
    if (!groupKey || categories.length === 0) return;
    const unsubscribers: (() => void)[] = [];
    categories.forEach((cat) => {
      const chanRef = collection(db, "groups_channels", groupKey, "field", cat.id, "channels");
      const unsub = onSnapshot(chanRef, (snap) => {
        const chans: any[] = [];
        snap.forEach((d) => chans.push({ id: d.id, categoryId: cat.id, ...d.data() }));
        setChannelsMap((prev) => ({ ...prev, [cat.id]: chans }));
        if (!activeChannel) {
          const firstCategory = categories[0];
          if (firstCategory && cat.id === firstCategory.id && chans.length > 0) {
            setActiveChannel(chans[0]);
          }
        }
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach((u) => u());
  }, [categories]);

  // 🔹 Mesajları dinle
  useEffect(() => {
    if (!activeChannel) {
      setMessages([]);
      return;
    }
    const safeName = activeChannel.name.replace(/\s+/g, "_");
    const chatId = `${activeChannel.id}_${safeName}`;
    const chatRef = doc(db, "chats", chatId);

    const unsub = onSnapshot(chatRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const msgs = data.messages || [];

        for (const msg of msgs) {
          if (msg.senderId && !usernamesCache[msg.senderId]) {
            const senderDoc = await getDoc(doc(db, "users", msg.senderId));
            const username = senderDoc.exists()
              ? senderDoc.data()?.username
              : "Bilinmeyen Kullanıcı";
            setUsernamesCache((prev) => ({ ...prev, [msg.senderId]: username }));
          }
        }

        setMessages(msgs);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
      } else {
        setMessages([]);
      }
    });

    return unsub;
  }, [activeChannel, usernamesCache]);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleAddCategory = () => {
    Alert.prompt("Kategori Oluştur", "Kategori adını girin:", async (name) => {
      if (!name) return;
      const safe = name.replace(/\s+/g, "_").toLowerCase();
      const catId = `${groupKey}_${safe}`;
      const catRef = doc(db, "groups_channels", groupKey, "field", catId);
      const snap = await getDoc(catRef);
      if (snap.exists()) return showToast("Bu kategori zaten var.");
      await setDoc(catRef, { id: catId, name, createdAt: serverTimestamp() });
      showToast("Kategori oluşturuldu");
    });
  };

  const handleAddChannel = (cat?: any) => {
    Alert.prompt("Kanal Oluştur", "Kanal adını girin:", async (name) => {
      if (!name) return;
      const category = cat || categories[0];
      const safe = name.replace(/\s+/g, "_").toLowerCase();
      const chanId = `${groupKey}_${category.id}_${safe}`;
      const chanRef = doc(db, "groups_channels", groupKey, "field", category.id, "channels", chanId);
      const snap = await getDoc(chanRef);
      if (snap.exists()) return showToast("Bu kanal zaten var.");
      await setDoc(chanRef, {
        id: chanId,
        name,
        type: "text",
        createdAt: serverTimestamp(),
        messages: [],
      });
      showToast("Kanal oluşturuldu");
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChannel || !currentUser) return;
    const safeName = activeChannel.name.replace(/\s+/g, "_");
    const chatId = `${activeChannel.id}_${safeName}`;
    const chatRef = doc(db, "chats", chatId);

    const senderDoc = await getDoc(doc(db, "users", currentUser.email));
    const senderUsername = senderDoc.exists()
      ? senderDoc.data()?.username
      : currentUser.email;

    const msg: any = {
      senderId: currentUser.email,
      username: senderUsername,
      text: newMessage.trim(),
      timestamp: Timestamp.now(),
      status: "sent",
    };
    if (replyTo) {
      msg.replyTo = {
        text: replyTo.text,
        username: replyTo.username,
        index: messages.indexOf(replyTo),
      };
    }

    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      await updateDoc(chatRef, { messages: arrayUnion(msg) });
    } else {
      await setDoc(chatRef, { participants: [currentUser.email], messages: [msg] });
    }

    setNewMessage("");
    setReplyTo(null);
  };

  const copyMessage = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast("Mesaj kopyalandı");
  };

  const deleteMessage = async (i: number) => {
    if (!activeChannel || !currentUser) return;
    const safeName = activeChannel.name.replace(/\s+/g, "_");
    const chatId = `${activeChannel.id}_${safeName}`;
    const chatRef = doc(db, "chats", chatId);
    const updated = messages.filter((_, idx) => idx !== i);
    await updateDoc(chatRef, { messages: updated });
    setMessages(updated);
    showToast("Mesaj silindi");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{groupKey}</Text>
          <TouchableOpacity onPress={handleAddCategory}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {categories.map((cat) => (
            <View key={cat.id} style={{ marginTop: 10 }}>
              <View style={styles.headerRow}>
                <Text style={styles.category}>{cat.name}</Text>
                <TouchableOpacity onPress={() => handleAddChannel(cat)}>
                  <Feather name="plus" size={16} color="#ccc" />
                </TouchableOpacity>
              </View>
              {(channelsMap[cat.id] || []).map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  onPress={() => setActiveChannel(ch)}
                  style={[
                    styles.channel,
                    activeChannel?.id === ch.id && styles.activeChannel,
                  ]}
                >
                  <Feather name="hash" color="#ccc" size={14} />
                  <Text style={styles.channelText}>{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Chat area */}
      <View style={styles.chat}>
        {activeChannel ? (
          <>
            <Text style={styles.chatHeader}>#{activeChannel.name}</Text>
            <ScrollView ref={scrollViewRef} style={styles.messages}>
              {messages.map((msg, i) => {
                const isOwn = msg.senderId === currentUser?.email;
                return (
                  <View
                    key={i}
                    style={[styles.message, isOwn ? styles.sent : styles.received]}
                  >
                    {msg.replyTo && (
                      <TouchableOpacity
                        style={styles.replyBox}
                        onPress={() =>
                          showToast("Mesaj atıfına gitme özelliği mobilde devre dışı")
                        }
                      >
                        <Text style={styles.replyUser}>{msg.replyTo.username}</Text>
                        <Text style={styles.replyText}>{msg.replyTo.text}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.messageHeader}>
                      <Text style={styles.sender}>{msg.username}</Text>
                      <TouchableOpacity onPress={() => copyMessage(msg.text)}>
                        <Feather name="copy" size={14} color="#fff" />
                      </TouchableOpacity>
                      {isOwn && (
                        <TouchableOpacity onPress={() => deleteMessage(i)}>
                          <Feather name="trash-2" size={14} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.messageText}>{msg.text}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Mesaj yaz..."
                placeholderTextColor="#aaa"
                style={styles.input}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                <Feather name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noChat}>
            <Text>Bir kanal seç</Text>
          </View>
        )}
      </View>

      {toastMessage && (
        <View style={styles.toast}>
          <Text style={{ color: "#fff" }}>{toastMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", backgroundColor: "#1e1f22" },
  sidebar: { width: 260, backgroundColor: "#2b2d31", padding: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  category: { color: "#ccc", fontWeight: "600" },
  channel: { flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 6 },
  activeChannel: { backgroundColor: "#404249" },
  channelText: { color: "#fff", marginLeft: 6 },
  chat: { flex: 1, flexDirection: "column" },
  chatHeader: { backgroundColor: "#2b2d31", color: "#fff", padding: 10, fontWeight: "bold" },
  messages: { flex: 1, padding: 10 },
  message: { maxWidth: "75%", padding: 8, borderRadius: 8, marginVertical: 4 },
  sent: { alignSelf: "flex-end", backgroundColor: "#5865f2" },
  received: { alignSelf: "flex-start", backgroundColor: "#404249" },
  messageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sender: { color: "#fff", fontWeight: "600" },
  messageText: { color: "#fff", marginTop: 4 },
  replyBox: { backgroundColor: "#333", padding: 4, borderRadius: 4, marginBottom: 4 },
  replyUser: { color: "#ddd", fontWeight: "bold" },
  replyText: { color: "#ccc", fontSize: 12 },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 8, backgroundColor: "#2b2d31" },
  input: { flex: 1, color: "#fff", backgroundColor: "#1e1f22", padding: 8, borderRadius: 6 },
  sendBtn: { backgroundColor: "#5865f2", padding: 10, marginLeft: 8, borderRadius: 6 },
  noChat: { flex: 1, alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#5865f2",
    padding: 10,
    borderRadius: 6,
  },
});
