import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Announcement } from '../types';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface NotificationSheetProps {
  visible: boolean;
  announcements: Announcement[];
  onClose: () => void;
  onSelectAnnouncement: (announcement: Announcement) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({
  visible,
  announcements,
  onClose,
  onSelectAnnouncement,
  onMarkAllAsRead,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleGroup}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>School Announcements</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Quick Action Subheader */}
          <View style={[styles.subHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.subText, { color: colors.muted }]}>
              {announcements.length} updates recorded
            </Text>
            <TouchableOpacity onPress={onMarkAllAsRead}>
              <Text style={[styles.markReadText, { color: colors.primary }]}>Mark all as read</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={announcements}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="mail-open-outline" size={38} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>No notifications right now</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.notificationItem,
                  {
                    backgroundColor: item.isRead ? colors.card : colors.primaryLight + '20',
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => onSelectAnnouncement(item)}
                activeOpacity={0.7}
              >
                <View style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: colors.text },
                        !item.isRead ? { fontWeight: '800' } : { fontWeight: '600' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text style={[styles.itemDate, { color: colors.muted }]}>{item.date}</Text>
                </View>
                <Text style={[styles.itemSnippet, { color: colors.subtext }]} numberOfLines={2}>
                  {item.content}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  subText: {
    fontSize: 12,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notificationItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  itemTitle: {
    fontSize: 14,
    flex: 1,
  },
  itemDate: {
    fontSize: 11,
    marginLeft: 8,
  },
  itemSnippet: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
});
