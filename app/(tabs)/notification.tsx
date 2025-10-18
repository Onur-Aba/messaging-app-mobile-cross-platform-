// src/components/Notification.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface NotificationProps {
  messagePreview: string;
  senderName: string;
  onClose: () => void;
  onOpenChat: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  messagePreview,
  senderName,
  onClose,
  onOpenChat,
}) => {
  const [visible, setVisible] = useState(true);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Slide-down animasyonu başlat
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 10 saniye sonra bildirimi kapat
    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.8}
        onPress={() => {
          handleClose();
          onOpenChat();
        }}
      >
        <Text style={styles.senderText}>{senderName}</Text>
        <Text style={styles.messagePreview}>{messagePreview}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 20,
    left: 15,
    right: 15,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
  },
  content: {
    flex: 1,
  },
  senderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  messagePreview: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  closeButton: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeButtonText: {
    fontSize: 22,
    color: "#800020",
  },
});

export default Notification;
