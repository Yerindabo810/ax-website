import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Student } from '../types';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface StudentAttendanceCardProps {
  student: Student;
  index: number;
  status: 'present' | 'absent' | 'late' | null;
  onStatusChange: (status: 'present' | 'absent' | 'late') => void;
}

export const StudentAttendanceCard: React.FC<StudentAttendanceCardProps> = ({
  student,
  index,
  status,
  onStatusChange,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card Header: Avatar, Name, LIN & Index */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <View style={styles.leftInfo}>
          <View style={[styles.avatarBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {student.surname.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
              {student.fullName.toUpperCase()}
            </Text>
            <Text style={[styles.studentMeta, { color: colors.muted }]}>
              {student.lin} {student.streamName ? `• ${student.streamName}` : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.indexPill, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[styles.indexText, { color: colors.subtext }]}>#{index + 1}</Text>
        </View>
      </View>

      {/* Attendance 3-State Toggle Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            status === 'present'
              ? { backgroundColor: '#16a34a', borderColor: '#15803d' }
              : { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
          onPress={() => onStatusChange('present')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleBtnText,
              status === 'present' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
            ]}
          >
            ✓ Present
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            status === 'absent'
              ? { backgroundColor: '#dc2626', borderColor: '#b91c1c' }
              : { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
          onPress={() => onStatusChange('absent')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleBtnText,
              status === 'absent' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
            ]}
          >
            ✕ Absent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            status === 'late'
              ? { backgroundColor: '#d97706', borderColor: '#b45309' }
              : { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
          onPress={() => onStatusChange('late')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.toggleBtnText,
              status === 'late' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
            ]}
          >
            ⏱ Late
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  nameBlock: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  studentMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  indexPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
