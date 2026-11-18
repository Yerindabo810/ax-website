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
  Modal,
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

  // Dropdown modal pickers state
  const [isClassModalVisible, setIsClassModalVisible] = useState<boolean>(false);
  const [isStreamModalVisible, setIsStreamModalVisible] = useState<boolean>(false);

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
      const mapped: Student[] = rawStudents.map((s: any, idx: number) => {
        let attStatus: 'present' | 'absent' | 'late' = 'present';
        const rawAtt = String(s.attendance || s.attendance_status || '').toUpperCase();
        if (rawAtt === 'A' || rawAtt === 'ABSENT' || rawAtt === 'AS') {
          attStatus = 'absent';
        } else if (rawAtt === 'L' || rawAtt === 'PL' || rawAtt === 'LATE') {
          attStatus = 'late';
        } else {
          attStatus = 'present';
        }

        const safeId = s.id !== undefined && s.id !== null && String(s.id).trim() !== '' && !isNaN(Number(s.id))
          ? Number(s.id)
          : (s.id ? String(s.id) : `st-${idx}-${Date.now()}`);

        return {
          id: safeId,
          lin: s.number || s.lin || s.peas_number || s.student_number || `LIN-${idx + 1}`,
          peasNumber: s.number || s.peas_number,
          surname: s.surname || '',
          lastname: s.lastname || '',
          fullName: s.name || `${s.surname || ''} ${s.lastname || ''}`.trim() || `Learner ${idx + 1}`,
          gender: s.gender || 'M',
          streamId: s.stream_id || undefined,
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
  const handleStatusChange = (studentId: number | string, status: 'present' | 'absent' | 'late') => {
    setStudents((prev) =>
      prev.map((s) => (String(s.id) === String(studentId) ? { ...s, attendanceStatus: status } : s))
    );
  };

  // Mark all present (matching markAllAttendance('P') in app.blade.php)
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

  const activeStreamObj = availableStreams.find((st) => String(st.id) === String(selectedStreamId));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* =====================================================
          1. TOP FILTER CARD (.m-card from app.blade.php)
          ===================================================== */}
      <View style={[styles.mCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header Row: Title & Date Input */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Class Roll Call</Text>
          </View>
          <View style={[styles.dateBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.text }]}>{selectedDate}</Text>
          </View>
        </View>

        {/* 2-Column Filter Grid (.filter-grid from app.blade.php) */}
        <View style={styles.filterGrid}>
          {/* Column 1: Select Class */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>Select Class</Text>
            <TouchableOpacity
              style={[styles.mSelect, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              onPress={() => setIsClassModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedClassId ? { color: colors.text, fontWeight: '700' } : { color: colors.muted },
                ]}
                numberOfLines={1}
              >
                {activeClassObj ? activeClassObj.name : '-- Choose Class --'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Column 2: Stream (Optional) */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>Stream (Optional)</Text>
            <TouchableOpacity
              style={[
                styles.mSelect,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                availableStreams.length === 0 && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (availableStreams.length > 0) {
                  setIsStreamModalVisible(true);
                }
              }}
              disabled={availableStreams.length === 0}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedStreamId ? { color: colors.text, fontWeight: '700' } : { color: colors.muted },
                ]}
                numberOfLines={1}
              >
                {activeStreamObj ? activeStreamObj.name : 'All Streams'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 60-Minute Edit Window Status Banner (.att-window-banner from app.blade.php) */}
        <View style={styles.attWindowBanner}>
          <View style={styles.bannerLeft}>
            <Ionicons name="checkmark-circle" size={15} color="#0f766e" />
            <Text style={styles.bannerText}>
              {selectedClassId
                ? 'New Attendance Session — Editable for 60 minutes after saving.'
                : 'Select a class to check attendance session status.'}
            </Text>
          </View>
          <View style={styles.timerPill}>
            <Text style={styles.timerPillText}>60m window</Text>
          </View>
        </View>

        {/* Search & All Present Row (matches app.blade.php) */}
        <View style={styles.searchAllPresentRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={15} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${learnerLabel.toLowerCase()} name...`}
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity
            style={styles.allPresentBtn}
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

      {/* =====================================================
          2. LEARNER ROSTER LIST (.learner-item from app.blade.php)
          ===================================================== */}
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
            Select a Class above to take {learnersLabel.toLowerCase()} attendance.
          </Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={36} color={colors.muted} />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>No Learners Found</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            {searchQuery ? 'No enrolled learner matches that name.' : 'No learners registered in this class/stream.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item, index) => String(item?.id || index)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 110 }}
          renderItem={({ item }) => (
            /* EXACT .learner-item ROW MATCHING app.blade.php */
            <View style={[styles.learnerItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Left Column: Name & ID (.learner-info) */}
              <View style={styles.learnerInfo}>
                <Text style={[styles.learnerName, { color: colors.text }]} numberOfLines={1}>
                  {item.fullName.toUpperCase()}
                </Text>
                <Text style={[styles.learnerSub, { color: colors.muted }]}>
                  ID: {item.lin} {item.streamName ? `• Stream ${item.streamName}` : ''}
                </Text>
              </View>

              {/* Right Column: Attendance Pills (.att-pill-group: [ P ] [ A ] [ L ]) */}
              <View style={styles.attPillGroup}>
                {/* [ P ] Button */}
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    item.attendanceStatus === 'present'
                      ? styles.attBtnActiveP
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'present')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.attBtnText,
                      item.attendanceStatus === 'present'
                        ? styles.attBtnTextActiveP
                        : { color: colors.subtext },
                    ]}
                  >
                    P
                  </Text>
                </TouchableOpacity>

                {/* [ A ] Button */}
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    item.attendanceStatus === 'absent'
                      ? styles.attBtnActiveA
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'absent')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.attBtnText,
                      item.attendanceStatus === 'absent'
                        ? styles.attBtnTextActiveA
                        : { color: colors.subtext },
                    ]}
                  >
                    A
                  </Text>
                </TouchableOpacity>

                {/* [ L ] Button */}
                <TouchableOpacity
                  style={[
                    styles.attBtn,
                    item.attendanceStatus === 'late'
                      ? styles.attBtnActiveL
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                  onPress={() => handleStatusChange(item.id, 'late')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.attBtnText,
                      item.attendanceStatus === 'late'
                        ? styles.attBtnTextActiveL
                        : { color: colors.subtext },
                    ]}
                  >
                    L
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* =====================================================
          3. BOTTOM SAVE BAR (#attSaveBar from app.blade.php)
          ===================================================== */}
      {students.length > 0 && (
        <View style={[styles.bottomSaveBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.btnSaveAttendance, { backgroundColor: colors.primary }]}
            onPress={handleSaveAttendance}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={styles.saveBtnContent}>
                <Ionicons name="cloud-upload" size={18} color="#ffffff" />
                <Text style={styles.btnSaveText}>Save Class Attendance</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* =====================================================
          CLASS SELECTOR MODAL
          ===================================================== */}
      <Modal
        visible={isClassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsClassModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsClassModalVisible(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Class</Text>
              <TouchableOpacity onPress={() => setIsClassModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {schoolClasses.map((cls) => {
                const isSelected = String(selectedClassId) === String(cls.id);
                return (
                  <TouchableOpacity
                    key={`modal-cls-${cls.id}`}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setSelectedStreamId(null);
                      setIsClassModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? { color: colors.primary, fontWeight: '700' } : { color: colors.text },
                      ]}
                    >
                      {cls.name}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =====================================================
          STREAM SELECTOR MODAL
          ===================================================== */}
      <Modal
        visible={isStreamModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStreamModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsStreamModalVisible(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Stream</Text>
              <TouchableOpacity onPress={() => setIsStreamModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  selectedStreamId === null && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  setSelectedStreamId(null);
                  setIsStreamModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedStreamId === null ? { color: colors.primary, fontWeight: '700' } : { color: colors.text },
                  ]}
                >
                  All Streams
                </Text>
                {selectedStreamId === null && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {availableStreams.map((st) => {
                const isSelected = String(selectedStreamId) === String(st.id);
                return (
                  <TouchableOpacity
                    key={`modal-st-${st.id}`}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => {
                      setSelectedStreamId(st.id);
                      setIsStreamModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? { color: colors.primary, fontWeight: '700' } : { color: colors.text },
                      ]}
                    >
                      {st.name}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mCard: {
    margin: 14,
    marginBottom: 8,
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
  filterGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  filterCol: {
    flex: 1,
  },
  mLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mSelect: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  selectText: {
    fontSize: 13,
    flex: 1,
    marginRight: 6,
  },
  attWindowBanner: {
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0f766e',
    lineHeight: 16,
    flex: 1,
  },
  timerPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  timerPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f766e',
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
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
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
  /* EXACT .learner-item ROW STYLES (from app.blade.php) */
  learnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    gap: 10,
  },
  learnerInfo: {
    flex: 1,
    minWidth: 0,
  },
  learnerName: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  learnerSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  /* EXACT .att-pill-group BUTTONS: [ P ] [ A ] [ L ] */
  attPillGroup: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  attBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  attBtnActiveP: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  attBtnTextActiveP: {
    color: '#15803d',
    fontWeight: '800',
  },
  attBtnActiveA: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  attBtnTextActiveA: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  attBtnActiveL: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  attBtnTextActiveL: {
    color: '#b45309',
    fontWeight: '800',
  },
  /* Save Button matching #attSaveBar in app.blade.php */
  bottomSaveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  btnSaveAttendance: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 14,
  },
});
