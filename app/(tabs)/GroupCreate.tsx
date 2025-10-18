import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router"; // ✅ eklendi
import { auth, db } from "../(tabs)/Firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  getDoc,
  Timestamp,
} from "firebase/firestore";

interface Role {
  id: string;
  name: string;
  permissions: {
    manage_roles: boolean;
    create_channels: boolean;
    invite_members: boolean;
    manage_members: boolean;
    manage_channels: boolean;
    sunucu_sahibi: boolean;
  };
}

interface AppUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
}

const defaultRole = (id: string, name = "Yeni Rol"): Role => ({
  id,
  name,
  permissions: {
    manage_roles: false,
    create_channels: false,
    invite_members: false,
    manage_members: false,
    manage_channels: false,
    sunucu_sahibi: false,
  },
});

const permissionDescriptions: Record<keyof Role["permissions"], string> = {
  manage_roles: "Rolleri ekleme, düzenleme ve silme izni verir.",
  create_channels: "Yeni metin veya sesli kanallar oluşturma izni verir.",
  invite_members: "Gruba yeni üyeleri davet etme izni verir.",
  manage_members: "Üyelerin rollerini düzenleme ve çıkarma izni verir.",
  manage_channels: "Mevcut kanalları düzenleme ve silme izni verir.",
  sunucu_sahibi: "Tüm yetkilere otomatik olarak sahip olur.",
};

const GroupCreate: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [roles, setRoles] = useState<Role[]>([
    {
      id: crypto.randomUUID(),
      name: "owner",
      permissions: {
        manage_roles: true,
        create_channels: true,
        invite_members: true,
        manage_members: true,
        manage_channels: true,
        sunucu_sahibi: true,
      },
    },
  ]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roles[0].id);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [potentialInvitees, setPotentialInvitees] = useState<AppUser[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 🔑 Kullanıcı takibi
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setCurrentUser(u);
      else router.push("/(tabs)/login"); // ✅ yönlendirme değişti
    });
    return () => unsub();
  }, []);

  // 👥 Kullanıcı listesi
  useEffect(() => {
    if (!currentUser) return;
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list: AppUser[] = snap.docs
        .filter((d) => d.id !== currentUser.email)
        .map((d) => ({ id: d.id, email: d.id, ...(d.data() as any) }));
      setPotentialInvitees(list);
    };
    loadUsers();
  }, [currentUser]);

  const addRole = () => {
    const id = crypto.randomUUID();
    setRoles((prev) => [...prev, defaultRole(id)]);
    setSelectedRoleId(id);
  };

  const updateRoleName = (id: string, name: string) => {
    if (roles.find((r) => r.name.toLowerCase() === "owner" && r.id === id)) return;
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const togglePermission = (roleId: string, perm: keyof Role["permissions"]) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        if (r.name.toLowerCase() === "owner") return r;
        const newPerms = { ...r.permissions };

        if (perm === "sunucu_sahibi") {
          const enableAll = !r.permissions.sunucu_sahibi;
          Object.keys(newPerms).forEach((key) => {
            (newPerms as any)[key] = enableAll;
          });
        } else {
          newPerms[perm] = !r.permissions[perm];
        }

        return { ...r, permissions: newPerms };
      })
    );
  };

  const toggleInvitee = (email: string) => {
    setSelectedInvitees((prev) => ({ ...prev, [email]: !prev[email] }));
  };

  // 🚀 Grup oluşturma
  const createGroup = async () => {
    if (!currentUser) return;
    if (!groupName.trim()) {
      Alert.alert("Uyarı", "Lütfen grup adı girin.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const randomId = crypto.randomUUID();
      const safeName = groupName.replace(/\s+/g, "_").toLowerCase();
      const groupId = `${randomId}_${safeName}`;
      const createdAt = Timestamp.now();

      const ownerMember = { email: currentUser.email, role: "owner" };

      const groupDoc = {
        id: groupId,
        name: groupName,
        owner: currentUser.email,
        description: description || "",
        members: [ownerMember],
        roles,
        channels: [],
        createdAt,
      };

      await setDoc(doc(db, "groups", groupId), groupDoc);

      const selectedEmails = Object.keys(selectedInvitees).filter((e) => selectedInvitees[e]);

      for (const email of selectedEmails) {
        const inviteId = groupId;
        const inviteData = {
          id: inviteId,
          inviter: currentUser.email,
          invitee: email,
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000)),
          groupId,
          groupName,
        };

        await setDoc(doc(db, `groups/${groupId}/invites`, inviteId), inviteData);

        const chatId = [currentUser.email, email].sort().join("_");
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        const inviteMessage = {
          id: crypto.randomUUID(),
          senderId: currentUser.email,
          type: "invite",
          text: `${currentUser.displayName || currentUser.email} sizi ${groupName} grubuna davet etti.`,
          invite: {
            id: inviteId,
            link: `/invite/${groupId}?token=${inviteId}`,
            groupName,
            groupId,
            status: "pending",
          },
          timestamp: Timestamp.now(),
          status: "sent",
        };

        if (chatSnap.exists()) {
          await updateDoc(chatRef, { messages: arrayUnion(inviteMessage) });
        } else {
          await setDoc(chatRef, {
            id: chatId,
            participants: [currentUser.email, email],
            messages: [inviteMessage],
          });
        }
      }

      setMessage(`Grup oluşturuldu ve ${selectedEmails.length} davet gönderildi.`);
      Alert.alert("Başarılı", message || "Grup başarıyla oluşturuldu.");

      router.push({
        pathname: "/(tabs)/GroupPage",
        params: { groupId },
      }); // ✅ yönlendirme değişti
    } catch (err) {
      console.error(err);
      Alert.alert("Hata", "Grup oluşturulurken hata oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Yeni Grup Oluştur</Text>

      <TextInput
        style={styles.input}
        placeholder="Grup adı"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Açıklama"
        value={description}
        multiline
        onChangeText={setDescription}
      />

      <View style={styles.section}>
        <Text style={styles.subtitle}>Roller</Text>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.roleItem, selectedRoleId === r.id && styles.roleItemActive]}
            onPress={() => setSelectedRoleId(r.id)}
          >
            <TextInput
              style={styles.roleName}
              value={r.name}
              onChangeText={(val) => updateRoleName(r.id, val)}
              editable={r.name.toLowerCase() !== "owner"}
            />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={addRole}>
          <Text style={styles.addButtonText}>+ Rol Ekle</Text>
        </TouchableOpacity>
      </View>

      {selectedRole && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Yetkiler</Text>
          {Object.keys(selectedRole.permissions).map((perm) => (
            <View key={perm} style={styles.permissionRow}>
              <Text style={styles.permissionLabel}>{perm.replace("_", " ")}</Text>
              <Switch
                value={selectedRole.permissions[perm as keyof Role["permissions"]]}
                onValueChange={() =>
                  togglePermission(selectedRole.id, perm as keyof Role["permissions"])
                }
              />
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setInviteModalOpen(true)}
      >
        <Text style={styles.primaryButtonText}>Üye Davet Et</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: "#007bff" }]}
        onPress={createGroup}
        disabled={busy}
      >
        <Text style={styles.primaryButtonText}>
          {busy ? "Oluşturuluyor..." : "Grup Oluştur"}
        </Text>
      </TouchableOpacity>

      {/* Davet Modalı */}
      <Modal visible={inviteModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Kullanıcı Seç</Text>
          <ScrollView style={{ flex: 1 }}>
            {potentialInvitees.map((u) => (
              <TouchableOpacity
                key={u.email}
                style={styles.inviteeItem}
                onPress={() => toggleInvitee(u.email)}
              >
                <Text style={{ flex: 1 }}>
                  {u.username || u.displayName || u.email}
                </Text>
                <Text>{selectedInvitees[u.email] ? "✅" : "⬜️"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: "#888" }]}
            onPress={() => setInviteModalOpen(false)}
          >
            <Text style={styles.primaryButtonText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  section: { marginBottom: 20 },
  subtitle: { fontWeight: "600", marginBottom: 8, fontSize: 16 },
  roleItem: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  roleItemActive: { borderColor: "#007bff" },
  roleName: { fontWeight: "600" },
  addButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600" },
  permissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  permissionLabel: { fontSize: 14 },
  primaryButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  modalContainer: { flex: 1, padding: 16, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  inviteeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
});

export default GroupCreate;
