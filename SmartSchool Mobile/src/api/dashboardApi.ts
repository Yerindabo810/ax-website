import { apiRequest } from './client';
import { DashboardStats, Announcement } from '../types';

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    try {
      const res = await apiRequest('/mobile/dashboard/stats');
      return {
        totalStudents: res.total_students || 450,
        attendancePresent: res.attendance_present || 418,
        attendanceAbsent: res.attendance_absent || 32,
        attendanceRate: res.attendance_rate || 93,
        staffOnDuty: res.staff_count || 28,
        lessonsToday: res.lessons_today || 14,
        activeLessonsCount: res.active_lessons || 3,
        unreadNotifications: res.unread_notifications || 2,
      };
    } catch {
      // Fallback preview data when running offline
      return {
        totalStudents: 450,
        attendancePresent: 418,
        attendanceAbsent: 32,
        attendanceRate: 93,
        staffOnDuty: 28,
        lessonsToday: 14,
        activeLessonsCount: 3,
        unreadNotifications: 2,
      };
    }
  },

  getAnnouncements: async (): Promise<Announcement[]> => {
    try {
      const res = await apiRequest('/mobile/notifications/poll');
      return (res.announcements || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        content: a.content || a.message,
        author: a.author || 'Headteacher',
        date: a.date || 'Today',
        isRead: !!a.is_read,
        attachmentUrl: a.attachment_url,
      }));
    } catch {
      return [
        {
          id: 1,
          title: 'Term III Assessment Mark Entry Closes Friday',
          content: 'All teachers are kindly requested to complete the entry of O-Level and A-Level assessment marks by 5:00 PM this Friday.',
          author: 'Director of Studies (DOS)',
          date: 'Nov 17, 2026',
          isRead: false,
        },
        {
          id: 2,
          title: 'Staff Meeting on End of Term Reports',
          content: 'Mandatory briefing for all academic staff at the main hall on Wednesday at 2:00 PM.',
          author: 'Headteacher Office',
          date: 'Nov 16, 2026',
          isRead: true,
        },
      ];
    }
  },

  markAnnouncementRead: async (id: number): Promise<void> => {
    try {
      await apiRequest('/mobile/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
    } catch (e) {
      console.warn('Failed to mark read', e);
    }
  },

  markAnnouncementsRead: async (): Promise<void> => {
    try {
      await apiRequest('/mobile/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      });
    } catch (e) {
      console.warn('Failed to mark all read', e);
    }
  },
};

