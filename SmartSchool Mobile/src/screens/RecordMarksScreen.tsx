import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';
import { apiRequest } from '../api/client';
import { Student } from '../types';

export const RecordMarksScreen: React.FC<{ initialClassId?: number }> = ({ initialClassId }) => {
  const {
    tenantSlug,
    schoolClasses,
    assignedSubjects,
    terms,
    activeTerm,
    learnerLabel,
    learnersLabel,
    isDarkMode,
  } = useAuthStore();

  const colors = isDarkMode ? darkColors : lightColors;

  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    initialClassId || (schoolClasses.length > 0 ? schoolClasses[0].id : null)
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    assignedSubjects.length > 0 ? assignedSubjects[0].id : null
  );
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(
    activeTerm?.id || (terms.length > 0 ? terms[0].id : null)
  );

  // Auto-sync selections when school context finishes loading
  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
    } else if (!selectedClassId && schoolClasses.length > 0) {
      setSelectedClassId(schoolClasses[0].id);
    }
  }, [schoolClasses, initialClassId]);

  useEffect(() => {
    if (!selectedSubjectId && assignedSubjects.length > 0) {
      setSelectedSubjectId(assignedSubjects[0].id);
    }
  }, [assignedSubjects]);

  useEffect(() => {
    if (!selectedTermId && activeTerm?.id) {
      setSelectedTermId(activeTerm.id);
    } else if (!selectedTermId && terms.length > 0) {
      setSelectedTermId(terms[0].id);
    }
  }, [activeTerm, terms]);

  const [students, setStudents] = useState<Student[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [examSets, setExamSets] = useState<any[]>([]);
  const [isNumericalOnly, setIsNumericalOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Save feedback toast
  const [saveToast, setSaveToast] = useState<{ status: 'saving' | 'saved' | 'idle'; message: string }>({
    status: 'idle',
    message: '',
  });

  // Selected class & streams
  const activeClassObj = schoolClasses.find((c) => String(c.id) === String(selectedClassId));
  const availableStreams: any[] = activeClassObj?.streams || [];
  const classSubjects: any[] = activeClassObj?.subjects && activeClassObj.subjects.length > 0
    ? activeClassObj.subjects
    : assignedSubjects;

  // Fetch assessment data from backend
  const fetchMarksSheet = async () => {
    if (!selectedClassId || !selectedSubjectId || !tenantSlug) {
      setStudents([]);
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/students`, {
        method: 'POST',
        body: JSON.stringify({
          schoolclass_id: selectedClassId,
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          stream_id: selectedStreamId || undefined,
          term_id: selectedTermId || undefined,
          marks_mode: true,
        }),
      });

      const rawStudents = res.students || [];
      const mapped: Student[] = rawStudents.map((s: any, idx: number) => {
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
          currentScore: s.score || s.out80 || '',
          examsetMarks: s.examset_marks || {},
          competencyMarks: s.competency_marks || {},
          paperMarks: s.paper_marks || {},
        };
      });

      setStudents(mapped);
      setCompetencies(res.competencies || []);
      setExamSets(res.exam_sets || []);
      setIsNumericalOnly(!!res.is_numerical_only);
    } catch (err: any) {
      console.warn('Marks fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarksSheet();
  }, [selectedClassId, selectedSubjectId, selectedStreamId, selectedTermId, tenantSlug]);

  // Handle single cell save with auto-save toast feedback
  const handleCellMarkSave = async (
    studentId: number | string,
    fieldKey: string,
    score: string | number,
    extraPayload: any = {}
  ) => {
    // 1. Optimistic update in UI
    setStudents((prev) =>
      prev.map((s) => {
        if (String(s.id) === String(studentId)) {
          return {
            ...s,
            marks: {
              ...s.marks,
              [fieldKey]: score,
            },
          };
        }
        return s;
      })
    );

    setSaveToast({ status: 'saving', message: 'Saving mark...' });

    try {
      await apiRequest(`/${tenantSlug}/mobile/marks/cell`, {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          subject_id: selectedSubjectId,
          class_id: selectedClassId,
          term_id: selectedTermId,
          score,
          ...extraPayload,
        }),
      });

      setSaveToast({ status: 'saved', message: '✓ All marks saved' });
      setTimeout(() => {
        setSaveToast((t) => (t.status === 'saved' ? { status: 'idle', message: '' } : t));
      }, 2500);
    } catch {
      setSaveToast({ status: 'idle', message: '' });
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.lin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Filter Configuration Card (matches tab-marks in app.blade.php) */}
      <View style={[styles.filterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="create" size={18} color="#2563eb" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Record Assessment Marks</Text>
          </View>
          <View style={styles.autoSaveBadge}>
            <Ionicons name="flash" size={11} color="#2563eb" />
            <Text style={styles.autoSaveText}>Auto-Save</Text>
          </View>
        </View>

        {/* 1. Class Selector */}
        <Text style={[styles.fieldLabel, { color: colors.muted }]}>1. Select Class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {schoolClasses.map((cls) => {
            const isSelected = String(selectedClassId) === String(cls.id);
            return (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.pill,
                  isSelected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => {
                  setSelectedClassId(cls.id);
                  setSelectedStreamId(null);
                }}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                  ]}
                >
                  {cls.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. Subject Selector */}
        <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 10 }]}>2. Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {classSubjects.map((sub) => {
            const isSelected = String(selectedSubjectId) === String(sub.id);
            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.pill,
                  isSelected
                    ? { backgroundColor: '#2563eb', borderColor: '#1d4ed8' }
                    : { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setSelectedSubjectId(sub.id)}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected ? { color: '#ffffff', fontWeight: '800' } : { color: colors.subtext },
                  ]}
                >
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. Stream & Term Selectors */}
        <View style={styles.streamTermRow}>
          {availableStreams.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>3. Stream</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                <TouchableOpacity
                  style={[
                    styles.miniPill,
                    selectedStreamId === null
                      ? { backgroundColor: colors.text }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setSelectedStreamId(null)}
                >
                  <Text
                    style={[
                      styles.miniPillText,
                      selectedStreamId === null ? { color: colors.card, fontWeight: '700' } : { color: colors.muted },
                    ]}
                  >
                    All Streams
                  </Text>
                </TouchableOpacity>
                {availableStreams.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.miniPill,
                      String(selectedStreamId) === String(st.id)
                        ? { backgroundColor: colors.text }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 },
                    ]}
                    onPress={() => setSelectedStreamId(st.id)}
                  >
                    <Text
                      style={[
                        styles.miniPillText,
                        String(selectedStreamId) === String(st.id)
                          ? { color: colors.card, fontWeight: '700' }
                          : { color: colors.muted },
                      ]}
                    >
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {terms.length > 0 && (
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.muted }]}>4. Term</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {terms.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.miniPill,
                      String(selectedTermId) === String(t.id)
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 },
                    ]}
                    onPress={() => setSelectedTermId(t.id)}
                  >
                    <Text
                      style={[
                        styles.miniPillText,
                        String(selectedTermId) === String(t.id)
                          ? { color: '#ffffff', fontWeight: '700' }
                          : { color: colors.subtext },
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Floating Real-Time Save Feedback Badge (matches #mobileSaveToast in app.blade.php) */}
      {saveToast.status !== 'idle' && (
        <View style={[styles.saveToast, { backgroundColor: saveToast.status === 'saved' ? '#dcfce7' : '#eff6ff' }]}>
          <Ionicons
            name={saveToast.status === 'saved' ? 'checkmark-circle' : 'sync'}
            size={16}
            color={saveToast.status === 'saved' ? '#15803d' : '#2563eb'}
          />
          <Text style={[styles.saveToastText, { color: saveToast.status === 'saved' ? '#15803d' : '#2563eb' }]}>
            {saveToast.message}
          </Text>
        </View>
      )}

      {/* 2. Main Score Entry Marksheet Container */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            Opening live assessment marksheet...
          </Text>
        </View>
      ) : !selectedClassId || !selectedSubjectId ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="document-text-outline" size={40} color={colors.muted} />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>Select Class & Subject</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            Choose a Class and Subject above to open the live Assessment Marksheet.
          </Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={36} color={colors.muted} />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>No Students Found</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            {searchQuery ? 'No student matches that search query' : 'No students registered for this class & subject'}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Header & Search */}
          <View style={styles.rosterHeader}>
            <Text style={[styles.rosterTitle, { color: colors.text }]}>
              Assessment Marksheet ({filteredStudents.length} {learnersLabel})
            </Text>
            <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search learner..."
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <FlatList
            data={filteredStudents}
            keyExtractor={(item, index) => String(item?.id || index)}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 90 }}
            renderItem={({ item, index }) => (
              <View style={[styles.studentScoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Header */}
                <View style={styles.scoreCardHeader}>
                  <View style={styles.scoreCardLeft}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#eff6ff' }]}>
                      <Text style={[styles.avatarText, { color: '#2563eb' }]}>
                        {item.surname ? item.surname.charAt(0).toUpperCase() : 'S'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.studentFullName, { color: colors.text }]} numberOfLines={1}>
                        {item.fullName.toUpperCase()}
                      </Text>
                      <Text style={[styles.studentMeta, { color: colors.muted }]}>
                        {item.lin} {item.streamName ? `• ${item.streamName}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.indexBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text style={[styles.indexText, { color: colors.subtext }]}>#{index + 1}</Text>
                  </View>
                </View>

                {/* Score Input Blocks: Competencies / Exam Sets */}
                <View style={styles.scoresContainer}>
                  {/* A. Activities / Competencies (New Lower Secondary Curriculum: A1, A2, A3) */}
                  {competencies.length > 0 && (
                    <View style={styles.compGroup}>
                      <Text style={[styles.scoreGroupLabel, { color: colors.muted }]}>
                        Activities of Integration (1-3):
                      </Text>
                      <View style={styles.compList}>
                        {competencies.map((comp) => {
                          const fieldKey = `comp_${comp.id}`;
                          const currentScore = item.marks ? String(item.marks[fieldKey] || '') : '';

                          return (
                            <View key={comp.id} style={styles.compItem}>
                              <Text style={[styles.compCode, { color: colors.text }]}>{comp.code || 'AoI'}</Text>
                              <View style={styles.compButtonsRow}>
                                {[1, 2, 3].map((val) => {
                                  const isSelected = currentScore === String(val);
                                  return (
                                    <TouchableOpacity
                                      key={val}
                                      style={[
                                        styles.compBtn,
                                        isSelected
                                          ? { backgroundColor: '#2563eb', borderColor: '#1d4ed8' }
                                          : { backgroundColor: colors.inputBg, borderColor: colors.border },
                                      ]}
                                      onPress={() =>
                                        handleCellMarkSave(
                                          item.id,
                                          fieldKey,
                                          isSelected ? '' : String(val),
                                          { competency_id: comp.id }
                                        )
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.compBtnText,
                                          isSelected ? { color: '#ffffff', fontWeight: '800' } : { color: colors.text },
                                        ]}
                                      >
                                        {val}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* B. Exam Sets (e.g. BOT, MOT, EOT /100) */}
                  {examSets.length > 0 && (
                    <View style={[styles.examGroup, competencies.length > 0 && { marginTop: 8 }]}>
                      <Text style={[styles.scoreGroupLabel, { color: colors.muted }]}>
                        Term Exam Sets (/100):
                      </Text>
                      <View style={styles.examInputsRow}>
                        {examSets.map((es) => {
                          const fieldKey = `examset_${es.id}`;
                          const currentVal = item.marks ? String(item.marks[fieldKey] || '') : '';

                          return (
                            <View key={es.id} style={styles.examInputBox}>
                              <Text style={[styles.examSetLabel, { color: colors.muted }]}>
                                {es.short_name || es.name}
                              </Text>
                              <TextInput
                                style={[
                                  styles.examScoreInput,
                                  {
                                    backgroundColor: colors.inputBg,
                                    borderColor: currentVal ? '#2563eb' : colors.border,
                                    color: colors.text,
                                  },
                                ]}
                                defaultValue={currentVal}
                                onEndEditing={(e) =>
                                  handleCellMarkSave(item.id, fieldKey, e.nativeEvent.text, {
                                    examset_id: es.id,
                                  })
                                }
                                placeholder="—"
                                placeholderTextColor={colors.muted}
                                keyboardType="numeric"
                                maxLength={5}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* C. Fallback Exam Score if neither competency nor examset arrays returned */}
                  {competencies.length === 0 && examSets.length === 0 && (
                    <View style={styles.simpleScoreRow}>
                      <Text style={[styles.scoreGroupLabel, { color: colors.muted }]}>Subject Score (/100):</Text>
                      <TextInput
                        style={[
                          styles.simpleInput,
                          { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                        ]}
                        defaultValue={item.marks ? String(item.marks.score || '') : ''}
                        onEndEditing={(e) => handleCellMarkSave(item.id, 'score', e.nativeEvent.text)}
                        placeholder="0 - 100"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}
          />
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
  autoSaveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  autoSaveText: {
    color: '#2563eb',
    fontSize: 11,
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
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 8,
  },
  pillText: {
    fontSize: 12,
  },
  streamTermRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  miniPillText: {
    fontSize: 10.5,
  },
  saveToast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  saveToastText: {
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
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  rosterTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  searchBox: {
    width: 140,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    height: '100%',
  },
  studentScoreCard: {
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
  scoreCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  scoreCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
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
  scoresContainer: {
    marginTop: 8,
  },
  scoreGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  compGroup: {
    marginBottom: 4,
  },
  compList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  compItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compCode: {
    fontSize: 11,
    fontWeight: '800',
  },
  compButtonsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  compBtn: {
    width: 32,
    height: 30,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  examGroup: {
    marginTop: 6,
  },
  examInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  examInputBox: {
    alignItems: 'center',
    gap: 3,
  },
  examSetLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  examScoreInput: {
    width: 58,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  simpleScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simpleInput: {
    width: 80,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
});
