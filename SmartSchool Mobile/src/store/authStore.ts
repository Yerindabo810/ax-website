import { create } from 'zustand';
import { User, School, SchoolClass, ClassSubject, Term, TimetableSlot, Announcement } from '../types';

export interface TodayClassAttendance {
  class_id: number;
  class_name: string;
  streams_label?: string;
  rate: number;
  present: number;
  late: number;
  absent: number;
  total: number;
  last_taken_at: string;
  recorded_by?: string;
}

export interface ClassEnrollmentItem {
  id: number;
  name: string;
  male: number;
  female: number;
  total: number;
}

export interface AuthState {
  user: User | null;
  school: School | null;
  tenantSlug: string;
  apiBaseUrl: string;
  isAuthenticated: boolean;
  isDarkMode: boolean;
  isLoading: boolean;
  unreadCount: number;

  // Real School Context Data from Backend
  schoolClasses: any[];
  assignedSubjects: any[];
  terms: any[];
  activeTerm: any | null;
  isPrimary: boolean;
  learnerLabel: string;
  learnersLabel: string;
  isAdmin: boolean;

  // Real Dashboard Stats & Attendance Summary
  totalStudents: number;
  totalMale: number;
  totalFemale: number;
  totalDay: number;
  totalBoarding: number;
  totalClassesCount: number;
  totalStreamsCount: number;
  totalSubjectsCount: number;
  totalStaffCount: number;
  totalMarksRecorded: number;
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  todayTotal: number;
  todayClassesCount: number;
  todayAttendanceByClass: TodayClassAttendance[];
  classBreakdown: ClassEnrollmentItem[];
  timetableSlots: TimetableSlot[];
  announcements: Announcement[];

  setSchool: (school: School | null) => void;
  setUser: (user: User | null) => void;
  setTenantSlug: (slug: string) => void;
  setApiBaseUrl: (url: string) => void;
  toggleDarkMode: () => void;
  setUnreadCount: (count: number) => void;
  setSchoolContext: (context: Partial<AuthState>) => void;
  logout: () => void;
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  school: null,
  tenantSlug: '',
  apiBaseUrl: 'https://school.axtechnologies.net',
  isAuthenticated: false,
  isDarkMode: false,
  isLoading: false,
  unreadCount: 0,

  schoolClasses: [],
  assignedSubjects: [],
  terms: [],
  activeTerm: null,
  isPrimary: false,
  learnerLabel: 'Student',
  learnersLabel: 'Students',
  isAdmin: false,

  totalStudents: 0,
  totalMale: 0,
  totalFemale: 0,
  totalDay: 0,
  totalBoarding: 0,
  totalClassesCount: 0,
  totalStreamsCount: 0,
  totalSubjectsCount: 0,
  totalStaffCount: 0,
  totalMarksRecorded: 0,
  todayPresent: 0,
  todayAbsent: 0,
  todayLate: 0,
  todayTotal: 0,
  todayClassesCount: 0,
  todayAttendanceByClass: [],
  classBreakdown: [],
  timetableSlots: [],
  announcements: [],

  setSchool: (school) => set({ school, tenantSlug: school?.slug || '' }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTenantSlug: (slug) => set({ tenantSlug: slug }),
  setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setSchoolContext: (context) => set((state) => ({ ...state, ...context })),
  logout: () =>
    set({
      user: null,
      school: null,
      tenantSlug: '',
      isAuthenticated: false,
      schoolClasses: [],
      assignedSubjects: [],
      terms: [],
      activeTerm: null,
      todayAttendanceByClass: [],
      classBreakdown: [],
      timetableSlots: [],
      announcements: [],
    }),
  resetAuth: () =>
    set({
      user: null,
      school: null,
      tenantSlug: '',
      isAuthenticated: false,
      schoolClasses: [],
      assignedSubjects: [],
      terms: [],
      activeTerm: null,
      todayAttendanceByClass: [],
      classBreakdown: [],
      timetableSlots: [],
      announcements: [],
    }),
}));
