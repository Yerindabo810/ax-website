import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';
import { apiRequest } from '../api/client';

interface SettingsScreenProps {
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const {
    user,
    school,
    tenantSlug,
    isDarkMode,
    toggleDarkMode,
    logout,
  } = useAuthStore();

  const colors = isDarkMode ? darkColors : lightColors;

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [activeSheet, setActiveSheet] = useState<'faq' | 'support' | null>(null);

  // Compute initials
  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('')
    : 'ST';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your school workspace?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            if (tenantSlug) {
              await apiRequest(`/${tenantSlug}/mobile/logout`, { method: 'POST' }).catch(() => {});
            }
          } finally {
            logout();
            onLogout();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. User Profile Card (matches lines 2007-2016 in app.blade.php) */}
      <View style={[styles.mCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <View style={styles.profileDetails}>
          <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
            {user?.name || 'Staff Member'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.muted }]} numberOfLines={1}>
            {user?.email || user?.phone || 'staff@smartschool.ug'}
          </Text>
          <Text style={[styles.profileSchool, { color: colors.primary }]} numberOfLines={1}>
            {school?.name || 'SmartSchool Uganda'}
          </Text>
        </View>
      </View>

      {/* 2. Appearance & Alerts Card (matches lines 2019-2039 in app.blade.php) */}
      <View style={[styles.mCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionLabel, { color: colors.muted }]}>Appearance & Alerts</Text>

        {/* Toggle Theme (Light / Dark) */}
        <TouchableOpacity style={styles.settingsRow} onPress={toggleDarkMode} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={18}
              color="#d97706"
              style={{ width: 24, textAlign: 'center' }}
            />
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Toggle Theme ({isDarkMode ? 'Dark' : 'Light'})
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        {/* Announcement Notifications */}
        <View style={styles.settingsRow}>
          <View style={styles.rowLeft}>
            <Ionicons
              name="notifications"
              size={18}
              color={colors.primary}
              style={{ width: 24, textAlign: 'center' }}
            />
            <Text style={[styles.rowTitle, { color: colors.text }]}>Announcement Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* 3. Support & Information Card (matches lines 2041-2072 in app.blade.php) */}
      <View style={[styles.mCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionLabel, { color: colors.muted }]}>Support & Information</Text>

        {/* FAQs */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setActiveSheet('faq')}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="help-circle"
              size={18}
              color="#2563eb"
              style={{ width: 24, textAlign: 'center' }}
            />
            <Text style={[styles.rowTitle, { color: colors.text }]}>FAQs (Frequently Asked Questions)</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        {/* Help & Support */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setActiveSheet('support')}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="headset"
              size={18}
              color="#16a34a"
              style={{ width: 24, textAlign: 'center' }}
            />
            <Text style={[styles.rowTitle, { color: colors.text }]}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        {/* App Version */}
        <View style={styles.settingsRow}>
          <View style={styles.rowLeft}>
            <Ionicons
              name="logo-android"
              size={18}
              color={colors.primary}
              style={{ width: 24, textAlign: 'center' }}
            />
            <Text style={[styles.rowTitle, { color: colors.text }]}>App Version</Text>
          </View>
          <View style={[styles.versionPill, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.versionText, { color: colors.primary }]}>v2.4.0 (Build 104)</Text>
          </View>
        </View>
      </View>

      {/* 4. Sign Out Button (matches lines 2075-2078 in app.blade.php) */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* FAQ Modal Sheet */}
      <Modal visible={activeSheet === 'faq'} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
              <TouchableOpacity onPress={() => setActiveSheet(null)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={[styles.faqQ, { color: colors.text }]}>Q: How long can I edit class attendance?</Text>
              <Text style={[styles.faqA, { color: colors.subtext }]}>
                Attendance sessions are editable for 60 minutes after initial roll call. After 60 minutes, any new save creates a separate record.
              </Text>
              <Text style={[styles.faqQ, { color: colors.text, marginTop: 12 }]}>Q: How do marks save?</Text>
              <Text style={[styles.faqA, { color: colors.subtext }]}>
                Marks auto-save in real time whenever you tap a 1-3 score or finish entering a score box.
              </Text>
              <Text style={[styles.faqQ, { color: colors.text, marginTop: 12 }]}>Q: How do timetable alerts work?</Text>
              <Text style={[styles.faqA, { color: colors.subtext }]}>
                The app sends automatic reminders 10 minutes prior to scheduled lesson periods.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Support Modal Sheet */}
      <Modal visible={activeSheet === 'support'} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>SmartSchool Help & Support</Text>
              <TouchableOpacity onPress={() => setActiveSheet(null)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 14, gap: 10 }}>
              <Text style={[styles.supportText, { color: colors.text }]}>
                For assistance with staff accounts, teacher assignments, or student rosters, contact:
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                Email: support@smartschool.ug
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                Phone: +256 772 651 444 / +256 752 651 444
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>
                SmartSchool MIS Platform • Ministry of Education & Sports
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 90,
  },
  mCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 12,
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  profileSchool: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(254, 226, 226, 0.45)',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  faqQ: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  faqA: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  supportText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
