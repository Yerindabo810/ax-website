import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { lightColors, darkColors } from '../theme/colors';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { apiRequest } from '../api/client';
import { Announcement } from '../types';

interface HomeScreenProps {
  onNavigateTab: (tab: 'home' | 'attendance' | 'marks' | 'timetable' | 'settings', params?: any) => void;
  onOpenNotifications: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenNotifications,
}) => {
  const {
    user,
    tenantSlug,
    isDarkMode,
    isPrimary,
    learnerLabel,
    learnersLabel,
    isAdmin,
    totalStudents,
    totalMale,
    totalFemale,
    totalDay,
    totalBoarding,
    totalClassesCount,
    totalStreamsCount,
    totalSubjectsCount,
    totalStaffCount,
    totalMarksRecorded,
    todayPresent,
    todayAbsent,
    todayLate,
    todayClassesCount,
    todayAttendanceByClass,
    classBreakdown,
    announcements,
    setSchoolContext,
  } = useAuthStore();

  const colors = isDarkMode ? darkColors : lightColors;

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [lastSyncText, setLastSyncText] = useState<string>('Live • 5s sync');

  // Load full school context from mobile endpoint
  const loadFullSchoolData = async () => {
    if (!tenantSlug) return;
    try {
      const data = await apiRequest(`/${tenantSlug}/mobile?format=json`);
      if (data && data.success) {
        setSchoolContext({
          schoolClasses: data.classes || [],
          assignedSubjects: data.assigned_subjects || [],
          terms: data.terms || [],
          activeTerm: data.active_term || null,
          isPrimary: !!data.is_primary,
          learnerLabel: data.learner_label || 'Student',
          learnersLabel: data.learners_label || 'Students',
          isAdmin: !!data.is_admin,
          totalStudents: data.total_students ?? totalStudents,
          totalMale: data.total_male ?? totalMale,
          totalFemale: data.total_female ?? totalFemale,
          totalDay: data.total_day ?? totalDay,
          totalBoarding: data.total_boarding ?? totalBoarding,
          totalClassesCount: data.total_classes_count ?? totalClassesCount,
          totalStreamsCount: data.total_streams_count ?? totalStreamsCount,
          totalSubjectsCount: data.total_subjects_count ?? totalSubjectsCount,
          totalStaffCount: data.total_staff_count ?? totalStaffCount,
          totalMarksRecorded: data.total_marks_recorded ?? totalMarksRecorded,
          todayPresent: data.today_present ?? 0,
          todayAbsent: data.today_absent ?? 0,
          todayLate: data.today_late ?? 0,
          todayTotal: data.today_total ?? 0,
          todayClassesCount: data.today_classes_count ?? 0,
          todayAttendanceByClass: data.today_attendance_by_class || [],
          classBreakdown: data.class_breakdown || [],
          timetableSlots: data.timetable_slots || [],
          unreadCount: data.unread_count ?? 0,
        });
      }
    } catch {
      // Quiet background polling
    }
  };

  // Poll live dashboard stats (matches 5-second live refresh from app.blade.php)
  const fetchLiveStats = async () => {
    if (!tenantSlug) return;
    try {
      const data = await apiRequest(`/${tenantSlug}/mobile/dashboard/stats`);
      if (data && data.success) {
        if (data.refreshed_at) {
          setLastSyncText(`Synced ${data.refreshed_at}`);
        }
        setSchoolContext({
          totalStudents: data.total_students ?? totalStudents,
          totalMale: data.total_male ?? totalMale,
          totalFemale: data.total_female ?? totalFemale,
          totalDay: data.total_day ?? totalDay,
          totalBoarding: data.total_boarding ?? totalBoarding,
          totalClassesCount: data.total_classes_count ?? totalClassesCount,
          totalStreamsCount: data.total_streams_count ?? totalStreamsCount,
          totalSubjectsCount: data.total_subjects_count ?? totalSubjectsCount,
          totalStaffCount: data.total_staff_count ?? totalStaffCount,
          totalMarksRecorded: data.total_marks_recorded ?? totalMarksRecorded,
          todayPresent: data.today_present ?? 0,
          todayAbsent: data.today_absent ?? 0,
          todayLate: data.today_late ?? 0,
          todayTotal: data.today_total ?? 0,
          todayClassesCount: data.today_classes_count ?? 0,
          todayAttendanceByClass: data.today_attendance_by_class || [],
          unreadCount: data.unread_notifications_count ?? 0,
          announcements: (data.notifications || []).map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content || n.message,
            author: n.author || 'School Administration',
            date: n.date || 'Today',
            isRead: !!n.is_read,
          })),
        });
      }
    } catch {
      // Quiet background polling
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFullSchoolData();
    fetchLiveStats();
    // Live 5s auto-refresh (matches exact 5-second timer in app.blade.php line 3895)
    const interval = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(interval);
  }, [tenantSlug]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFullSchoolData(), fetchLiveStats()]);
    setRefreshing(false);
  };

  // Format today's date
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Welcome Banner (matches welcome-banner in app.blade.php) */}
      <View style={[styles.welcomeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.welcomeGreeting, { color: colors.muted }]}>Welcome back,</Text>
        <Text style={[styles.welcomeName, { color: colors.text }]} numberOfLines={1}>
          {user?.name ? user.name.toUpperCase() : 'STAFF MEMBER'}
        </Text>
        <View style={styles.welcomePills}>
          <View style={[styles.welcomePill, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
            <Text style={[styles.welcomePillText, { color: colors.primary }]}>
              {isAdmin ? 'Staff / Administrator' : 'Teaching Staff'}
            </Text>
          </View>
          <View style={[styles.welcomePill, { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="calendar-outline" size={12} color={colors.subtext} />
            <Text style={[styles.welcomePillText, { color: colors.subtext }]}>{todayFormatted}</Text>
          </View>
        </View>
      </View>

      {/* 2. Main System Dashboard KPI Cards (4 Cards Synced with HomeController) */}
      <View style={styles.kpiGrid}>
        {/* Card 1: Total Learners + Gender & Residence */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#2563eb' }]}>
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>TOTAL {learnersLabel.toUpperCase()}</Text>
            <Ionicons name="school" size={16} color="#2563eb" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{totalStudents.toLocaleString()}</Text>
          <View style={styles.kpiSubPills}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#2563eb' }]}>M: {totalMale.toLocaleString()}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(219, 39, 119, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#db2777' }]}>F: {totalFemale.toLocaleString()}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.badgeText, { color: colors.subtext }]}>
                Day: {totalDay.toLocaleString()} • Brd: {totalBoarding.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 2: Classes & Streams */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#059669' }]}>
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>CLASSES & STREAMS</Text>
            <Ionicons name="layers" size={16} color="#059669" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {totalClassesCount.toLocaleString()}{' '}
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>Classes</Text>
          </Text>
          <View style={styles.kpiSubPills}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#059669' }]}>{totalStreamsCount} Active Streams</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.badgeText, { color: colors.subtext }]}>{totalStaffCount} Staff</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Marks Recorded */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#7c3aed' }]}>
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>MARKS RECORDED</Text>
            <Ionicons name="stats-chart" size={16} color="#7c3aed" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{totalMarksRecorded.toLocaleString()}</Text>
          <View style={styles.kpiSubPills}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#7c3aed' }]}>{totalSubjectsCount} Curriculum Subjects</Text>
            </View>
          </View>
        </View>

        {/* Card 4: Today's Roll Call Attendance */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#0d9488' }]}>
          <View style={styles.kpiHeaderRow}>
            <Text style={[styles.kpiLabel, { color: colors.muted }]}>TODAY'S ATTENDANCE</Text>
            <Ionicons name="clipboard" size={16} color="#0d9488" />
          </View>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
            {todayPresent.toLocaleString()}{' '}
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>Present</Text>
          </Text>
          <View style={styles.kpiSubPills}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(220, 38, 38, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#dc2626' }]}>Absent: {todayAbsent}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(217, 119, 6, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#d97706' }]}>Late: {todayLate}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(13, 148, 136, 0.12)' }]}>
              <Text style={[styles.badgeText, { color: '#0d9488' }]}>
                {todayClassesCount} {todayClassesCount === 1 ? 'Class' : 'Classes'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Today's Attendance Taken by Class (Current Day • 5-Second Live Sync) */}
      <View style={styles.sectionTitleRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="checkmark-done-circle" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Attendance by Class</Text>
        </View>
        <View style={styles.liveSyncBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.liveSyncText}>{lastSyncText}</Text>
        </View>
      </View>

      <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
        {isAdmin
          ? 'Admin View: Showing all classes where attendance was taken today'
          : 'Showing only classes where you have taken attendance today'}
      </Text>

      <View style={styles.attendanceClassList}>
        {todayAttendanceByClass && todayAttendanceByClass.length > 0 ? (
          todayAttendanceByClass.map((attCls) => {
            const rateColor = attCls.rate >= 75 ? '#059669' : attCls.rate >= 50 ? '#d97706' : '#dc2626';
            return (
              <TouchableOpacity
                key={attCls.class_id}
                style={[styles.attClassCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onNavigateTab('attendance', { classId: attCls.class_id })}
                activeOpacity={0.8}
              >
                <View style={styles.attClassHeader}>
                  <View style={styles.classNameWrap}>
                    <Text style={[styles.attClassName, { color: colors.text }]}>{attCls.class_name}</Text>
                    {attCls.streams_label && (
                      <View style={[styles.streamLabelPill, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.streamLabelText, { color: colors.primary }]}>
                          Stream {attCls.streams_label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.ratePill, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.rateText, { color: rateColor }]}>{attCls.rate}% Present</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBarTrack, { backgroundColor: colors.inputBg }]}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, attCls.rate)}%` }]} />
                </View>

                {/* Breakdown Row */}
                <View style={styles.attStatsRow}>
                  <View style={styles.attBadgesGroup}>
                    <View style={[styles.badgePill, { backgroundColor: 'rgba(22, 163, 74, 0.12)' }]}>
                      <Text style={[styles.badgeText, { color: '#16a34a' }]}>✓ Present: {attCls.present}</Text>
                    </View>
                    {attCls.late > 0 && (
                      <View style={[styles.badgePill, { backgroundColor: 'rgba(217, 119, 6, 0.12)' }]}>
                        <Text style={[styles.badgeText, { color: '#d97706' }]}>◷ Late: {attCls.late}</Text>
                      </View>
                    )}
                    <View style={[styles.badgePill, { backgroundColor: 'rgba(220, 38, 38, 0.12)' }]}>
                      <Text style={[styles.badgeText, { color: '#dc2626' }]}>✕ Absent: {attCls.absent}</Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: colors.inputBg }]}>
                      <Text style={[styles.badgeText, { color: colors.subtext }]}>Total: {attCls.total}</Text>
                    </View>
                  </View>

                  <Text style={[styles.attTimeText, { color: colors.muted }]}>
                    {attCls.last_taken_at} {attCls.recorded_by ? `• ${attCls.recorded_by}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="clipboard-outline" size={32} color={colors.muted} />
            <Text style={[styles.emptyCardText, { color: colors.muted }]}>
              {isAdmin
                ? `No class attendance has been recorded today (${todayFormatted}) yet.`
                : `You have not taken attendance in any class today (${todayFormatted}) yet.`}
            </Text>
          </View>
        )}
      </View>

      {/* 4. Class Enrollment Breakdown (Tap class to enter marks) */}
      {classBreakdown && classBreakdown.length > 0 && (
        <View style={styles.enrollmentSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{learnersLabel} Enrollment by Class</Text>
            <Text style={[styles.tapHint, { color: colors.primary }]}>Tap class to enter marks</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.enrollmentScroll}>
            {classBreakdown.map((cb) => (
              <TouchableOpacity
                key={cb.id}
                style={[styles.enrollmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onNavigateTab('marks', { classId: cb.id })}
                activeOpacity={0.8}
              >
                <Text style={[styles.enrollmentClassName, { color: colors.text }]} numberOfLines={1}>
                  {cb.name}
                </Text>
                <Text style={[styles.enrollmentTotal, { color: colors.primary }]}>
                  {cb.total.toLocaleString()}{' '}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>{learnersLabel}</Text>
                </Text>
                <Text style={[styles.enrollmentMeta, { color: colors.subtext }]}>
                  M: {cb.male} • F: {cb.female}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 5. Quick Classroom Actions */}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Classroom Actions</Text>
      </View>
      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigateTab('attendance')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIconWrap, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="clipboard-outline" size={22} color="#16a34a" />
          </View>
          <View>
            <Text style={[styles.quickTitle, { color: colors.text }]}>Take Attendance</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>60-min edit window</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigateTab('marks')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIconWrap, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="create-outline" size={22} color="#2563eb" />
          </View>
          <View>
            <Text style={[styles.quickTitle, { color: colors.text }]}>Record Marks</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>
              {isPrimary ? 'Enter exam & assessment scores' : 'Enter exam & AoI scores'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onNavigateTab('timetable')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIconWrap, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="calendar-outline" size={22} color="#d97706" />
          </View>
          <View>
            <Text style={[styles.quickTitle, { color: colors.text }]}>My Timetable</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>View & add lessons</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={onOpenNotifications}
          activeOpacity={0.8}
        >
          <View style={[styles.quickIconWrap, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="megaphone-outline" size={22} color="#7c3aed" />
          </View>
          <View>
            <Text style={[styles.quickTitle, { color: colors.text }]}>Announcements</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>{announcements.length} school notices</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 6. Recent School Announcements */}
      <View style={[styles.sectionTitleRow, { marginTop: 18 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent School Announcements</Text>
        <TouchableOpacity onPress={onOpenNotifications}>
          <Text style={[styles.viewAllBtn, { color: colors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.announcementsList}>
        {announcements && announcements.length > 0 ? (
          announcements.slice(0, 3).map((notice) => (
            <TouchableOpacity
              key={notice.id}
              style={[
                styles.noticeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: colors.primary,
                },
              ]}
              onPress={() => setSelectedAnnouncement(notice)}
              activeOpacity={0.8}
            >
              <View style={styles.noticeHeader}>
                <Text style={[styles.noticeTitle, { color: colors.text }]} numberOfLines={1}>
                  {notice.title}
                </Text>
                <Text style={[styles.noticeDate, { color: colors.muted }]}>{notice.date}</Text>
              </View>
              <Text style={[styles.noticeSnippet, { color: colors.subtext }]} numberOfLines={2}>
                {notice.content}
              </Text>
              <View style={styles.noticeFooter}>
                <Text style={[styles.noticeReadHint, { color: colors.primary }]}>
                  Tap to read full announcement
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.muted} />
            <Text style={[styles.emptyCardText, { color: colors.muted }]}>
              No recent announcements posted for this term yet.
            </Text>
          </View>
        )}
      </View>

      {/* Announcement Modal Popup */}
      <AnnouncementModal
        announcement={selectedAnnouncement}
        visible={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 90,
  },
  welcomeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  welcomeGreeting: {
    fontSize: 12,
    fontWeight: '600',
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  welcomePills: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  welcomePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  kpiSubPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginBottom: 8,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveSyncText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  attendanceClassList: {
    marginBottom: 10,
  },
  attClassCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#0d9488',
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  attClassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  classNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attClassName: {
    fontSize: 13,
    fontWeight: '800',
  },
  streamLabelPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streamLabelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ratePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rateText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0d9488',
    borderRadius: 3,
  },
  attStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  attBadgesGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  attTimeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  enrollmentSection: {
    marginBottom: 10,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  enrollmentScroll: {
    flexDirection: 'row',
    marginTop: 6,
  },
  enrollmentCard: {
    minWidth: 130,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginRight: 8,
  },
  enrollmentClassName: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  enrollmentTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  enrollmentMeta: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  quickCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickSub: {
    fontSize: 10,
    marginTop: 2,
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: '700',
  },
  announcementsList: {
    marginTop: 4,
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  noticeDate: {
    fontSize: 10,
  },
  noticeSnippet: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  noticeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noticeReadHint: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
