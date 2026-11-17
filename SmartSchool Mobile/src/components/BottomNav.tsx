import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

export type TabKey = 'home' | 'attendance' | 'marks' | 'timetable' | 'settings';

interface BottomNavProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

interface NavItem {
  key: TabKey;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}

const navItems: NavItem[] = [
  { key: 'home', label: 'Home', iconActive: 'home', iconInactive: 'home-outline' },
  { key: 'attendance', label: 'Attendance', iconActive: 'checkbox', iconInactive: 'checkbox-outline' },
  { key: 'marks', label: 'Marks', iconActive: 'create', iconInactive: 'create-outline' },
  { key: 'timetable', label: 'Timetable', iconActive: 'calendar', iconInactive: 'calendar-outline' },
  { key: 'settings', label: 'Settings', iconActive: 'settings', iconInactive: 'settings-outline' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <View style={styles.outerWrapper}>
      <View style={[styles.navContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#0f766e', borderColor: isDarkMode ? '#334155' : 'rgba(255,255,255,0.2)' }]}>
        {navItems.map((item) => {
          const isActive = currentTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => onTabChange(item.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconCircle, isActive && styles.activeIconCircle]}>
                <Ionicons
                  name={isActive ? item.iconActive : item.iconInactive}
                  size={20}
                  color={isActive ? '#0f766e' : 'rgba(255, 255, 255, 0.78)'}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 999,
  },
  navContainer: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  activeTabButton: {
    transform: [{ scale: 1.05 }],
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconCircle: {
    backgroundColor: '#ffffff',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    marginTop: 2,
  },
  activeTabLabel: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

