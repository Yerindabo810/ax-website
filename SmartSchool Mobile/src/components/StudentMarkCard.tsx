import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Student } from '../types';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';

interface StudentMarkCardProps {
  student: Student;
  index: number;
  mode: 'competency' | 'exam';
  competencyCode?: string; // e.g. 'A1', 'A2', 'A3'
  examPaperId?: number | string;
  initialScore?: number | string;
  onSaveMark: (studentId: number, score: number | string) => Promise<boolean>;
}

export const StudentMarkCard: React.FC<StudentMarkCardProps> = ({
  student,
  index,
  mode,
  competencyCode = 'A1',
  initialScore,
  onSaveMark,
}) => {
  const { isDarkMode } = useAuthStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [currentScore, setCurrentScore] = useState<string>(
    initialScore !== undefined && initialScore !== null ? String(initialScore) : ''
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    setCurrentScore(initialScore !== undefined && initialScore !== null ? String(initialScore) : '');
  }, [initialScore]);

  const handleCompetencySelect = async (val: number) => {
    const newScore = currentScore === String(val) ? '' : String(val);
    setCurrentScore(newScore);
    setSaveStatus('saving');
    const success = await onSaveMark(student.id, newScore);
    setSaveStatus(success ? 'saved' : 'error');
    if (success) {
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleExamScoreChange = (text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    setCurrentScore(cleanText);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('saving');
    debounceTimerRef.current = setTimeout(async () => {
      const success = await onSaveMark(student.id, cleanText);
      setSaveStatus(success ? 'saved' : 'error');
      if (success) {
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 750);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top Header: Avatar, Name, LIN, Index */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <View style={styles.leftInfo}>
          <View style={[styles.avatarBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {student.surname ? student.surname.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
              {student.fullName ? student.fullName.toUpperCase() : `${student.surname} ${student.lastname}`}
            </Text>
            <Text style={[styles.studentMeta, { color: colors.muted }]}>
              {student.lin} {student.streamName ? `• ${student.streamName}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {saveStatus === 'saving' && (
            <View style={[styles.statusBadge, { backgroundColor: '#e0f2fe' }]}>
              <Text style={[styles.statusText, { color: '#0369a1' }]}>Saving...</Text>
            </View>
          )}
          {saveStatus === 'saved' && (
            <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.statusText, { color: '#15803d' }]}>✓ Saved</Text>
            </View>
          )}
          {saveStatus === 'error' && (
            <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: '#b91c1c' }]}>Failed</Text>
            </View>
          )}

          <View style={[styles.indexPill, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.indexText, { color: colors.subtext }]}>#{index + 1}</Text>
          </View>
        </View>
      </View>

      {/* Score Input Row */}
      <View style={styles.scoreRow}>
        {mode === 'competency' ? (
          <View style={styles.competencyContainer}>
            <Text style={[styles.scoreLabel, { color: colors.muted }]}>
              Score for <Text style={{ fontWeight: '700', color: colors.primary }}>{competencyCode}</Text> (Max: 3):
            </Text>
            <View style={styles.scoreBtnGroup}>
              {[1, 2, 3].map((val) => {
                const isSelected = currentScore === String(val);
                return (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.competencyBtn,
                      isSelected
                        ? { backgroundColor: colors.primary, borderColor: colors.primaryHover }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border },
                    ]}
                    onPress={() => handleCompetencySelect(val)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.competencyBtnText,
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
        ) : (
          <View style={styles.examContainer}>
            <Text style={[styles.scoreLabel, { color: colors.muted }]}>Exam Marks (/100):</Text>
            <View style={styles.examInputWrapper}>
              <TextInput
                style={[
                  styles.examInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: currentScore ? colors.primary : colors.border,
                    color: colors.text,
                  },
                ]}
                value={currentScore}
                onChangeText={handleExamScoreChange}
                placeholder="0 - 100"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={5}
              />
              <Text style={[styles.maxScoreLabel, { color: colors.muted }]}>/ 100</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    letterSpacing: 0.2,
  },
  studentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  indexPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scoreRow: {
    marginTop: 10,
  },
  competencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreBtnGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  competencyBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competencyBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  examContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  examInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  examInput: {
    width: 80,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  maxScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
