import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Announcement } from '../types';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface AnnouncementModalProps {
  announcement: Announcement | null;
  visible: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  visible,
  onClose,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  if (!announcement) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.dateText, { color: colors.muted }]}>{announcement.date}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingVertical: 12 }}>
            <Text style={[styles.title, { color: colors.text }]}>{announcement.title}</Text>
            <View style={styles.authorRow}>
              <Ionicons name="person-circle-outline" size={15} color={colors.primary} />
              <Text style={[styles.authorText, { color: colors.subtext }]}>
                Posted by <Text style={{ fontWeight: '700', color: colors.text }}>{announcement.author}</Text>
              </Text>
            </View>

            <Text style={[styles.content, { color: colors.text }]}>{announcement.content}</Text>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissBtnText}>Close Notice</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginVertical: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  authorText: {
    fontSize: 12,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dismissBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
