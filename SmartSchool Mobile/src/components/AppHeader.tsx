import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onNotificationPress,
  onProfilePress,
}) => {
  const { school, user, isDarkMode, unreadCount, toggleDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
      {/* Left: School Logo & Title */}
      <View style={styles.leftSection}>
        <View style={styles.logoBadge}>
          {school?.logoUrl ? (
            <Image
              source={{ uri: school.logoUrl }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          )}
        </View>
        <View style={styles.schoolInfo}>
          <Text style={[styles.schoolName, { color: colors.text }]} numberOfLines={1}>
            {school?.name || 'SmartSchool.ug'}
          </Text>
          <Text style={[styles.userName, { color: colors.muted }]} numberOfLines={1}>
            {user?.name || 'Staff Member'} • {user?.role || 'Teaching Staff'}
          </Text>
        </View>
      </View>

      {/* Right: Actions (Theme Toggle, Notifications, Profile) */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onPress={toggleDarkMode}
          accessibilityLabel="Toggle Dark Mode"
        >
          <Ionicons
            name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
            size={18}
            color={colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onPress={onNotificationPress}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={19} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.avatarButton, { borderColor: colors.primary }]}
          onPress={onProfilePress}
        >
          <Text style={styles.avatarInitial}>
            {user?.name ? user.name.trim().charAt(0).toUpperCase() : 'S'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginRight: 10,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userName: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
