import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';
import { AddLessonModal } from '../components/AddLessonModal';
import { apiRequest } from '../api/client';
import { TimetableSlot } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableScreen: React.FC = () => {
  const { tenantSlug, isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  // Determine current day of week (defaults to Monday if Sunday)
  const currentDayIndex = new Date().getDay();
  const initialDay = currentDayIndex >= 1 && currentDayIndex <= 6 ? DAYS[currentDayIndex - 1] : 'Monday';

  const [selectedDay, setSelectedDay] = useState<string>(initialDay);
  const [lessons, setLessons] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);

  // Fetch real timetable slots for chosen day from backend
  const fetchDaySlots = async () => {
    if (!tenantSlug) return;
    setLoading(true);

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/timetable?day=${encodeURIComponent(selectedDay)}`);
      const rawSlots = res.slots || [];
      const mapped: TimetableSlot[] = rawSlots.map((s: any) => ({
        id: s.id,
        day: s.day || s.day_of_week || selectedDay,
        startTime: s.start_time || (s.period ? s.period.start_time : '08:00'),
        endTime: s.end_time || (s.period ? s.period.end_time : '08:40'),
        subjectName: s.subject?.name || s.subject_name || 'Lesson Period',
        className: s.schoolclass?.name || s.class_name || 'Secondary',
        streamName: s.stream?.name || s.stream_name || '',
        roomName: s.room_number || s.room_name || '',
        teacherName: s.staff?.user
          ? `${s.staff.user.surname || ''} ${s.staff.user.lastname || ''}`.trim()
          : s.teacher_name || '',
        isLive: !!s.is_live,
      }));

      setLessons(mapped);
    } catch (err: any) {
      console.warn('Timetable fetch warning:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDaySlots();
  }, [selectedDay, tenantSlug]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDaySlots();
  };

  // Add lesson to timetable
  const handleSaveLesson = async (lessonData: any): Promise<boolean> => {
    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/timetable/save`, {
        method: 'POST',
        body: JSON.stringify(lessonData),
      });

      if (res.success) {
        fetchDaySlots();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Delete lesson from timetable
  const handleDeleteLesson = (lessonId: number, subjectName: string) => {
    Alert.alert('Remove Lesson', `Are you sure you want to remove "${subjectName}" from the timetable?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/${tenantSlug}/mobile/timetable/delete`, {
              method: 'POST',
              body: JSON.stringify({ id: lessonId }),
            });
            setLessons((prev) => prev.filter((l) => l.id !== lessonId));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Unable to delete lesson');
          }
        },
      },
    ]);
  };

  const handleTestReminder = () => {
    Alert.alert(
      'Pre-Lesson Alert Preview',
      '⏰ In 10 minutes: Your scheduled lesson begins. Classroom bell will ring shortly.'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header Card (matches tab-timetable in app.blade.php) */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={styles.titleRow}>
              <Ionicons name="calendar-outline" size={18} color="#d97706" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Teaching Timetable</Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
              <Ionicons name="notifications" size={11} color={colors.primary} /> 10-min pre-lesson popup alerts enabled
            </Text>
          </View>

          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.bellBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              onPress={handleTestReminder}
              accessibilityLabel="Preview 10-Min Pre-Lesson Popup"
            >
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addLessonBtn, { backgroundColor: colors.primary }]}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.addLessonBtnText}>Add Lesson</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Day Pills (Mon - Sat) */}
        <View style={styles.dayPillsRow}>
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            const isToday = day === initialDay;

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayPill,
                  isSelected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dayPillText,
                    isSelected ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                  ]}
                >
                  {day.substring(0, 3)}
                </Text>
                {isToday && (
                  <View
                    style={[
                      styles.todayIndicator,
                      { backgroundColor: isSelected ? '#ffffff' : colors.primary },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Lessons Roster for selectedDay */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Loading {selectedDay}'s schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <View style={[styles.ttCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ttCardLeft}>
                <Text style={[styles.ttSubjectName, { color: colors.text }]}>{item.subjectName}</Text>
                <View style={styles.ttMetaRow}>
                  <Ionicons name="easel-outline" size={13} color={colors.primary} />
                  <Text style={[styles.ttMetaText, { color: colors.subtext }]}>
                    {item.className} {item.streamName ? `(${item.streamName})` : ''}
                    {item.roomName ? ` • Rm ${item.roomName}` : ''}
                  </Text>
                </View>
                {item.teacherName ? (
                  <View style={[styles.ttMetaRow, { marginTop: 2 }]}>
                    <Ionicons name="person-circle-outline" size={13} color="#2563eb" />
                    <Text style={[styles.ttMetaText, { color: colors.muted }]}>{item.teacherName}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.ttCardRight}>
                <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.timeBadgeText, { color: colors.primary }]}>
                    {item.startTime} - {item.endTime}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteLesson(item.id, item.subjectName)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar-clear-outline" size={38} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Lessons on {selectedDay}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                No teaching lessons have been scheduled for {selectedDay} yet.
              </Text>
              <TouchableOpacity
                style={[styles.addFirstBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                onPress={() => setIsAddModalVisible(true)}
              >
                <Text style={[styles.addFirstBtnText, { color: colors.primary }]}>+ Add {selectedDay} Lesson</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Add Lesson Modal */}
      <AddLessonModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSave={handleSaveLesson}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    margin: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
    elevation: 2,
  },
  addLessonBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  dayPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dayPillText: {
    fontSize: 11,
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 40,
  },
  loadingText: {
    fontSize: 13,
  },
  ttCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  ttCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  ttSubjectName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  ttMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ttMetaText: {
    fontSize: 11,
  },
  ttCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deleteBtn: {
    padding: 4,
  },
  emptyPlaceholder: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 270,
  },
  addFirstBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  addFirstBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
