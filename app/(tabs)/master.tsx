// app/(tabs)/master.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../(tabs)/Firebaseconfig";

interface ChatPreview {
  userId: string;
  lastMessage: any;
  unreadCount: number;
}

interface GroupPreview {
  groupId: string;
  name: string;
  lastMessage: any;
  unreadCount: number;
}

const Master: React.FC = () => {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupPreviews, setGroupPreviews] = useState<GroupPreview[]>([]);
  const [filterType, setFilterType] = useState<"all" | "dm" | "groups">("all");
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // === Auth ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else router.replace("/(tabs)/login");
    });
    return () => unsubscribe();
  }, []);

  // === Users ===
  useEffect(() => {
    if (!user) return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const userList = snapshot.docs
        .filter((doc) => doc.id !== user.email)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    });
    return () => unsubscribe();
  }, [user]);

  // === Chats ===
  useEffect(() => {
    if (!user || users.length === 0) return;
    const unsubscribers = users.map((otherUser) => {
      const chatId = [user.email, otherUser.email].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      return onSnapshot(chatRef, (chatDoc) => {
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          const messages = chatData.messages || [];
          const lastMessage = messages[messages.length - 1] || null;
          const unreadCount = messages.filter(
            (msg: any) => msg.senderId !== user.email && msg.status !== "read"
          ).length;

          const newPreview: ChatPreview = {
            userId: otherUser.id,
            lastMessage,
            unreadCount,
          };

          setChatPreviews((prev) => {
            const i = prev.findIndex((p) => p.userId === otherUser.id);
            if (i !== -1) {
              const copy = [...prev];
              copy[i] = newPreview;
              return copy;
            } else return [...prev, newPreview];
          });
        }
      });
    });
    return () => unsubscribers.forEach((u) => u());
  }, [user, users]);

  // === Groups ===
  useEffect(() => {
    if (!user) return;
    const groupsRef = collection(db, "groups");
    const unsubGroups = onSnapshot(groupsRef, (snapshot) => {
      const myGroups = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((g: any) => g.members?.some((m: any) => m.email === user.email));
      setGroups(myGroups);
    });
    return () => unsubGroups();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentUnsubs: Array<() => void> = [];
    groups.forEach((g) => {
      const messagesRef = collection(db, "groups", g.id, "messages");
      const q = query(messagesRef, orderBy("timestamp", "desc"), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const lastMessage = msgs[0] || null;
        const unreadCount = msgs.filter(
          (m: any) => m.senderId !== user.email && m.status !== "read"
        ).length;
        const newPreview: GroupPreview = {
          groupId: g.id,
          name: g.name || "İsimsiz Grup",
          lastMessage,
          unreadCount,
        };
        setGroupPreviews((prev) => {
          const i = prev.findIndex((p) => p.groupId === g.id);
          if (i !== -1) {
            const copy = [...prev];
            copy[i] = newPreview;
            return copy;
          } else return [...prev, newPreview];
        });
      });
      currentUnsubs.push(unsub);
    });
    return () => currentUnsubs.forEach((u) => u());
  }, [groups, user]);

  // === Search ===
  useEffect(() => {
    const fetchResults = async () => {
      if (!searchTerm.trim()) return setSearchResults([]);
      const q = query(
        collection(db, "users"),
        where("username", ">=", searchTerm),
        where("username", "<=", searchTerm + "\uf8ff")
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .filter((doc) => doc.id !== user?.email)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
      setSearchResults(results);
    };
    fetchResults();
  }, [searchTerm, user?.email]);

  const formatTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 3600 * 24));
    if (diffDays === 0)
      return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Dün";
    return date.toLocaleDateString("tr-TR");
  };

  const handleChatClick = (userId: string) => {
    setSelectedChatUserId(userId);
    setSelectedGroupId(null);
    router.push({
      pathname: "/(tabs)/message",
      params: { userId },
    });
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedChatUserId(null);
    router.push({
      pathname: "/(tabs)/GroupPage",
      params: { groupId },
    });
  };

  // 🔹 Çıkış Yap
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/(tabs)/login");
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  const unifiedList = [
    ...chatPreviews.map((p) => {
      const chatUser = users.find((u) => u.id === p.userId);
      return {
        type: "dm" as const,
        id: p.userId,
        title: chatUser?.username || "Bilinmeyen Kullanıcı",
        lastMessage: p.lastMessage,
        unreadCount: p.unreadCount,
      };
    }),
    ...groupPreviews.map((g) => ({
      type: "group" as const,
      id: g.groupId,
      title: g.name,
      lastMessage: g.lastMessage,
      unreadCount: g.unreadCount,
    })),
  ];

  const filtered = unifiedList.filter((i) =>
    filterType === "all" ? true : i.type === filterType
  );
  const sorted = [...filtered].sort((a, b) => {
    const tA = a.lastMessage?.timestamp?.toMillis?.() || 0;
    const tB = b.lastMessage?.timestamp?.toMillis?.() || 0;
    return tB - tA;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hoş Geldin, {user?.displayName}</Text>
        <View style={styles.navButtons}>
          {[
            { icon: "home", route: "/home" },
            { icon: "users", route: "/GroupCreate" },
            { icon: "user", route: "/profile" },
            { icon: "cog", route: "/settings" },
            { icon: "phone", route: "/calls" },
          ].map((b) => (
            <TouchableOpacity
              key={b.route}
              style={styles.navButton}
              onPress={() => router.push(b.route as any)}
            >
              <FontAwesome name={b.icon as any} size={20} color="#fff" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TextInput
        placeholder="Kullanıcı ara..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchInput}
      />

      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((r) => (
            <TouchableOpacity key={r.id} onPress={() => handleChatClick(r.id)}>
              <Text style={styles.resultItem}>{r.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.filterRow}>
        {["all", "dm", "groups"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filterType === f && styles.filterActive]}
            onPress={() => setFilterType(f as any)}
          >
            <Text>{f === "all" ? "Her Şey" : f === "dm" ? "Özel" : "Gruplar"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              (item.type === "dm" && selectedChatUserId === item.id) ||
              (item.type === "group" && selectedGroupId === item.id)
                ? styles.activeCard
                : null,
            ]}
            onPress={() =>
              item.type === "dm"
                ? handleChatClick(item.id)
                : handleGroupClick(item.id)
            }
          >
            <View style={styles.cardInfo}>
              <Text style={styles.username}>{item.title}</Text>
              <Text style={styles.message}>
                {item.lastMessage?.text || "Henüz mesaj yok"}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>
                {formatTimestamp(item.lastMessage?.timestamp)}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Henüz sohbet geçmişin yok.</Text>
        }
      />

      {/* 🔹 Sağ altta çıkış butonu */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <FontAwesome name="sign-out" size={20} color="#fff" />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#007bff" />}
    </View>
  );
};

export default Master;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa", padding: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  welcome: { fontSize: 18, fontWeight: "600" },
  navButtons: {
    flexDirection: "row",
    backgroundColor: "#000",
    borderRadius: 30,
    padding: 6,
  },
  navButton: {
    marginHorizontal: 4,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
  },
  searchInput: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  searchResults: {
    backgroundColor: "#fff",
    marginVertical: 4,
    borderRadius: 8,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  filterRow: { flexDirection: "row", marginVertical: 6 },
  filterButton: {
    flex: 1,
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginHorizontal: 4,
    backgroundColor: "#fff",
  },
  filterActive: { backgroundColor: "#eaf0ff" },
  card: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeCard: { borderWidth: 2, borderColor: "#007bff" },
  cardInfo: { flex: 1 },
  username: { fontWeight: "600", fontSize: 15 },
  message: { fontSize: 13, color: "#555", marginTop: 2 },
  meta: { alignItems: "flex-end" },
  time: { fontSize: 12, color: "#999" },
  badge: {
    backgroundColor: "#007bff",
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },
  logoutButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#800020",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    elevation: 4,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 14,
  },
});
