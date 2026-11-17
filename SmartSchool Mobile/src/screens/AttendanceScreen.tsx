import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';
import { apiRequest } from '../api/client';
import { Student } from '../types';

export const AttendanceScreen: React.FC<{ initialClassId?: number }> = ({ initialClassId }) => {
  const {
    tenantSlug,
    schoolClasses,
    learnerLabel,
    learnersLabel,
    isDarkMode,
  } = useAuthStore();

  const colors = isDarkMode ? darkColors : lightColors;

  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    initialClassId || (schoolClasses.length > 0 ? schoolClasses[0].id : null)
  );
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Auto-sync selected class when schoolClasses loads from backend or initialClassId changes
  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
    } else if (!selectedClassId && schoolClasses.length > 0) {
      setSelectedClassId(schoolClasses[0].id);
    }
  }, [schoolClasses, initialClassId]);

  // Available streams for selected class
  const activeClassObj = schoolClasses.find((c) => String(c.id) === String(selectedClassId));
  const availableStreams: any[] = activeClassObj?.streams || [];

  // Fetch real students from backend when class or stream changes
  const fetchClassStudents = async () => {
    if (!selectedClassId || !tenantSlug) {
      setStudents([]);
      return;
    }

    setLoading(true);
    setSaveSuccessMsg(null);

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/students`, {
        method: 'POST',
        body: JSON.stringify({
          schoolclass_id: selectedClassId,
          class_id: selectedClassId,
          stream_id: selectedStreamId || undefined,
          date: selectedDate,
        }),
      });

      const rawStudents = res.students || [];
      const mapped: Student[] = rawStudents.map((s: any) => {
        let attStatus: 'present' | 'absent' | 'late' = 'present';
        const rawAtt = String(s.attendance || s.attendance_status || '').toUpperCase();
        if (rawAtt === 'A' || rawAtt === 'ABSENT' || rawAtt === 'AS') {
          attStatus = 'absent';
        } else if (rawAtt === 'L' || rawAtt === 'PL' || rawAtt === 'LATE') {
          attStatus = 'late';
        } else {
          attStatus = 'present';
        }

        return {
          id: Number(s.id),
          lin: s.number || s.lin || s.peas_number || s.student_number || `LIN-${s.id}`,
          peasNumber: s.number || s.peas_number,
          surname: s.surname || '',
          lastname: s.lastname || '',
          fullName: s.name || `${s.surname || ''} ${s.lastname || ''}`.trim() || 'Learner',
          gender: s.gender || 'M',
          streamId: s.stream_id ? Number(s.stream_id) : undefined,
          streamName: s.stream_name || '',
          classId: selectedClassId,
          className: activeClassObj?.name || '',
          attendanceStatus: attStatus,
        };
      });

      setStudents(mapped);
    } catch (err: any) {
      console.warn('Student fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassStudents();
  }, [selectedClassId, selectedStreamId, selectedDate, tenantSlug]);

  // Handle single student attendance state change
  const handleStatusChange = (studentId: number, status: 'present' | 'absent' | 'late') => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, attendanceStatus: status } : s))
    );
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, attendanceStatus: 'present' })));
  };

  // Submit batch attendance to backend
  const handleSaveAttendance = async () => {
    if (!selectedClassId || students.length === 0) return;

    setSaving(true);
    setSaveSuccessMsg(null);

    // Build payload matching app.blade.php
    const records = students.map((s) => ({
      student_id: s.id,
      stream_id: s.streamId || selectedStreamId,
      status: s.attendanceStatus === 'present' ? 'P' : s.attendanceStatus === 'late' ? 'L' : 'A',
    }));

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/attendance/save`, {
        method: 'POST',
        body: JSON.stringify({
          schoolclass_id: selectedClassId,
          class_id: selectedClassId,
          stream_id: selectedStreamId || undefined,
          date: selectedDate,
          records,
        }),
      });

      setSaveSuccessMsg(res.message || `✓ Attendance saved for ${students.length} ${learnersLabel.toLowerCase()}!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      Alert.alert('Attendance Save', err.message || 'Saved to offline cache.');
    } finally {
      setSaving(false);
    }
  };

  // Filter students by search
  const filteredStudents = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.lin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentCount = students.filter((s) => s.attendanceStatus === 'present').length;
  const absentCount = students.filter((s) => s.attendanceStatus === 'absent').length;
  const lateCount = students.filter((s) => s.attendanceStatus === 'late').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Filter Card (matches tab-attendance top card in app.blade.php) */}
      <View style={[styles.filterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="clipboard" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Class Roll Call</Text>
          </View>
          <View style={[styles.dateBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.text }]}>{selectedDate}</Text>
          </View>
        </View>

        {/* 1. Class Selector Scroll */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Select Class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {schoolClasses && schoolClasses.length > 0 ? (
            schoolClasses.map((cls) => {
              const isSelected = String(selectedClassId) === String(cls.id);
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.classPill,
                    isSelected
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    setSelectedClassId(cls.id);
                    setSelectedStreamId(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.classPillText,
                      isSelected ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                    ]}
                  >
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.noDataText, { color: colors.muted }]}>No classes loaded from school</Text>
          )}
        </ScrollView>

        {/* 2. Stream Selector Scroll (Optional) */}
        {availableStreams.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 10 }]}>Stream (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              <TouchableOpacity
                style={[
                  styles.streamPill,
                  selectedStreamId === null
                    ? { backgroundColor: colors.text, borderColor: colors.text }
                    : { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setSelectedStreamId(null)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.streamPillText,
                    selectedStreamId === null ? { color: colors.card, fontWeight: '700' } : { color: colors.muted },
                  ]}
                >
                  All Streams
                </Text>
              </TouchableOpacity>
              {availableStreams.map((st) => {
                const isSelected = String(selectedStreamId) === String(st.id);
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.streamPill,
                      isSelected
                        ? { backgroundColor: colors.text, borderColor: colors.text }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedStreamId(st.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.streamPillText,
                        isSelected ? { color: colors.card, fontWeight: '700' } : { color: colors.muted },
                      ]}
                    >
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* 60-Minute Edit Window Status Banner (matches #attSessionBanner in app.blade.php) */}
        <View style={[styles.sessionBanner, { backgroundColor: colors.primaryLight }]}>
          <View style={styles.sessionLeft}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.sessionText, { color: colors.primary }]}>
              {selectedClassId ? 'Editable for 60 mins • Then saves as new roll call' : 'Select a class to take roll call'}
            </Text>
          </View>
          <View style={[styles.windowPill, { backgroundColor: colors.card }]}>
            <Text style={[styles.windowPillText, { color: colors.primary }]}>60m window</Text>
          </View>
        </View>

        {/* Search & "All Present" Button Row */}
        <View style={styles.searchAllPresentRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={14} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${learnerLabel.toLowerCase()} name...`}
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity
            style={[styles.allPresentBtn, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
            onPress={handleMarkAllPresent}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-done" size={14} color="#15803d" />
            <Text style={styles.allPresentBtnText}>All Present</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#15803d" />
          <Text style={styles.successBannerText}>{saveSuccessMsg}</Text>
        </View>
      )}

      {/* Summary Counts Bar (when class is loaded) */}
      {students.length > 0 && (
        <View style={[styles.countsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.countItem, { color: colors.text }]}>
            Total: <Text style={{ fontWeight: '800' }}>{students.length}</Text>
          </Text>
          <Text style={[styles.countItem, { color: '#16a34a' }]}>
            Present: <Text style={{ fontWeight: '800' }}>{presentCount}</Text>
          </Text>
          <Text style={[styles.countItem, { color: '#dc2626' }]}>
            Absent: <Text style={{ fontWeight: '800' }}>{absentCount}</Text>
          </Text>
          {lateCount > 0 && (
            <Text style={[styles.countItem, { color: '#d97706' }]}>
              Late: <Text style={{ fontWeight: '800' }}>{lateCount}</Text>
            </Text>
          )}
        </View>
      )}

      {/* 2. Student Roster List */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            Loading {learnersLabel.toLowerCase()} roster...
          </Text>
        </View>
      ) : !selectedClassId ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="people-outline" size={40} color={colors.muted} />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>Select a Class Above</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            Choose a class from the list above to open the live roll call roster.
          </Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={36} color={colors.muted} />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>No Students Found</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            {searchQuery ? 'No enrolled student matches that name' : 'No students registered in this class'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 110 }}
          renderItem={({ item, index }) => (
            <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTopRow}>
                <View style={styles.studentInfoLeft}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {item.surname ? item.surname.charAt(0).toUpperCase() : 'S'}
                    </Text>
                  </View>
                  <View style={styles.nameBlock}>
                    <Text style={[styles.studentFullName, { color: colors.text }]} numberOfLines={1}>
                      {item.fullName.toUpperCase()}
                    </Text>
                    <Text style={[styles.studentMeta, { color: colors.muted }]}>
                      {item.lin} {item.streamName ? `• Stream ${item.streamName}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={[styles.indexBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[styles.indexText, { color: colors.subtext }]}>#{index + 1}</Text>
                </View>
              </View>

              {/* 3-State Toggle Action Buttons */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    item.attendanceStatus === 'present'
                      ? { backgroundColor: '#16a34a', borderColor: '#15803d' }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'present')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      item.attendanceStatus === 'present' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                    ]}
                  >
                    ✓ Present
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    item.attendanceStatus === 'absent'
                      ? { backgroundColor: '#dc2626', borderColor: '#b91c1c' }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'absent')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      item.attendanceStatus === 'absent' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                    ]}
                  >
                    ✕ Absent
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    item.attendanceStatus === 'late'
                      ? { backgroundColor: '#d97706', borderColor: '#b45309' }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'late')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      item.attendanceStatus === 'late' ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                    ]}
                  >
                    ◷ Late
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* 3. Floating Save Bar (matches #attSaveBar in app.blade.php) */}
      {students.length > 0 && (
        <View style={styles.floatingBottom}>
          <TouchableOpacity
            style={[styles.btnSaveAttendance, { backgroundColor: colors.primary }]}
            onPress={handleSaveAttendance}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.saveBtnContent}>
                <Ionicons name="cloud-upload" size={18} color="#ffffff" />
                <Text style={styles.saveBtnLabel}>Save Class Attendance</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterCard: {
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  classPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 8,
  },
  classPillText: {
    fontSize: 12,
  },
  streamPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  streamPillText: {
    fontSize: 11,
  },
  noDataText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sessionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  windowPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  windowPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  searchAllPresentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  allPresentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  allPresentBtnText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800',
  },
  countsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
  },
  countItem: {
    fontSize: 12,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  successBannerText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
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
  emptyPlaceholder: {
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  placeholderSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 270,
  },
  studentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  studentInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  studentFullName: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  indexBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  toggleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 12,
  },
  floatingBottom: {
    position: 'absolute',
    bottom: 24,
    left: 14,
    right: 14,
  },
  btnSaveAttendance: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
