import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimetableSlot } from '../types';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface TimetableLessonCardProps {
  lesson: TimetableSlot;
  onDelete?: (id: number) => void;
  canManage?: boolean;
}

export const TimetableLessonCard: React.FC<TimetableLessonCardProps> = ({
  lesson,
  onDelete,
  canManage = false,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: lesson.isLive ? colors.primary : colors.border,
          borderLeftColor: lesson.isLive ? colors.primary : colors.primaryLight,
          borderLeftWidth: 4,
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* Time Pill */}
        <View style={styles.timePill}>
          <Ionicons name="time-outline" size={13} color={colors.primary} />
          <Text style={[styles.timeText, { color: colors.primary }]}>
            {lesson.startTime} - {lesson.endTime}
          </Text>
        </View>

        {/* Live Badge or Room Pill */}
        <View style={styles.badgesRight}>
          {lesson.isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE NOW</Text>
            </View>
          )}

          {lesson.roomName ? (
            <View style={[styles.roomPill, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="business-outline" size={11} color={colors.muted} />
              <Text style={[styles.roomText, { color: colors.text }]}>{lesson.roomName}</Text>
            </View>
          ) : null}

          {canManage && onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(lesson.id)}
              style={styles.deleteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={15} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subject Title */}
      <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
        {lesson.subjectName.toUpperCase()}
      </Text>

      {/* Class & Teacher Details */}
      <View style={styles.bottomMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="school-outline" size={13} color={colors.muted} />
          <Text style={[styles.metaText, { color: colors.subtext }]}>
            {lesson.className} {lesson.streamName ? `(${lesson.streamName})` : ''}
          </Text>
        </View>

        {lesson.teacherName ? (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.subtext }]} numberOfLines={1}>
              {lesson.teacherName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  liveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  roomText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 3,
    marginLeft: 4,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  bottomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
