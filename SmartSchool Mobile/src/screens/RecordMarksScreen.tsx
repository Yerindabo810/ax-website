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
  Alert,
  Modal,
  Platform,
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

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    initialClassId || (schoolClasses.length > 0 ? schoolClasses[0].id : null)
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(
    activeTerm?.id || (terms.length > 0 ? terms[0].id : null)
  );

  // Dropdown Modals visibility
  const [isClassModalVisible, setIsClassModalVisible] = useState<boolean>(false);
  const [isSubjectModalVisible, setIsSubjectModalVisible] = useState<boolean>(false);
  const [isStreamModalVisible, setIsStreamModalVisible] = useState<boolean>(false);
  const [isTermModalVisible, setIsTermModalVisible] = useState<boolean>(false);

  // Auto-sync initial selections
  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
    } else if (!selectedClassId && schoolClasses.length > 0) {
      setSelectedClassId(schoolClasses[0].id);
    }
  }, [schoolClasses, initialClassId]);

  useEffect(() => {
    if (!selectedTermId && activeTerm?.id) {
      setSelectedTermId(activeTerm.id);
    } else if (!selectedTermId && terms.length > 0) {
      setSelectedTermId(terms[0].id);
    }
  }, [activeTerm, terms]);

  // Active object references
  const activeClassObj = schoolClasses.find((c) => String(c.id) === String(selectedClassId));
  const availableStreams: any[] = activeClassObj?.streams || [];
  const classSubjects: any[] =
    activeClassObj?.subjects && activeClassObj.subjects.length > 0
      ? activeClassObj.subjects
      : assignedSubjects;

  const activeSubjectObj = classSubjects.find((s) => String(s.id) === String(selectedSubjectId));
  const activeStreamObj = availableStreams.find((s) => String(s.id) === String(selectedStreamId));
  const activeTermObj = terms.find((t) => String(t.id) === String(selectedTermId)) || activeTerm;

  // Auto-select first subject if not set
  useEffect(() => {
    if (classSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [examSets, setExamSets] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [classSubjectId, setClassSubjectId] = useState<string | number | null>(null);
  const [isAlevel, setIsAlevel] = useState<boolean>(false);
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [savingAll, setSavingAll] = useState<boolean>(false);

  // Real-time cell save statuses: { [cellKey]: 'saving' | 'saved' | 'error' }
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Floating save feedback toast (matches #mobileSaveToast in app.blade.php)
  const [saveToast, setSaveToast] = useState<{ status: 'saving' | 'saved' | 'error' | 'idle'; message: string }>({
    status: 'idle',
    message: '',
  });

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
        const safeId =
          s.id !== undefined && s.id !== null && String(s.id).trim() !== '' && !isNaN(Number(s.id))
            ? Number(s.id)
            : s.id ? String(s.id) : `st-${idx}-${Date.now()}`;

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
          out80: s.out80,
          examsetMarks: s.examset_marks || {},
          competencyMarks: s.competency_marks || {},
          paperMarks: s.paper_marks || {},
        };
      });

      setStudents(mapped);
      setCompetencies(res.competencies || []);
      setExamSets(res.exam_sets || []);
      setPapers(res.papers || []);
      setClassSubjectId(res.class_subject_id || null);
      setIsAlevel(!!res.is_alevel);
      setIsPrimary(!!res.is_primary);
    } catch (err: any) {
      console.warn('Marks fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarksSheet();
  }, [selectedClassId, selectedSubjectId, selectedStreamId, selectedTermId, tenantSlug]);

  // Real-time single cell auto-save (matches saveMarkCellAjax in app.blade.php)
  const handleScoreBoxChange = async (
    studentId: number | string,
    scoreType: 'competency' | 'examset' | 'paper' | 'mark100' | 'out80',
    typeId: string | number | undefined,
    paperId: string | number | undefined,
    scoreVal: string
  ) => {
    const cleanScore = scoreVal.trim();
    const cellKey = `${studentId}_${scoreType}_${typeId || ''}_${paperId || ''}`;

    // 1. Optimistic update in-memory student object
    setStudents((prev) =>
      prev.map((s) => {
        if (String(s.id) === String(studentId)) {
          if (scoreType === 'competency' && typeId) {
            return {
              ...s,
              competencyMarks: {
                ...(s.competencyMarks || {}),
                [String(typeId)]: cleanScore,
              },
            };
          } else if (scoreType === 'examset' && typeId) {
            return {
              ...s,
              examsetMarks: {
                ...(s.examsetMarks || {}),
                [String(typeId)]: cleanScore,
              },
            };
          } else if (scoreType === 'paper' && paperId) {
            const currentPaper = (s.paperMarks && s.paperMarks[String(paperId)]) || {};
            const esKey = typeId ? String(typeId) : 'default';
            return {
              ...s,
              paperMarks: {
                ...(s.paperMarks || {}),
                [String(paperId)]: {
                  ...currentPaper,
                  [esKey]: cleanScore,
                },
              },
            };
          } else {
            return {
              ...s,
              currentScore: cleanScore,
              out80: cleanScore,
            };
          }
        }
        return s;
      })
    );

    // 2. Set saving status
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));
    setSaveToast({ status: 'saving', message: 'Saving mark...' });

    // Cell ID format matching app.blade.php
    let cellId = '';
    if (scoreType === 'competency') {
      cellId = `${studentId}_${typeId}_remark`;
    } else if (scoreType === 'examset') {
      cellId = `${studentId}_examset_${typeId}`;
    } else if (scoreType === 'paper') {
      cellId = typeId ? `${studentId}_paper_${paperId}_examset_${typeId}` : `${studentId}_paper_${paperId}_mark`;
    } else {
      cellId = `${studentId}_mark`;
    }

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/marks/cell`, {
        method: 'POST',
        body: JSON.stringify({
          id: cellId,
          mark: cleanScore,
          class_subject_id: classSubjectId,
          schoolterm_id: selectedTermId,
          student_id: studentId,
          class_subject_competency_id: scoreType === 'competency' ? typeId : undefined,
        }),
      });

      setCellStatus((prev) => ({ ...prev, [cellKey]: 'saved' }));
      setSaveToast({ status: 'saved', message: res.message || '✓ All marks saved' });

      // If backend calculated out of 80
      if (res.converted80 !== undefined && res.student_id) {
        setStudents((prev) =>
          prev.map((s) => (String(s.id) === String(res.student_id) ? { ...s, out80: res.converted80 } : s))
        );
      }

      setTimeout(() => {
        setCellStatus((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
        setSaveToast((t) => (t.status === 'saved' ? { status: 'idle', message: '' } : t));
      }, 2500);
    } catch (err: any) {
      setCellStatus((prev) => ({ ...prev, [cellKey]: 'error' }));
      setSaveToast({ status: 'error', message: '✕ Error saving mark' });
      setTimeout(() => {
        setSaveToast((t) => (t.status === 'error' ? { status: 'idle', message: '' } : t));
      }, 3000);
    }
  };

  // Submit all marks in batch (matches submitMarks in app.blade.php)
  const handleSaveAllMarks = async () => {
    if (!selectedClassId || !selectedSubjectId || students.length === 0) return;

    setSavingAll(true);
    setSaveToast({ status: 'saving', message: 'Saving all marks...' });

    const payload = {
      schoolclass_id: selectedClassId,
      class_subject_id: classSubjectId,
      subject_id: selectedSubjectId,
      stream_id: selectedStreamId || undefined,
      term_id: selectedTermId,
      scores: students.map((s) => ({
        student_id: s.id,
        stream_id: s.streamId || selectedStreamId,
        score: s.currentScore,
        examset_marks: s.examsetMarks || {},
        competency_marks: s.competencyMarks || {},
      })),
    };

    try {
      const res = await apiRequest(`/${tenantSlug}/mobile/marks/save`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSaveToast({ status: 'saved', message: res.message || '✓ All marks saved!' });
      Alert.alert('Assessment Marks', res.message || 'All marks saved successfully to the main system.');
      setTimeout(() => {
        setSaveToast((t) => (t.status === 'saved' ? { status: 'idle', message: '' } : t));
      }, 3000);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to save marks.');
    } finally {
      setSavingAll(false);
    }
  };

  // Filter students by search
  const filteredStudents = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.lin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExamSets = (examSets || []).filter((es) => {
    if (isPrimary) {
      const sn = String(es.short_name || es.name || '').toLowerCase();
      if (sn.includes('aoi')) return false;
    }
    return true;
  });
  const hasExamSets = filteredExamSets.length > 0;
  const hasPapers = papers && papers.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* =====================================================
          1. TOP FILTER CARD (.m-card from app.blade.php)
          ===================================================== */}
      <View style={[styles.mCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header Row: Title & Auto-Save Badge */}
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

        {/* 2-Column Filter Grid Row 1: Select Class & Subject */}
        <View style={styles.filterGrid}>
          {/* Column 1: Select Class */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>1. Select Class</Text>
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

          {/* Column 2: Subject */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>2. Subject</Text>
            <TouchableOpacity
              style={[
                styles.mSelect,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                classSubjects.length === 0 && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (classSubjects.length > 0) setIsSubjectModalVisible(true);
              }}
              disabled={classSubjects.length === 0}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedSubjectId ? { color: colors.text, fontWeight: '700' } : { color: colors.muted },
                ]}
                numberOfLines={1}
              >
                {activeSubjectObj ? activeSubjectObj.name : '-- Select Subject --'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2-Column Filter Grid Row 2: Stream & Academic Term */}
        <View style={[styles.filterGrid, { marginBottom: 0 }]}>
          {/* Column 1: Stream (Optional) */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>3. Stream (Optional)</Text>
            <TouchableOpacity
              style={[
                styles.mSelect,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                availableStreams.length === 0 && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (availableStreams.length > 0) setIsStreamModalVisible(true);
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

          {/* Column 2: Academic Term */}
          <View style={styles.filterCol}>
            <Text style={[styles.mLabel, { color: colors.muted }]}>4. Academic Term</Text>
            <TouchableOpacity
              style={[
                styles.mSelect,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                terms.length === 0 && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (terms.length > 0) setIsTermModalVisible(true);
              }}
              disabled={terms.length === 0}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedTermId ? { color: colors.text, fontWeight: '700' } : { color: colors.muted },
                ]}
                numberOfLines={1}
              >
                {activeTermObj ? `${activeTermObj.name} (${activeTermObj.academic_year || ''})` : '-- Select Term --'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* =====================================================
          2. MAIN SCORE ENTRY CONTAINER (.marks-sheet-container)
          ===================================================== */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            Opening live assessment marksheet...
          </Text>
        </View>
      ) : !selectedClassId || !selectedSubjectId ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="document-text-outline" size={42} color="#94a3b8" />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>Select Class & Subject</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            Select a Class and Subject above to open the live Assessment Marksheet.
          </Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={[styles.emptyPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={38} color="#94a3b8" />
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>No Learners Found</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.muted }]}>
            {searchQuery
              ? 'No registered learner matches that name or LIN.'
              : 'No learners registered in this class/stream.'}
          </Text>
        </View>
      ) : (
        <View style={styles.marksSheetContainer}>
          {/* Marksheet Card Header (.marks-sheet-header from app.blade.php) */}
          <View style={[styles.marksSheetHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHeaderTopRow}>
              <View style={styles.marksSheetHeaderIcon}>
                <Ionicons name="grid" size={18} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.marksSheetTitle, { color: colors.text }]}>
                  Assessment Marksheet ({filteredStudents.length}{' '}
                  {filteredStudents.length === 1 ? learnerLabel : learnersLabel})
                </Text>
                <Text style={[styles.marksSheetSubtitle, { color: colors.muted }]}>
                  Auto-saving mark entry. Tap any box to enter scores.
                </Text>
              </View>
            </View>

            {/* Search Box */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={15} color="#94a3b8" />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search learner..."
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          {/* Roster List of Student Cards */}
          <FlatList
            data={filteredStudents}
            keyExtractor={(item, index) => String(item?.id || index)}
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 110 }}
            renderItem={({ item, index }) => {
              const cardNum = index + 1;
              const firstLetter = item.fullName ? item.fullName.trim().charAt(0).toUpperCase() : 'S';

              return (
                /* EXACT .assessment-student-card MATCHING app.blade.php */
                <View
                  style={[
                    styles.assessmentStudentCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {/* Top Header: Avatar, Name, LIN, Index */}
                  <View style={[styles.studentCardHeader, { borderBottomColor: colors.border }]}>
                    <View style={styles.studentCardHeaderLeft}>
                      {/* Avatar Badge */}
                      <View style={styles.studentAvatarBadge}>
                        <Text style={styles.avatarLetter}>{firstLetter}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.studentCardName, { color: colors.text }]} numberOfLines={1}>
                          {item.fullName.toUpperCase()}
                        </Text>
                        <Text style={[styles.studentCardMeta, { color: colors.muted }]}>
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' }}>
                            {item.lin}
                          </Text>
                          {item.streamName ? ` • Stream ${item.streamName}` : ''}
                        </Text>
                      </View>
                    </View>

                    {/* #{cardNum} Index Pill */}
                    <View style={[styles.cardIndexBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Text style={[styles.cardIndexText, { color: colors.muted }]}>#{cardNum}</Text>
                    </View>
                  </View>

                  {/* Scores Grid (.assessment-card-scores-grid) */}
                  <View style={styles.assessmentScoresGrid}>
                    {/* 1. O-Level Competencies (A1 /3, A2 /3, ...) — never shown for Primary or A-Level */}
                    {!isPrimary && !isAlevel && competencies.length > 0 && (
                      competencies.map((comp) => {
                        const cellKey = `${item.id}_competency_${comp.id}_`;
                        const status = cellStatus[cellKey];
                        const val = item.competencyMarks ? String(item.competencyMarks[comp.id] ?? '') : '';

                        return (
                          <View key={`comp-${comp.id}`} style={styles.scoreInputItem}>
                            <View style={styles.scoreInputHeader}>
                              <Text style={[styles.scoreLabel, { color: colors.subtext }]}>{comp.code}</Text>
                              <Text style={[styles.scoreMax, { color: colors.muted }]}>/3</Text>
                            </View>
                            <TextInput
                              style={[
                                styles.mobileScoreBox,
                                {
                                  backgroundColor: colors.inputBg,
                                  borderColor: colors.border,
                                  color: colors.text,
                                },
                                status === 'saving' && styles.boxSaving,
                                status === 'saved' && styles.boxSaved,
                                status === 'error' && styles.boxError,
                              ]}
                              defaultValue={val}
                              placeholder="-"
                              placeholderTextColor={colors.muted}
                              keyboardType="numeric"
                              maxLength={3}
                              onEndEditing={(e) =>
                                handleScoreBoxChange(item.id, 'competency', comp.id, undefined, e.nativeEvent.text)
                              }
                            />
                          </View>
                        );
                      })
                    )}

                    {/* 2. A-Level / Primary vs O-Level Exam Sets & Papers */}
                    {isAlevel || isPrimary ? (
                      hasExamSets ? (
                        filteredExamSets.map((es) => {
                          if (hasPapers) {
                            return papers.map((paper) => {
                              const cellKey = `${item.id}_paper_${es.id}_${paper.id}`;
                              const status = cellStatus[cellKey];
                              const maxM = paper.max || es.max || 100;
                              const pMap = item.paperMarks && item.paperMarks[paper.id];
                              const pVal = pMap && pMap[es.id] !== undefined ? String(pMap[es.id]) : '';

                              return (
                                <View key={`p-${paper.id}-es-${es.id}`} style={styles.scoreInputItem}>
                                  <View style={styles.scoreInputHeader}>
                                    <Text style={[styles.scoreLabel, { color: colors.subtext }]}>
                                      {String(es.short_name).toUpperCase()} P{paper.number}
                                    </Text>
                                    <Text style={[styles.scoreMax, { color: colors.muted }]}>/{maxM}</Text>
                                  </View>
                                  <TextInput
                                    style={[
                                      styles.mobileScoreBox,
                                      {
                                        backgroundColor: colors.inputBg,
                                        borderColor: colors.border,
                                        color: colors.text,
                                      },
                                      status === 'saving' && styles.boxSaving,
                                      status === 'saved' && styles.boxSaved,
                                      status === 'error' && styles.boxError,
                                    ]}
                                    defaultValue={pVal}
                                    placeholder="-"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="numeric"
                                    maxLength={5}
                                    onEndEditing={(e) =>
                                      handleScoreBoxChange(item.id, 'paper', es.id, paper.id, e.nativeEvent.text)
                                    }
                                  />
                                </View>
                              );
                            });
                          } else {
                            const cellKey = `${item.id}_examset_${es.id}_`;
                            const status = cellStatus[cellKey];
                            const maxM = es.max || 100;
                            const esVal = item.examsetMarks ? String(item.examsetMarks[es.id] ?? '') : '';

                            return (
                              <View key={`es-${es.id}`} style={styles.scoreInputItem}>
                                <View style={styles.scoreInputHeader}>
                                  <Text style={[styles.scoreLabel, { color: colors.subtext }]}>
                                    {String(es.short_name).toUpperCase()}
                                  </Text>
                                  <Text style={[styles.scoreMax, { color: colors.muted }]}>/{maxM}</Text>
                                </View>
                                <TextInput
                                  style={[
                                    styles.mobileScoreBox,
                                    {
                                      backgroundColor: colors.inputBg,
                                      borderColor: colors.border,
                                      color: colors.text,
                                    },
                                    status === 'saving' && styles.boxSaving,
                                    status === 'saved' && styles.boxSaved,
                                    status === 'error' && styles.boxError,
                                  ]}
                                  defaultValue={esVal}
                                  placeholder="-"
                                  placeholderTextColor={colors.muted}
                                  keyboardType="numeric"
                                  maxLength={5}
                                  onEndEditing={(e) =>
                                    handleScoreBoxChange(item.id, 'examset', es.id, undefined, e.nativeEvent.text)
                                  }
                                />
                              </View>
                            );
                          }
                        })
                      ) : hasPapers ? (
                        papers.map((paper) => {
                          const cellKey = `${item.id}_paper__${paper.id}`;
                          const status = cellStatus[cellKey];
                          const maxM = paper.max || 100;
                          const pMap = item.paperMarks && item.paperMarks[paper.id];
                          const pVal = pMap && pMap['default'] !== undefined ? String(pMap['default']) : '';

                          return (
                            <View key={`paper-${paper.id}`} style={styles.scoreInputItem}>
                              <View style={styles.scoreInputHeader}>
                                <Text style={[styles.scoreLabel, { color: colors.subtext }]}>P{paper.number}</Text>
                                <Text style={[styles.scoreMax, { color: colors.muted }]}>/{maxM}</Text>
                              </View>
                              <TextInput
                                style={[
                                  styles.mobileScoreBox,
                                  {
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.border,
                                    color: colors.text,
                                  },
                                  status === 'saving' && styles.boxSaving,
                                  status === 'saved' && styles.boxSaved,
                                  status === 'error' && styles.boxError,
                                ]}
                                defaultValue={pVal}
                                placeholder="-"
                                placeholderTextColor={colors.muted}
                                keyboardType="numeric"
                                maxLength={5}
                                onEndEditing={(e) =>
                                  handleScoreBoxChange(item.id, 'paper', undefined, paper.id, e.nativeEvent.text)
                                }
                              />
                            </View>
                          );
                        })
                      ) : (
                        <View style={styles.scoreInputItem}>
                          <View style={styles.scoreInputHeader}>
                            <Text style={[styles.scoreLabel, { color: colors.subtext }]}>MARK</Text>
                            <Text style={[styles.scoreMax, { color: colors.muted }]}>/100</Text>
                          </View>
                          <TextInput
                            style={[
                              styles.mobileScoreBox,
                              {
                                backgroundColor: colors.inputBg,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                              cellStatus[`${item.id}_mark100__`] === 'saving' && styles.boxSaving,
                              cellStatus[`${item.id}_mark100__`] === 'saved' && styles.boxSaved,
                              cellStatus[`${item.id}_mark100__`] === 'error' && styles.boxError,
                            ]}
                            defaultValue={item.currentScore ? String(item.currentScore) : ''}
                            placeholder="-"
                            placeholderTextColor={colors.muted}
                            keyboardType="numeric"
                            maxLength={5}
                            onEndEditing={(e) =>
                              handleScoreBoxChange(item.id, 'mark100', undefined, undefined, e.nativeEvent.text)
                            }
                          />
                        </View>
                      )
                    ) : (
                      /* O-Level Exam sets + Out of 80 */
                      <>
                        {hasExamSets ? (
                          <>
                            {filteredExamSets.map((es) => {
                              const cellKey = `${item.id}_examset_${es.id}_`;
                              const status = cellStatus[cellKey];
                              const maxM = es.max || 100;
                              const esVal = item.examsetMarks ? String(item.examsetMarks[es.id] ?? '') : '';

                              return (
                                <View key={`es-${es.id}`} style={styles.scoreInputItem}>
                                  <View style={styles.scoreInputHeader}>
                                    <Text style={[styles.scoreLabel, { color: colors.subtext }]}>
                                      {String(es.short_name).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.scoreMax, { color: colors.muted }]}>/{maxM}</Text>
                                  </View>
                                  <TextInput
                                    style={[
                                      styles.mobileScoreBox,
                                      {
                                        backgroundColor: colors.inputBg,
                                        borderColor: colors.border,
                                        color: colors.text,
                                      },
                                      status === 'saving' && styles.boxSaving,
                                      status === 'saved' && styles.boxSaved,
                                      status === 'error' && styles.boxError,
                                    ]}
                                    defaultValue={esVal}
                                    placeholder="-"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="numeric"
                                    maxLength={5}
                                    onEndEditing={(e) =>
                                      handleScoreBoxChange(item.id, 'examset', es.id, undefined, e.nativeEvent.text)
                                    }
                                  />
                                </View>
                              );
                            })}

                            {/* Out of 80 Computed Badge */}
                            <View style={styles.scoreInputItem}>
                              <View style={styles.scoreInputHeader}>
                                <Text style={[styles.scoreLabel, { color: '#059669' }]}>OUT / 80</Text>
                                <Text style={[styles.scoreMax, { color: '#059669', fontWeight: '700' }]}>AUTO</Text>
                              </View>
                              <View style={styles.out80ComputedBadge}>
                                <Text style={styles.out80ComputedText}>
                                  {item.out80 !== undefined && item.out80 !== null && item.out80 !== ''
                                    ? String(item.out80)
                                    : '-'}
                                </Text>
                              </View>
                            </View>
                          </>
                        ) : (
                          <View style={styles.scoreInputItem}>
                            <View style={styles.scoreInputHeader}>
                              <Text style={[styles.scoreLabel, { color: colors.subtext }]}>OUT / 80</Text>
                              <Text style={[styles.scoreMax, { color: colors.muted }]}>/80</Text>
                            </View>
                            <TextInput
                              style={[
                                styles.mobileScoreBox,
                                {
                                  backgroundColor: colors.inputBg,
                                  borderColor: colors.border,
                                  color: colors.text,
                                },
                                cellStatus[`${item.id}_out80__`] === 'saving' && styles.boxSaving,
                                cellStatus[`${item.id}_out80__`] === 'saved' && styles.boxSaved,
                                cellStatus[`${item.id}_out80__`] === 'error' && styles.boxError,
                              ]}
                              defaultValue={item.out80 ? String(item.out80) : ''}
                              placeholder="-"
                              placeholderTextColor={colors.muted}
                              keyboardType="numeric"
                              maxLength={5}
                              onEndEditing={(e) =>
                                handleScoreBoxChange(item.id, 'out80', undefined, undefined, e.nativeEvent.text)
                              }
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              students.length > 0 ? (
                <View style={styles.listFooterSaveWrap}>
                  <TouchableOpacity
                    style={[styles.btnSaveMarks, { backgroundColor: colors.primary }]}
                    onPress={handleSaveAllMarks}
                    disabled={savingAll}
                    activeOpacity={0.85}
                  >
                    {savingAll ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={styles.saveBtnContent}>
                        <Ionicons name="save-outline" size={18} color="#ffffff" />
                        <Text style={styles.btnSaveMarksText}>Save All Subject Marks</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : undefined
            }
          />
        </View>
      )}

      {/* =====================================================
          FLOATING SAVE TOAST FEEDBACK (#mobileSaveToast from app.blade.php)
          ===================================================== */}
      {saveToast.status !== 'idle' && (
        <View
          style={[
            styles.floatingSaveToast,
            saveToast.status === 'saving' && { backgroundColor: '#2563eb' },
            saveToast.status === 'saved' && { backgroundColor: '#059669' },
            saveToast.status === 'error' && { backgroundColor: '#dc2626' },
          ]}
        >
          <Ionicons
            name={
              saveToast.status === 'saved'
                ? 'checkmark-circle'
                : saveToast.status === 'error'
                ? 'alert-circle'
                : 'sync'
            }
            size={16}
            color="#ffffff"
          />
          <Text style={styles.floatingToastText}>{saveToast.message}</Text>
        </View>
      )}

      {/* =====================================================
          1. CLASS SELECTOR MODAL
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>1. Select Class</Text>
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
                    style={[styles.modalOption, isSelected && { backgroundColor: colors.primaryLight }]}
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
          2. SUBJECT SELECTOR MODAL
          ===================================================== */}
      <Modal
        visible={isSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSubjectModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSubjectModalVisible(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>2. Select Subject</Text>
              <TouchableOpacity onPress={() => setIsSubjectModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {classSubjects.map((sub) => {
                const isSelected = String(selectedSubjectId) === String(sub.id);
                return (
                  <TouchableOpacity
                    key={`modal-sub-${sub.id}`}
                    style={[styles.modalOption, isSelected && { backgroundColor: colors.primaryLight }]}
                    onPress={() => {
                      setSelectedSubjectId(sub.id);
                      setIsSubjectModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? { color: colors.primary, fontWeight: '700' } : { color: colors.text },
                      ]}
                    >
                      {sub.name}
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
          3. STREAM SELECTOR MODAL
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>3. Select Stream</Text>
              <TouchableOpacity onPress={() => setIsStreamModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[styles.modalOption, selectedStreamId === null && { backgroundColor: colors.primaryLight }]}
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
                    style={[styles.modalOption, isSelected && { backgroundColor: colors.primaryLight }]}
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

      {/* =====================================================
          4. TERM SELECTOR MODAL
          ===================================================== */}
      <Modal
        visible={isTermModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTermModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsTermModalVisible(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>4. Academic Term</Text>
              <TouchableOpacity onPress={() => setIsTermModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {terms.map((t) => {
                const isSelected = String(selectedTermId) === String(t.id);
                return (
                  <TouchableOpacity
                    key={`modal-term-${t.id}`}
                    style={[styles.modalOption, isSelected && { backgroundColor: colors.primaryLight }]}
                    onPress={() => {
                      setSelectedTermId(t.id);
                      setIsTermModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? { color: colors.primary, fontWeight: '700' } : { color: colors.text },
                      ]}
                    >
                      {t.name} ({t.academic_year || ''})
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
  /* Top Filter Card (.m-card from app.blade.php) */
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

  /* Empty placeholder */
  emptyPlaceholder: {
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  placeholderSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
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

  /* Marksheet Sheet Container (.marks-sheet-container from app.blade.php) */
  marksSheetContainer: {
    flex: 1,
  },
  marksSheetHeader: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    gap: 10,
  },
  sheetHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  marksSheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marksSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  marksSheetSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  searchBox: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },

  /* Learner Card (.assessment-student-card from app.blade.php) */
  assessmentStudentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  studentCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  studentAvatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  studentCardName: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  studentCardMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  cardIndexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  cardIndexText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* Scores Grid (.assessment-card-scores-grid) */
  assessmentScoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  scoreInputItem: {
    flex: 1,
    minWidth: 70,
    maxWidth: 120,
  },
  scoreInputHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scoreMax: {
    fontSize: 10,
    fontWeight: '600',
  },
  mobileScoreBox: {
    width: '100%',
    height: 46,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1.5,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
  },
  boxSaving: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  boxSaved: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
    color: '#047857',
  },
  boxError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
  },
  out80ComputedBadge: {
    width: '100%',
    height: 46,
    minHeight: 46,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  out80ComputedText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
  },

  /* Save Button at the end of the roster */
  listFooterSaveWrap: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  btnSaveMarks: {
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
  btnSaveMarksText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Floating Save Toast (.mobile-save-toast from app.blade.php) */
  floatingSaveToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 82,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 9999,
  },
  floatingToastText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
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
