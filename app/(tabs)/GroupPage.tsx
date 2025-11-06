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
  Modal,
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
  const [inputModalVisible, setInputModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [modalMode, setModalMode] = useState<"category" | "channel" | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);

const openInputModal = (mode: "category" | "channel", cat?: any) => {
  setModalMode(mode);
  setModalTitle(mode === "category" ? "Yeni Kategori Oluştur" : "Yeni Kanal Oluştur");
  setSelectedCategory(cat || null);
  setInputValue("");
  setInputModalVisible(true);
};

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

// 🔹 Eski handleAddCategory fonksiyonunun cross-platform hâli
const handleAddCategory = async () => {
  if (Platform.OS === "ios") {
    Alert.prompt("Kategori Oluştur", "Kategori adını girin:", async (name) => {
      if (name) await createCategory(name);
    });
  } else {
    openInputModal("category");
  }
};

// 🔹 Eski handleAddChannel fonksiyonunun cross-platform hâli
const handleAddChannel = (cat?: any) => {
  if (Platform.OS === "ios") {
    Alert.prompt("Kanal Oluştur", "Kanal adını girin:", async (name) => {
      if (name) await createChannel(name, cat);
    });
  } else {
    openInputModal("channel", cat);
  }
};

// 🔹 Ortak oluşturma işlemleri
const createCategory = async (name: string) => {
  const safe = name.replace(/\s+/g, "_").toLowerCase();
  const catId = `${groupKey}_${safe}`;
  const catRef = doc(db, "groups_channels", groupKey, "field", catId);
  const snap = await getDoc(catRef);
  if (snap.exists()) return showToast("Bu kategori zaten var.");
  await setDoc(catRef, { id: catId, name, createdAt: serverTimestamp() });
  showToast("Kategori oluşturuldu");
};

const createChannel = async (name: string, cat?: any) => {
  const category = cat || categories[0];
  const safe = name.replace(/\s+/g, "_").toLowerCase();
  const chanId = `${groupKey}_${category.id}_${safe}`;
  const chanRef = doc(
    db,
    "groups_channels",
    groupKey,
    "field",
    category.id,
    "channels",
    chanId
  );
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
          <TouchableOpacity onPress={handleAddCategory} style={styles.iconButton}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.categoryList}>
          {categories.map((cat) => (
            <View key={cat.id} style={{ marginTop: 10 }}>
              <View style={styles.headerRow}>
                <Text style={styles.category}>{cat.name}</Text>
                <TouchableOpacity onPress={() => handleAddChannel(cat)} style={styles.iconButton}>
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
            <View style={styles.topBar}>
              <Text style={styles.chatHeader}>#{activeChannel.name}</Text>
            </View>

            <ScrollView ref={scrollViewRef} style={styles.messageList} contentContainerStyle={{ paddingBottom: 20 }}>
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
                      <View style={styles.iconGroup}>
                        <TouchableOpacity onPress={() => copyMessage(msg.text)} style={styles.iconButton}>
                          <Feather name="copy" size={14} color="#fff" />
                        </TouchableOpacity>
                        {isOwn && (
                          <TouchableOpacity onPress={() => deleteMessage(i)} style={styles.iconButton}>
                            <Feather name="trash-2" size={14} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={styles.messageText}>{msg.text}</Text>
                    {/* durum/status gösterimi istenirse buraya eklenebilir */}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.inputBar}>
              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Mesaj yaz..."
                placeholderTextColor="#777"
                style={styles.messageInput}
                onSubmitEditing={sendMessage}
                multiline
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
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

      {/* Android için kategori/kanal ekleme modalı */}
<Modal
  transparent
  visible={inputModalVisible}
  animationType="fade"
  onRequestClose={() => setInputModalVisible(false)}
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    }}
  >
    <View
      style={{
        width: "100%",
        backgroundColor: "#2b2d31",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
        {modalTitle}
      </Text>
      <TextInput
        placeholder="Ad girin..."
        placeholderTextColor="#999"
        value={inputValue}
        onChangeText={setInputValue}
        style={{
          marginTop: 12,
          backgroundColor: "#1e1f22",
          color: "#fff",
          borderRadius: 6,
          padding: 10,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginTop: 14,
        }}
      >
        <TouchableOpacity
          onPress={() => setInputModalVisible(false)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginRight: 10,
          }}
        >
          <Text style={{ color: "#ccc" }}>İptal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            if (!inputValue.trim()) return;
            if (modalMode === "category") await createCategory(inputValue);
            else if (modalMode === "channel")
              await createChannel(inputValue, selectedCategory);
            setInputModalVisible(false);
          }}
          style={{
            backgroundColor: "#5865f2",
            borderRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      {toastMessage && (
        <View style={styles.toast}>
          <Text style={{ color: "#fff" }}>{toastMessage}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  /* Genel container (messages.css -> .chat-container) */
  container: {
    flex: 1,
    flexDirection: "row", // sidebar + chat yan yana
    backgroundColor: "#f8f5f2",
  },

  /* Sidebar (uygulamaya özel) */
  sidebar: {
    width: 260,
    backgroundColor: "#2b2d31",
    padding: 10,
  },
    chat: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },

  /* Top bar in chat area using messages.css top-bar renkleri */
  topBar: {
    width: "100%",
    padding: 10,
    backgroundColor: "#800020",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeader: {
    color: "#fff",
    fontWeight: "bold",
  },

  /* headerRow (başlık + buton) => messages.css .top-bar / .headerRow */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 0,
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    flex: 1,
  },

  iconButton: {
    // web'deki .icon-button karşılığı (dokunulabilir)
    padding: 6,
  },

  /* kategori listesi için küçük ayar */
  categoryList: {
    marginTop: 8,
  },

  category: {
    color: "#ccc",
    fontWeight: "600",
  },

  channel: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 6,
  },
  activeChannel: {
    backgroundColor: "#404249",
  },
  channelText: {
    color: "#fff",
    marginLeft: 6,
  },

  /* Mesaj listesi (messages.css -> .message-list) */
  messageList: {
    flex: 1,
    padding: 10,
    backgroundColor: "transparent",
  },

  /* Her bir mesaj balonu (messages.css -> .message) */
  message: {
    maxWidth: "70%",
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    // gölge (Android/iOS farklı) -> elevation ekledim
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },

  sent: {
    alignSelf: "flex-end",
    backgroundColor: "#800020",
    color: "#fff",
  },
  received: {
    alignSelf: "flex-start",
    backgroundColor: "#d8b88c",
    color: "#000",
  },

  /* mesaj metni ve başlık */
  messageText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 6,
    flexWrap: "wrap",
  },
  sender: {
    color: "#fff",
    fontWeight: "600",
    marginRight: 8,
  },

  /* mesaj header (kopyala/sil butonları sağda) */
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  /* ikon buton grubu */
  iconGroup: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  /* reply box (messages.css -> .reply-box) */
  replyBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#fff",
    padding: 5,
    marginBottom: 6,
    borderRadius: 6,
  },
  replyUser: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  replyText: {
    fontSize: 13,
    color: "#fff",
  },

  /* input bar (messages.css -> .input-bar) */
  inputBar: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  messageInput: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f5f5f5",
    color: "#000",
  },
  sendButton: {
    backgroundColor: "#800020",
    padding: 10,
    marginLeft: 10,
    borderRadius: 8,
  },

  /* no chat seçili değilken gösterim */
  noChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* toast (messages.css -> .toast) */
  toast: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    // React Native'de translateX için transform kullan
    transform: [{ translateX: -150 }], // yaklaşık olarak merkezleme (görünüm genişliğine göre)
    backgroundColor: "#800020",
    color: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 6,
    zIndex: 999,
  },
});
