import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = '#0d9488',
  onPress,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      </View>
      <Text style={[styles.title, { color: colors.subtext }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});

