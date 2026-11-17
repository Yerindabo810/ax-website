import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface AddLessonModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lessonData: {
    day: string;
    class_id: string | number;
    stream_id: string | number;
    subject_id: string | number;
    room_name: string;
    start_time: string;
    end_time: string;
  }) => Promise<boolean>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AddLessonModal: React.FC<AddLessonModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { schoolClasses, assignedSubjects, isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const classes = schoolClasses || [];
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [selectedClassId, setSelectedClassId] = useState<number | string>(
    classes.length > 0 ? classes[0].id : ''
  );

  const selectedClassObj = classes.find((c) => String(c.id) === String(selectedClassId));
  const streams = selectedClassObj?.streams || [];
  const [selectedStreamId, setSelectedStreamId] = useState<number | string>(
    streams.length > 0 ? streams[0].id : ''
  );

  const subjects = selectedClassObj?.subjects && selectedClassObj.subjects.length > 0
    ? selectedClassObj.subjects
    : assignedSubjects;

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | string>(
    subjects.length > 0 ? subjects[0].id : ''
  );

  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('08:40');
  const [roomName, setRoomName] = useState<string>('Room 1');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedClassId) {
      setErrorMessage('Please select a class');
      return;
    }
    if (!selectedSubjectId) {
      setErrorMessage('Please select a subject');
      return;
    }
    if (!startTime || !endTime) {
      setErrorMessage('Please provide both start and end time');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const success = await onSave({
      day: selectedDay,
      class_id: selectedClassId,
      stream_id: selectedStreamId || '',
      subject_id: selectedSubjectId,
      room_name: roomName.trim(),
      start_time: startTime.trim(),
      end_time: endTime.trim(),
    });

    setLoading(false);
    if (success) {
      onClose();
    } else {
      setErrorMessage('Failed to schedule lesson. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule Lesson</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 20 }}>
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Day Selector */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Day of Week</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.pill,
                    selectedDay === day
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedDay === day ? { color: '#ffffff', fontWeight: '700' } : { color: colors.subtext },
                    ]}
                  >
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Class Selector */}
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.pill,
                    String(selectedClassId) === String(c.id)
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      String(selectedClassId) === String(c.id)
                        ? { color: '#ffffff', fontWeight: '700' }
                        : { color: colors.subtext },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Stream Selector */}
            {streams.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>Stream</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                  <TouchableOpacity
                    style={[
                      styles.pill,
                      selectedStreamId === ''
                        ? { backgroundColor: colors.text, borderColor: colors.text }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedStreamId('')}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedStreamId === '' ? { color: colors.card, fontWeight: '700' } : { color: colors.muted },
                      ]}
                    >
                      All Streams
                    </Text>
                  </TouchableOpacity>
                  {streams.map((s: any) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.pill,
                        String(selectedStreamId) === String(s.id)
                          ? { backgroundColor: colors.text, borderColor: colors.text }
                          : { backgroundColor: colors.inputBg, borderColor: colors.border },
                      ]}
                      onPress={() => setSelectedStreamId(s.id)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          String(selectedStreamId) === String(s.id)
                            ? { color: colors.card, fontWeight: '700' }
                            : { color: colors.muted },
                        ]}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Subject Selector */}
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {subjects.map((sub: any) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.pill,
                    String(selectedSubjectId) === String(sub.id)
                      ? { backgroundColor: '#2563eb', borderColor: '#1d4ed8' }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedSubjectId(sub.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      String(selectedSubjectId) === String(sub.id)
                        ? { color: '#ffffff', fontWeight: '700' }
                        : { color: colors.subtext },
                    ]}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time Slots */}
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>Start Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>End Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="08:40"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            {/* Room Name */}
            <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 14 }]}>Room / Location</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="e.g. Room 101, Lab 2, Main Hall"
              placeholderTextColor={colors.muted}
            />

            {/* Actions */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Lesson to Timetable</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayScroll: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  pillText: {
    fontSize: 13,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
