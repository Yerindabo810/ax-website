import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from './src/store/authStore';
import { lightColors, darkColors } from './src/theme/colors';

// Global Header & Navigation
import { AppHeader } from './src/components/AppHeader';
import { BottomNav, TabKey as NavTab } from './src/components/BottomNav';
import { NotificationSheet } from './src/components/NotificationSheet';
import { AnnouncementModal } from './src/components/AnnouncementModal';

// Screens
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { RecordMarksScreen } from './src/screens/RecordMarksScreen';
import { TimetableScreen } from './src/screens/TimetableScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// APIs & Types
import { dashboardApi } from './src/api/dashboardApi';
import { Announcement } from './src/types';

export default function App() {
  const { user, isDarkMode, setUnreadCount } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [tabParams, setTabParams] = useState<any>(null);
  const [isNotificationSheetOpen, setIsNotificationSheetOpen] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);

  // Poll announcements & updates
  useEffect(() => {
    if (user) {
      dashboardApi.getAnnouncements().then((data) => {
        setAnnouncements(data);
        const unread = data.filter((d) => !d.isRead).length;
        setUnreadCount(unread);
      });
    }
  }, [user]);

  // Mark all announcements as read
  const handleMarkAllRead = async () => {
    await dashboardApi.markAnnouncementsRead();
    setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
  };

  const handleSelectAnnouncement = (item: Announcement) => {
    setActiveAnnouncement(item);
  };

  const handleNavigateTab = (tab: NavTab, params?: any) => {
    setTabParams(params || null);
    setActiveTab(tab);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={!user ? 'dark' : isDarkMode ? 'light' : 'dark'} />
      <SafeAreaView
        style={[styles.rootContainer, { backgroundColor: !user ? '#ffffff' : colors.background }]}
        edges={['top', 'left', 'right']}
      >
        {!user ? (
          <LoginScreen onLoginSuccess={() => setActiveTab('home')} />
        ) : (
          <View style={styles.mainWrapper}>
            {/* Top Fixed Header */}
            <AppHeader
              onNotificationPress={() => setIsNotificationSheetOpen(true)}
              onProfilePress={() => setActiveTab('settings')}
            />

            {/* Main Screen Body based on Active Tab */}
            <View style={styles.screenContainer}>
              {activeTab === 'home' && (
                <HomeScreen
                  onNavigateTab={handleNavigateTab}
                  onOpenNotifications={() => setIsNotificationSheetOpen(true)}
                />
              )}
              {activeTab === 'attendance' && (
                <AttendanceScreen initialClassId={tabParams?.classId} />
              )}
              {activeTab === 'marks' && (
                <RecordMarksScreen initialClassId={tabParams?.classId} />
              )}
              {activeTab === 'timetable' && <TimetableScreen />}
              {activeTab === 'settings' && (
                <SettingsScreen onLogout={() => setActiveTab('home')} />
              )}
            </View>

            {/* Bottom Floating Navigation Pill */}
            <BottomNav
              currentTab={activeTab}
              onTabChange={(tab) => {
                setTabParams(null);
                setActiveTab(tab);
              }}
            />

            {/* Notifications Sheet */}
            <NotificationSheet
              visible={isNotificationSheetOpen}
              announcements={announcements}
              onClose={() => setIsNotificationSheetOpen(false)}
              onSelectAnnouncement={handleSelectAnnouncement}
              onMarkAllAsRead={handleMarkAllRead}
            />

            {/* Announcement Modal Popup */}
            <AnnouncementModal
              visible={!!activeAnnouncement}
              announcement={activeAnnouncement}
              onClose={() => setActiveAnnouncement(null)}
            />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});
