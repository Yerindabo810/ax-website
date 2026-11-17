export interface School {
  id: number | string;
  name: string;
  slug: string;
  logoUrl?: string;
  motto?: string;
  domain?: string;
}

export interface User {
  id: number;
  name: string;
  surname: string;
  lastname?: string;
  email: string;
  phone?: string;
  role: string; // 'teacher' | 'dos' | 'admin' | 'headteacher'
  avatar?: string;
  school?: School;
}

export interface DashboardStats {
  totalStudents: number;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceRate: number;
  staffOnDuty: number;
  lessonsToday: number;
  activeLessonsCount: number;
  unreadNotifications: number;
}

export interface Student {
  id: number;
  lin: string;
  peasNumber?: string;
  surname: string;
  lastname: string;
  fullName: string;
  gender: 'M' | 'F' | string;
  streamId?: number;
  streamName?: string;
  classId?: number;
  className?: string;
  attendanceStatus?: 'present' | 'absent' | 'late' | null;
  marks?: Record<string, string | number>;
}

export interface ClassSubject {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  isPrimaryOrNursery?: boolean;
  isAlevel?: boolean;
  competencies?: Competency[];
  papers?: Paper[];
  examSets?: ExamSet[];
}

export interface Competency {
  id: number;
  title: string;
  code: string;
  maxScore: number;
}

export interface Paper {
  id: number;
  number: number;
  name: string;
  maxScore: number;
}

export interface ExamSet {
  id: number;
  name: string;
  shortName: string;
  passMark: number;
}

export interface TimetableSlot {
  id: number;
  day: string; // 'Monday' | 'Tuesday' etc.
  startTime: string; // '08:00'
  endTime: string;   // '08:40'
  subjectName: string;
  className: string;
  streamName: string;
  roomName: string;
  teacherName: string;
  isLive?: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  date: string;
  isRead: boolean;
  attachmentUrl?: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  levelName?: string;
  streams?: Stream[];
}

export interface Stream {
  id: number;
  name: string;
  classId: number;
}

export interface Term {
  id: number;
  name: string;
  year: string | number;
  isCurrent?: boolean;
}
