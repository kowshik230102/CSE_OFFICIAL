import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  CalendarCheck, 
  CalendarClock, 
  Plus, 
  PlusCircle, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowLeft, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  BookOpen, 
  Users, 
  UserMinus, 
  UserCheck, 
  Save, 
  Eye, 
  GraduationCap, 
  Layers, 
  Clock, 
  Building2, 
  FileText,
  FolderOpen,
  Briefcase,
  UserX,
  Info,
  ChevronRight,
  AlertTriangle,
  Grid,
  Printer,
  Download,
  Lock,
  Unlock,
  Sparkles,
  History,
  Send,
  Copy,
  RotateCcw,
  FlaskConical,
  HelpCircle
} from 'lucide-react';

import {
  SCHEDULE_DAYS,
  SCHEDULE_PERIODS,
  TEACHING_PERIOD_IDS,
  BREAK_PERIOD_ID,
  COMMON_ROOMS,
  getPeriodById,
  getCoveredPeriodIds,
  getSlotTimeRangeLabel,
  normalizeSlot,
  checkSlotConflict,
  validateEntireSchedule,
  getCourseScheduledHours,
  calculateWeeklyHours,
  getAvailableRoom,
  mergeAdjacentSameCourseSlots
} from '../utils/scheduleConfig';

import { exportOfficialRoutineToWord } from '../utils/routineExport';

// Routine Management Sub-Components
import { RoutineLandingHeader } from './routine/RoutineLandingHeader';
import { ClassRoutineDashboard } from './routine/ClassRoutineDashboard';
import { SemesterCourseManager } from './routine/SemesterCourseManager';
import { TeacherAssignmentModal } from './routine/TeacherAssignmentModal';
import { AutoScheduleModal } from './routine/AutoScheduleModal';
import { RoutineHistoryModal } from './routine/RoutineHistoryModal';
import { PublishSummaryModal } from './routine/PublishSummaryModal';
import { CourseFormModal } from './routine/CourseFormModal';
import { CopySemesterModal } from './routine/CopySemesterModal';
import { CourseDragPanel } from './routine/CourseDragPanel';
import { ManualScheduleModal } from './routine/ManualScheduleModal';

export function RoutineGeneratorView({ user: propUser, onBackToDashboard, onNavigateNoticeBoard }) {
  const { token: contextToken, user: contextUser } = useAuth();
  const user = contextUser || propUser;

  // Auth headers helper
  const getAuthHeaders = () => {
    const curToken = contextToken || localStorage.getItem('cse_token') || localStorage.getItem('token');
    return curToken ? { Authorization: `Bearer ${curToken}` } : {};
  };

  // Safe fetch helper
  const safeFetchJson = async (url, options = {}) => {
    const defaultHeaders = getAuthHeaders();
    const mergedHeaders = {
      ...defaultHeaders,
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });

    const contentType = res.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 120) || res.statusText}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `Request failed with HTTP status ${res.status}`);
    }

    return data;
  };

  // =========================================================================
  // TOP-LEVEL NAVIGATION STATE
  // =========================================================================
  // Category tabs: 'CLASS_ROUTINE' | 'LAB_EXAM_ROUTINE' | 'THEORY_EXAM_ROUTINE'
  const [activeCategory, setActiveCategory] = useState('CLASS_ROUTINE');

  // Class Routine Sub-views: 'DASHBOARD' | 'BUILDER'
  const [subViewMode, setSubViewMode] = useState('DASHBOARD');

  // Builder Workspace Tabs: 'TIMETABLE_GRID' | 'COURSES'
  const [workspaceTab, setWorkspaceTab] = useState('TIMETABLE_GRID');

  // =========================================================================
  // CORE ROUTINE DATA STATE
  // =========================================================================
  const [routinesList, setRoutinesList] = useState([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);

  // Active / Working Routine
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [originalRoutine, setOriginalRoutine] = useState(null); // Snapshot when opened or published
  const [loadingActiveRoutine, setLoadingActiveRoutine] = useState(false);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Academic Tree State (Sessions -> Semesters -> Courses & Students Count)
  const [academicTree, setAcademicTree] = useState([]);
  const [loadingAcademicTree, setLoadingAcademicTree] = useState(false);

  // Active Selected Semester Tab inside Routine
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(0);

  // Department Faculty Teachers List
  const [deptTeachers, setDeptTeachers] = useState([]);
  const [loadingDeptTeachers, setLoadingDeptTeachers] = useState(false);

  // =========================================================================
  // MODAL STATES
  // =========================================================================
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    academicYear: 'Session 2026-2027',
    department: 'CSE',
    effectiveFrom: new Date().toISOString().split('T')[0]
  });
  const [creatingRoutine, setCreatingRoutine] = useState(false);

  const [isAddSemesterModalOpen, setIsAddSemesterModalOpen] = useState(false);
  const [selectedSessionForAdd, setSelectedSessionForAdd] = useState('');
  const [selectedSemesterIdForAdd, setSelectedSemesterIdForAdd] = useState('');
  const [addingSemester, setAddingSemester] = useState(false);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [deleteTargetRoutine, setDeleteTargetRoutine] = useState(null);
  const [deletingRoutine, setDeletingRoutine] = useState(false);

  // New Smart Modals
  const [isAutoScheduleModalOpen, setIsAutoScheduleModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCourseFormModalOpen, setIsCourseFormModalOpen] = useState(false);
  const [editingCourseTarget, setEditingCourseTarget] = useState(null);
  const [isCopySemesterModalOpen, setIsCopySemesterModalOpen] = useState(false);

  // Teacher Assignment Modal State
  const [teacherModalState, setTeacherModalState] = useState(null);

  // Workload Modal State
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);

  // Slot Edit/Add Modal State
  const [slotModalState, setSlotModalState] = useState(null);

  // Conflict List Modal State
  const [isConflictListModalOpen, setIsConflictListModalOpen] = useState(false);

  // Unassigned Tray open/closed
  const [isUnassignedTrayOpen, setIsUnassignedTrayOpen] = useState(true);

  // Drag-and-Drop States
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);

  // Manual Schedule Modal State
  const [isManualScheduleModalOpen, setIsManualScheduleModalOpen] = useState(false);
  const [manualScheduleInitialSemId, setManualScheduleInitialSemId] = useState(null);
  const [manualScheduleInitialCourseId, setManualScheduleInitialCourseId] = useState(null);

  // Feedback Notification Toast
  const [feedback, setFeedback] = useState(null);
  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Entire Schedule Conflict List Memo
  const entireConflicts = useMemo(() => {
    if (!activeRoutine || !Array.isArray(activeRoutine.schedule)) return [];
    return validateEntireSchedule(activeRoutine.schedule);
  }, [activeRoutine?.schedule]);

  // Normalize single course object
  const normalizeCourse = (c) => {
    const credit = Number(c.creditHours || c.credit_hours || c.credit) || 3.0;
    const weekly = Number(c.weeklyHours || c.weekly_hours) || calculateWeeklyHours(c);

    let teacherObj = c.teacher;
    let status = c.assignmentStatus || 'Pending';

    if (!teacherObj || typeof teacherObj !== 'object') {
      if (c.teacherId || c.teacher_id) {
        teacherObj = {
          type: 'department',
          teacherId: c.teacherId || c.teacher_id,
          teacherName: c.teacherName || c.teacher_name || 'Faculty Member',
          designation: c.teacherDesignation || '',
          department: c.teacherDepartment || 'CSE',
          departmentNumber: '',
          shortCode: c.teacherShortCode || ''
        };
        status = 'Assigned';
      } else {
        teacherObj = {
          type: 'none',
          teacherId: null,
          teacherName: 'Not Assigned',
          designation: '',
          department: 'CSE',
          departmentNumber: '',
          shortCode: ''
        };
        status = 'Pending';
      }
    } else {
      if (!teacherObj.type) {
        teacherObj.type = teacherObj.teacherId ? 'department' : (teacherObj.teacherName && teacherObj.teacherName !== 'Not Assigned' ? 'non_department' : 'none');
      }
      if (teacherObj.type === 'none' || teacherObj.teacherName === 'Not Assigned') {
        status = 'Pending';
      } else if (teacherObj.type === 'department') {
        status = 'Assigned';
      } else if (teacherObj.type === 'non_department') {
        status = 'Non-Department';
      }
    }

    return {
      ...c,
      id: c.id || c.courseId || 'crs-' + Math.random().toString(36).substring(2, 9),
      courseId: c.courseId || c.id,
      courseCode: c.courseCode || c.course_code || '',
      courseTitle: c.courseTitle || c.course_title || '',
      creditHours: credit,
      weeklyHours: weekly,
      courseType: c.courseType || c.course_type || (c.courseTitle?.toLowerCase().includes('sessional') ? 'Sessional' : 'Theory'),
      assignmentStatus: status,
      lifecycle_status: c.lifecycle_status || 'ACTIVE',
      inRoutine: c.inRoutine !== false,
      teacher: teacherObj
    };
  };

  // =========================================================================
  // 1. INITIAL LOAD & DATA FETCHING
  // =========================================================================
  const fetchDeptTeachers = async () => {
    setLoadingDeptTeachers(true);
    try {
      const data = await safeFetchJson('/api/routines/meta/teachers');
      setDeptTeachers(data.teachers || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoadingDeptTeachers(false);
    }
  };

  const fetchAcademicTree = async () => {
    setLoadingAcademicTree(true);
    try {
      const data = await safeFetchJson('/api/routines/meta/academic-tree');
      const sessions = data.sessions || data.academicTree || [];
      setAcademicTree(sessions);
      if (sessions && sessions.length > 0) {
        setSelectedSessionForAdd(sessions[0].id);
        const firstSem = sessions[0].semesters?.[0];
        if (firstSem) setSelectedSemesterIdForAdd(firstSem.id);
      }
    } catch (err) {
      console.error('Error fetching academic tree:', err);
    } finally {
      setLoadingAcademicTree(false);
    }
  };

  const fetchRoutinesList = async () => {
    setLoadingRoutines(true);
    try {
      const data = await safeFetchJson('/api/routines');
      setRoutinesList(data.routines || []);
      return data.routines || [];
    } catch (err) {
      console.error('Error fetching routines:', err);
      showFeedback('error', 'Failed to load routines: ' + err.message);
      return [];
    } finally {
      setLoadingRoutines(false);
    }
  };

  const fetchActiveRoutine = async () => {
    setLoadingActiveRoutine(true);
    try {
      const res = await safeFetchJson('/api/routines/active');
      if (res?.routine) {
        const r = res.routine;
        const parsedData = r.routineData || {};
        const rawSemesters = Array.isArray(parsedData.semesters) ? parsedData.semesters : [];
        const normalizedSemesters = rawSemesters.map(sem => ({
          ...sem,
          courses: (sem.courses || []).map(normalizeCourse)
        }));
        const rawSchedule = Array.isArray(parsedData.schedule) ? parsedData.schedule : [];
        const normalizedSchedule = rawSchedule.map(normalizeSlot);

        const loadedRoutine = {
          id: r.id,
          title: r.title,
          department: r.department || 'CSE',
          academicYear: r.academicYear || '',
          effectiveFrom: r.effectiveFrom || '',
          status: r.status || 'DRAFT',
          version_number: r.version_number || 1,
          is_active: r.is_active || 0,
          semesters: normalizedSemesters,
          schedule: normalizedSchedule,
          rawRoutineData: parsedData
        };
        setActiveRoutine(loadedRoutine);
        setOriginalRoutine(JSON.parse(JSON.stringify(loadedRoutine)));
        return loadedRoutine;
      }
    } catch (err) {
      console.warn('No active routine returned from /api/routines/active:', err);
    } finally {
      setLoadingActiveRoutine(false);
    }
    return null;
  };

  useEffect(() => {
    const init = async () => {
      await fetchDeptTeachers();
      await fetchAcademicTree();
      const active = await fetchActiveRoutine();
      const list = await fetchRoutinesList();
      if (!active && list && list.length > 0) {
        // Automatically open the latest routine if no routine was explicitly flagged active
        await handleOpenRoutine(list[0].id);
      }
    };
    init();
  }, []);

  // Open Routine by ID
  const handleOpenRoutine = async (routineId) => {
    setLoadingActiveRoutine(true);
    try {
      const data = await safeFetchJson(`/api/routines/${routineId}`);
      const r = data.routine;
      
      const parsedData = r.routineData || {};
      const rawSemesters = Array.isArray(parsedData.semesters) ? parsedData.semesters : [];
      const normalizedSemesters = rawSemesters.map(sem => ({
        ...sem,
        courses: (sem.courses || []).map(normalizeCourse)
      }));

      const rawSchedule = Array.isArray(parsedData.schedule) ? parsedData.schedule : [];
      const normalizedSchedule = rawSchedule.map(normalizeSlot);

      const mergedRoutine = {
        id: r.id,
        title: r.title,
        department: r.department || 'CSE',
        academicYear: r.academicYear || '',
        effectiveFrom: r.effectiveFrom || '',
        status: r.status || 'DRAFT',
        version_number: r.version_number || 1,
        is_active: r.is_active || 0,
        semesters: normalizedSemesters,
        schedule: normalizedSchedule,
        rawRoutineData: parsedData
      };

      setActiveRoutine(mergedRoutine);
      setOriginalRoutine(JSON.parse(JSON.stringify(mergedRoutine)));
      setSelectedSemesterIndex(0);
      showFeedback('success', `Loaded "${mergedRoutine.title}"`);
    } catch (err) {
      console.error('Error opening routine:', err);
      showFeedback('error', 'Failed to open routine: ' + err.message);
    } finally {
      setLoadingActiveRoutine(false);
    }
  };

  // =========================================================================
  // 2. CREATE NEW ROUTINE
  // =========================================================================
  const handleCreateRoutineSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      showFeedback('error', 'Please provide a routine title.');
      return;
    }

    setCreatingRoutine(true);
    try {
      const payload = {
        title: createForm.title.trim(),
        department: createForm.department || 'CSE',
        academicYear: createForm.academicYear,
        effectiveFrom: createForm.effectiveFrom,
        status: 'DRAFT',
        routineData: {
          routineName: createForm.title.trim(),
          department: createForm.department || 'CSE',
          academicYear: createForm.academicYear,
          effectiveFrom: createForm.effectiveFrom,
          semesters: [],
          schedule: []
        }
      };

      const res = await safeFetchJson('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      showFeedback('success', 'Routine created successfully!');
      setIsCreateModalOpen(false);
      
      setCreateForm({
        title: '',
        academicYear: academicTree[0]?.sessionName || 'Session 2026-2027',
        department: 'CSE',
        effectiveFrom: new Date().toISOString().split('T')[0]
      });

      await fetchRoutinesList();
      if (res.id) {
        await handleOpenRoutine(res.id);
        setSubViewMode('BUILDER');
      }
    } catch (err) {
      console.error('Error creating routine:', err);
      showFeedback('error', 'Failed to create routine: ' + err.message);
    } finally {
      setCreatingRoutine(false);
    }
  };

  // =========================================================================
  // 3. SEMESTER MANAGEMENT (ADD, REMOVE, COPY)
  // =========================================================================
  const handleOpenAddSemesterModal = () => {
    if (academicTree && academicTree.length > 0) {
      const sess = academicTree.find(s => s.id === selectedSessionForAdd) || academicTree[0];
      setSelectedSessionForAdd(sess.id);
      if (sess.semesters && sess.semesters.length > 0) {
        const existingIds = new Set((activeRoutine?.semesters || []).map(s => s.semesterId || s.id));
        const available = sess.semesters.find(s => !existingIds.has(s.id));
        setSelectedSemesterIdForAdd(available ? available.id : sess.semesters[0].id);
      }
    }
    setIsAddSemesterModalOpen(true);
  };

  const handleAddSemesterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSemesterIdForAdd || !activeRoutine) {
      showFeedback('error', 'Please select a semester.');
      return;
    }

    const alreadyExists = (activeRoutine.semesters || []).some(s => (s.semesterId || s.id) === selectedSemesterIdForAdd);
    if (alreadyExists) {
      showFeedback('info', 'This semester is already in the routine. Switched to it.');
      const existingIdx = activeRoutine.semesters.findIndex(s => (s.semesterId || s.id) === selectedSemesterIdForAdd);
      if (existingIdx >= 0) setSelectedSemesterIndex(existingIdx);
      setIsAddSemesterModalOpen(false);
      return;
    }

    setAddingSemester(true);
    try {
      const detail = await safeFetchJson(`/api/routines/meta/semester/${selectedSemesterIdForAdd}`);
      
      const newSemesterEntry = {
        semesterId: detail.semester.id,
        semesterName: detail.semester.semesterName,
        termCode: detail.semester.termCode,
        shortTerm: detail.semester.shortTerm,
        sessionId: detail.semester.sessionId,
        sessionName: detail.semester.sessionName,
        totalStudents: detail.totalStudents || 0,
        excludedStudentIds: [],
        studentsRoster: detail.students || [],
        courses: (detail.courses || []).map(normalizeCourse)
      };

      const updatedSemesters = [...(activeRoutine.semesters || []), newSemesterEntry];
      setActiveRoutine(prev => ({
        ...prev,
        semesters: updatedSemesters
      }));

      setSelectedSemesterIndex(updatedSemesters.length - 1);
      setIsAddSemesterModalOpen(false);
      showFeedback('success', `Added ${detail.semester.semesterName} with ${detail.courses?.length || 0} courses!`);
    } catch (err) {
      console.error('Error adding semester:', err);
      showFeedback('error', 'Failed to add semester: ' + err.message);
    } finally {
      setAddingSemester(false);
    }
  };

  const handleRemoveSemester = (indexToRemove) => {
    if (!activeRoutine) return;
    const semToRemove = activeRoutine.semesters[indexToRemove];
    if (!window.confirm(`Are you sure you want to remove "${semToRemove.semesterName}" from this routine?`)) {
      return;
    }

    const updated = activeRoutine.semesters.filter((_, idx) => idx !== indexToRemove);
    // Also remove timetable slots for this semester
    const updatedSchedule = (activeRoutine.schedule || []).filter(s => s.semesterId !== semToRemove.semesterId);

    setActiveRoutine(prev => ({
      ...prev,
      semesters: updated,
      schedule: updatedSchedule
    }));

    if (selectedSemesterIndex >= updated.length) {
      setSelectedSemesterIndex(Math.max(0, updated.length - 1));
    }
    showFeedback('success', `Removed semester from routine.`);
  };

  // Copy Semester Configuration
  const handleConfirmCopySemester = async ({ sourceSemesterId, sourceSemesterName, includeTeachers, includeTimetable }) => {
    if (!activeRoutine) return;
    const currentSem = activeRoutine.semesters[selectedSemesterIndex];
    if (!currentSem) return;

    const sourceSem = activeRoutine.semesters.find(s => s.semesterId === sourceSemesterId);
    if (!sourceSem || !sourceSem.courses) {
      showFeedback('error', 'Source semester has no courses.');
      return;
    }

    const clonedCourses = sourceSem.courses.map(c => ({
      ...c,
      id: 'crs-' + Math.random().toString(36).substring(2, 9),
      courseId: 'crs-' + Math.random().toString(36).substring(2, 9),
      teacher: includeTeachers ? c.teacher : {
        type: 'none',
        teacherId: null,
        teacherName: 'Not Assigned',
        designation: '',
        department: 'CSE',
        departmentNumber: '',
        shortCode: ''
      },
      assignmentStatus: includeTeachers ? c.assignmentStatus : 'Pending',
      lifecycle_status: 'ACTIVE',
      inRoutine: true
    }));

    let updatedSchedule = activeRoutine.schedule || [];
    if (includeTimetable) {
      const sourceSlots = updatedSchedule.filter(s => s.semesterId === sourceSemesterId);
      const newSlots = sourceSlots.map(s => {
        const matchCourse = clonedCourses.find(nc => nc.courseCode === s.courseCode) || clonedCourses[0];
        return {
          ...s,
          id: 'slot-' + Math.random().toString(36).substring(2, 9),
          semesterId: currentSem.semesterId,
          semesterName: currentSem.semesterName,
          termCode: currentSem.shortTerm || currentSem.termCode,
          courseId: matchCourse ? (matchCourse.courseId || matchCourse.id) : s.courseId,
          isLocked: false
        };
      });
      updatedSchedule = [...updatedSchedule, ...newSlots];
    }

    const updatedSemesters = activeRoutine.semesters.map((sem, sIdx) => {
      if (sIdx !== selectedSemesterIndex) return sem;
      return {
        ...sem,
        courses: [...(sem.courses || []), ...clonedCourses]
      };
    });

    setActiveRoutine(prev => ({
      ...prev,
      semesters: updatedSemesters,
      schedule: updatedSchedule
    }));

    setIsCopySemesterModalOpen(false);
    showFeedback('success', `Copied ${clonedCourses.length} courses from ${sourceSemesterName} into ${currentSem.semesterName}!`);
  };

  // =========================================================================
  // 4. COURSE MANAGEMENT (ADD, EDIT, STATUS, ARCHIVE, INCLUSION)
  // =========================================================================
  const handleOpenAddCourseModal = () => {
    setEditingCourseTarget(null);
    setIsCourseFormModalOpen(true);
  };

  const handleOpenEditCourseModal = (...args) => {
    let course = null;
    if (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) {
      course = args[2];
    } else if (typeof args[0] === 'object' && args[0] !== null) {
      course = args[0];
    } else if (typeof args[1] === 'object' && args[1] !== null) {
      course = args[1];
    }
    if (!course && typeof args[0] === 'number') {
      const sem = activeRoutine?.semesters?.[selectedSemesterIndex];
      course = sem?.courses?.[args[0]];
    }
    if (course) {
      setEditingCourseTarget(course);
      setIsCourseFormModalOpen(true);
    }
  };

  const handleSaveCourse = (savedCourse) => {
    if (!activeRoutine) return;
    const currentSem = activeRoutine.semesters[selectedSemesterIndex];
    if (!currentSem) return;

    let updatedCourses;
    const exists = (currentSem.courses || []).some(c => (c.courseId || c.id) === (savedCourse.courseId || savedCourse.id));
    if (exists) {
      updatedCourses = currentSem.courses.map(c => 
        (c.courseId || c.id) === (savedCourse.courseId || savedCourse.id) ? { ...c, ...savedCourse } : c
      );
    } else {
      updatedCourses = [...(currentSem.courses || []), savedCourse];
    }

    const updatedSemesters = activeRoutine.semesters.map((sem, sIdx) => {
      if (sIdx !== selectedSemesterIndex) return sem;
      return { ...sem, courses: updatedCourses };
    });

    setActiveRoutine(prev => ({
      ...prev,
      semesters: updatedSemesters
    }));

    showFeedback('success', `${exists ? 'Updated' : 'Added'} course ${savedCourse.courseCode} (${savedCourse.creditHours} cr)`);
  };

  const handleDeleteCourse = (...args) => {
    if (!activeRoutine) return;
    let sIdx = selectedSemesterIndex;
    let cIdx = 0;
    if (args.length >= 2 && typeof args[1] === 'number') {
      sIdx = args[1];
      cIdx = args[0];
    } else if (typeof args[0] === 'number') {
      cIdx = args[0];
    }
    const currentSem = activeRoutine.semesters[sIdx];
    if (!currentSem) return;
    const targetCourse = currentSem.courses[cIdx];
    if (!targetCourse) return;

    if (!window.confirm(`Are you sure you want to remove ${targetCourse.courseCode}? You can archive it instead to keep historical records.`)) {
      return;
    }

    const updatedCourses = currentSem.courses.filter((_, idx) => idx !== cIdx);
    const updatedSemesters = activeRoutine.semesters.map((sem, idx) => {
      if (idx !== sIdx) return sem;
      return { ...sem, courses: updatedCourses };
    });

    const updatedSchedule = (activeRoutine.schedule || []).filter(s => s.courseId !== (targetCourse.courseId || targetCourse.id));

    setActiveRoutine(prev => ({
      ...prev,
      semesters: updatedSemesters,
      schedule: updatedSchedule
    }));

    showFeedback('success', `Removed course ${targetCourse.courseCode} from semester.`);
  };

  const handleToggleCourseStatus = async (...args) => {
    if (!activeRoutine) return;
    let sIdx = selectedSemesterIndex;
    let cIdx = 0;
    let newStatus = 'ACTIVE';

    if (args.length >= 3) {
      cIdx = args[0];
      newStatus = args[1];
      sIdx = args[2] ?? selectedSemesterIndex;
    } else if (args.length === 2) {
      cIdx = args[0];
      newStatus = args[1];
    }

    const currentSem = activeRoutine.semesters[sIdx];
    if (!currentSem) return;
    const targetCourse = currentSem.courses[cIdx];
    if (!targetCourse) return;

    const updatedCourses = currentSem.courses.map((c, idx) => 
      idx === cIdx ? { ...c, lifecycle_status: newStatus, status: newStatus } : c
    );

    const updatedSemesters = activeRoutine.semesters.map((sem, idx) => {
      if (idx !== sIdx) return sem;
      return { ...sem, courses: updatedCourses };
    });

    setActiveRoutine(prev => ({ ...prev, semesters: updatedSemesters }));

    // Sync to backend status endpoint
    try {
      await safeFetchJson(`/api/routines/courses/${targetCourse.courseId || targetCourse.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          routineId: activeRoutine.id,
          semesterId: currentSem.semesterId
        })
      });
      showFeedback('success', `Marked ${targetCourse.courseCode} as ${newStatus}.`);
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleToggleCourseInRoutine = (...args) => {
    if (!activeRoutine) return;
    let sIdx = selectedSemesterIndex;
    let cIdx = 0;
    let isIncluded = null;

    if (args.length >= 3) {
      cIdx = args[0];
      isIncluded = args[1];
      sIdx = args[2] ?? selectedSemesterIndex;
    } else if (args.length === 2 && typeof args[1] === 'boolean') {
      cIdx = args[0];
      isIncluded = args[1];
    } else if (args.length >= 1 && typeof args[0] === 'number') {
      cIdx = args[0];
    }

    const currentSem = activeRoutine.semesters[sIdx];
    if (!currentSem) return;

    const updatedCourses = currentSem.courses.map((c, idx) => {
      if (idx !== cIdx) return c;
      const nextVal = isIncluded !== null ? Boolean(isIncluded) : !(c.isIncluded !== false && c.inRoutine !== false);
      return { ...c, inRoutine: nextVal, isIncluded: nextVal };
    });

    const updatedSemesters = activeRoutine.semesters.map((sem, idx) => {
      if (idx !== sIdx) return sem;
      return { ...sem, courses: updatedCourses };
    });

    setActiveRoutine(prev => ({ ...prev, semesters: updatedSemesters }));
  };

  // =========================================================================
  // 5. TEACHER ASSIGNMENT & PROFILE SYNCHRONIZATION
  // =========================================================================
  const handleOpenTeacherModal = (semesterIndex, courseIndex, course) => {
    setTeacherModalState({
      semesterIndex,
      courseIndex,
      course,
      initialTeacher: course?.teacher
    });
  };

  const handleSaveTeacherAssignment = async (payload) => {
    if (!teacherModalState || !activeRoutine) return;
    const { semesterIndex, courseIndex } = teacherModalState;

    const course = payload?.course || teacherModalState.course;
    const teacher = payload?.teacher || payload;
    const mode = payload?.mode || (teacher.type === 'non_department' ? 'non_department' : 'department');
    if (!course || !teacher) return;

    const updatedSemesters = activeRoutine.semesters.map((sem, sIdx) => {
      if (sIdx !== semesterIndex) return sem;
      const updatedCourses = (sem.courses || []).map((c, cIdx) => {
        if (cIdx !== courseIndex) return c;
        return {
          ...c,
          teacher: teacher,
          assignmentStatus: mode === 'department' ? 'Assigned' : 'Non-Department'
        };
      });
      return { ...sem, courses: updatedCourses };
    });

    // Also update any already placed slots for this course on the timetable
    const updatedSchedule = (activeRoutine.schedule || []).map(s => {
      if (s.courseId === (course.courseId || course.id)) {
        return {
          ...s,
          teacherId: teacher.teacherId,
          teacherName: teacher.teacherName,
          teacherShortCode: teacher.shortCode || teacher.teacherName,
          teacherType: teacher.type
        };
      }
      return s;
    });

    setActiveRoutine(prev => ({
      ...prev,
      semesters: updatedSemesters,
      schedule: updatedSchedule
    }));

    // Persist immediately to backend teacher sync endpoint
    try {
      const currentSem = activeRoutine.semesters[semesterIndex];
      await safeFetchJson('/api/routines/sync-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId: activeRoutine.id,
          assignments: [{
            courseId: course.courseId || course.id,
            courseCode: course.courseCode,
            courseTitle: course.courseTitle,
            creditHours: course.creditHours,
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            teacherType: teacher.type,
            department: teacher.department,
            departmentNumber: teacher.departmentNumber,
            academicSession: activeRoutine.academicYear,
            semesterName: currentSem?.semesterName
          }]
        })
      });
    } catch (err) {
      console.error('Error synchronizing teacher assignment:', err);
    }

    setTeacherModalState(null);
    showFeedback('success', `Assigned ${teacher.teacherName} to ${course.courseCode} & synchronized profile!`);
  };

  // =========================================================================
  // 6. TIMETABLE MANAGEMENT, LOCKS, CONFLICTS & AUTO-GENERATE
  // =========================================================================
  const handleToggleLockSlot = (slotId) => {
    if (!activeRoutine) return;
    let slotName = 'slot';
    let isNowLocked = false;

    setActiveRoutine(prev => {
      const updated = (prev.schedule || []).map(s => {
        if (s.id === slotId) {
          slotName = s.courseCode;
          isNowLocked = !s.isLocked;
          return { ...s, isLocked: !s.isLocked };
        }
        return s;
      });
      return { ...prev, schedule: updated };
    });

    showFeedback('info', `${isNowLocked ? '🔒 Locked' : '🔓 Unlocked'} ${slotName}. ${isNowLocked ? 'Auto-schedule will preserve this slot.' : ''}`);
  };

  const handleApplyAutoSchedule = (generatedSlots) => {
    if (!activeRoutine) return;
    // Keep locked slots that weren't generated
    const lockedSlots = (activeRoutine.schedule || []).filter(s => s.isLocked);
    const nonConflictingLocked = lockedSlots.filter(ls => !generatedSlots.some(gs => gs.id === ls.id));
    const combinedSchedule = [...generatedSlots, ...nonConflictingLocked];

    setActiveRoutine(prev => ({
      ...prev,
      schedule: combinedSchedule
    }));

    setIsAutoScheduleModalOpen(false);
    setWorkspaceTab('TIMETABLE_GRID');
    showFeedback('success', `Generated ${generatedSlots.length} timetable periods conflict-free!`);
  };

  const handleOpenAddSlotModal = (dayId = 'Saturday', semesterId = null, startPeriodId = 'p1') => {
    if (!activeRoutine || activeRoutine.semesters.length === 0) {
      showFeedback('error', 'Please add at least one semester before scheduling timetable slots.');
      return;
    }

    const semId = semesterId || activeRoutine.semesters[0]?.semesterId;
    const currentSem = activeRoutine.semesters.find(s => s.semesterId === semId) || activeRoutine.semesters[0];
    const firstCourse = currentSem?.courses?.[0];

    const teacher = firstCourse?.teacher;
    const isDept = teacher?.type === 'department';
    const isSessional = firstCourse?.courseType === 'Sessional' || firstCourse?.courseTitle?.toLowerCase().includes('sessional');
    const defaultPeriodId = startPeriodId === BREAK_PERIOD_ID ? 'p1' : startPeriodId;

    setSlotModalState({
      isOpen: true,
      mode: 'CREATE',
      day: dayId,
      semesterId: currentSem?.semesterId,
      courseId: firstCourse?.courseId || firstCourse?.id || '',
      teacherId: isDept ? teacher?.teacherId : null,
      teacherName: teacher?.teacherName || 'Not Assigned',
      teacherShortCode: teacher?.shortCode || '',
      teacherType: teacher?.type || 'department',
      room: isSessional ? 'ACL' : '501',
      startPeriodId: defaultPeriodId,
      span: isSessional ? 3 : 1
    });
  };

  const handleOpenEditSlotModal = (slot) => {
    setSlotModalState({
      isOpen: true,
      mode: 'EDIT',
      editingSlotId: slot.id,
      day: slot.day,
      semesterId: slot.semesterId,
      courseId: slot.courseId,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
      teacherShortCode: slot.teacherShortCode,
      teacherType: slot.teacherType || 'department',
      room: slot.room,
      startPeriodId: slot.periodId,
      span: slot.span || 1,
      isLocked: Boolean(slot.isLocked)
    });
  };

  const handleSlotSemesterChange = (newSemesterId) => {
    if (!activeRoutine) return;
    const currentSem = activeRoutine.semesters.find(s => s.semesterId === newSemesterId);
    const firstCourse = currentSem?.courses?.[0];
    const isSessional = firstCourse?.courseType === 'Sessional' || firstCourse?.courseTitle?.toLowerCase().includes('sessional');
    const t = firstCourse?.teacher;
    const isDept = t?.type === 'department';
    setSlotModalState(prev => ({
      ...prev,
      semesterId: newSemesterId,
      courseId: firstCourse?.courseId || firstCourse?.id || '',
      teacherId: isDept ? t?.teacherId : null,
      teacherName: t?.teacherName || 'Not Assigned',
      teacherShortCode: t?.shortCode || '',
      teacherType: t?.type || 'department',
      room: isSessional ? 'ACL' : '501',
      span: isSessional ? 3 : 1
    }));
  };

  const handleSlotCourseChange = (selectedCourseId) => {
    if (!activeRoutine || !slotModalState) return;
    const currentSem = activeRoutine.semesters.find(s => s.semesterId === slotModalState.semesterId);
    const selectedCourse = currentSem?.courses?.find(c => (c.courseId || c.id) === selectedCourseId);
    if (!selectedCourse) return;
    const isSessional = selectedCourse.courseType === 'Sessional' || selectedCourse.courseTitle?.toLowerCase().includes('sessional');
    const t = selectedCourse.teacher;
    const isDept = t?.type === 'department';
    setSlotModalState(prev => ({
      ...prev,
      courseId: selectedCourseId,
      teacherId: isDept ? t?.teacherId : null,
      teacherName: t?.teacherName || 'Not Assigned',
      teacherShortCode: t?.shortCode || '',
      teacherType: t?.type || 'department',
      room: isSessional ? 'ACL' : (prev.room || '501'),
      span: isSessional ? 3 : (prev.span === 3 ? 1 : prev.span)
    }));
  };

  const candidateConflict = useMemo(() => {
    if (!slotModalState || !slotModalState.isOpen || !activeRoutine) return null;
    const candidate = {
      id: slotModalState.editingSlotId || 'candidate',
      day: slotModalState.day,
      periodId: slotModalState.startPeriodId,
      span: slotModalState.span,
      semesterId: slotModalState.semesterId,
      courseId: slotModalState.courseId,
      teacherId: slotModalState.teacherId,
      teacherName: slotModalState.teacherName,
      room: slotModalState.room
    };
    return checkSlotConflict(candidate, activeRoutine.schedule || [], slotModalState.editingSlotId);
  }, [slotModalState, activeRoutine?.schedule]);

  const handleSaveSlot = () => {
    if (!slotModalState || !activeRoutine) return;
    if (!slotModalState.courseId) {
      showFeedback('error', 'Please select a course.');
      return;
    }

    if (candidateConflict && candidateConflict.hasConflict) {
      showFeedback('error', candidateConflict.message);
      return;
    }

    const currentSem = activeRoutine.semesters.find(s => s.semesterId === slotModalState.semesterId);
    const currentCourse = currentSem?.courses?.find(c => (c.courseId || c.id) === slotModalState.courseId);

    const newSlot = normalizeSlot({
      id: slotModalState.editingSlotId || 'slot-' + Math.random().toString(36).substring(2, 9),
      day: slotModalState.day,
      periodId: slotModalState.startPeriodId,
      span: slotModalState.span,
      semesterId: slotModalState.semesterId,
      semesterName: currentSem?.semesterName || '',
      termCode: currentSem?.shortTerm || currentSem?.termCode || '',
      courseId: slotModalState.courseId,
      courseCode: currentCourse?.courseCode || '',
      courseTitle: currentCourse?.courseTitle || '',
      creditHours: currentCourse?.creditHours || 3.0,
      courseType: currentCourse?.courseType || 'Theory',
      teacherId: slotModalState.teacherId,
      teacherName: slotModalState.teacherName,
      teacherShortCode: slotModalState.teacherShortCode,
      teacherType: slotModalState.teacherType,
      room: slotModalState.room || '501',
      isLocked: Boolean(slotModalState.isLocked)
    });

    let updatedSchedule;
    if (slotModalState.mode === 'EDIT') {
      updatedSchedule = (activeRoutine.schedule || []).map(s => s.id === slotModalState.editingSlotId ? newSlot : s);
    } else {
      updatedSchedule = [...(activeRoutine.schedule || []), newSlot];
    }

    setActiveRoutine(prev => ({
      ...prev,
      schedule: updatedSchedule
    }));

    setSlotModalState(null);
    showFeedback('success', `Scheduled ${newSlot.courseCode} on ${newSlot.day} (${getSlotTimeRangeLabel(newSlot.periodId, newSlot.span)})`);
  };

  const handleDeleteSlot = (slotId) => {
    if (!activeRoutine) return;
    const updatedSchedule = (activeRoutine.schedule || []).filter(s => s.id !== slotId);
    setActiveRoutine(prev => ({
      ...prev,
      schedule: updatedSchedule
    }));
    showFeedback('success', 'Removed class slot from routine.');
  };

  const handleClearSchedule = () => {
    if (!activeRoutine) return;
    if (!window.confirm('Are you sure you want to clear all scheduled timetable periods in this routine?')) return;
    setActiveRoutine(prev => ({
      ...prev,
      schedule: []
    }));
    showFeedback('success', 'Cleared all timetable slots.');
  };

  // =========================================================================
  // DRAG-AND-DROP & MANUAL SCHEDULING HANDLERS
  // =========================================================================
  const handleOpenManualScheduleModal = (semId = null, courseId = null) => {
    setManualScheduleInitialSemId(semId || activeRoutine?.semesters?.[selectedSemesterIndex]?.semesterId || null);
    setManualScheduleInitialCourseId(courseId || null);
    setIsManualScheduleModalOpen(true);
  };

  const handleSaveManualSlot = (newSlot) => {
    if (!activeRoutine) return;
    const currentSchedule = activeRoutine.schedule || [];
    
    // Check if slot with same day, semesterId, periodId already exists
    const existingIdx = currentSchedule.findIndex(s => 
      s.day === newSlot.day && 
      s.semesterId === newSlot.semesterId && 
      s.periodId === newSlot.periodId
    );

    let updatedSchedule;
    if (existingIdx >= 0) {
      updatedSchedule = currentSchedule.map((s, idx) => idx === existingIdx ? newSlot : s);
    } else {
      updatedSchedule = [...currentSchedule, newSlot];
    }

    setActiveRoutine(prev => ({
      ...prev,
      schedule: updatedSchedule
    }));
    showFeedback('success', `Scheduled ${newSlot.courseCode} on ${newSlot.day} (${newSlot.periodId.toUpperCase()})`);
  };

  const handleCourseDragStart = (e, course, semester, preferredRoom = null) => {
    const isLab = course.courseType === 'Sessional' || (course.courseTitle && course.courseTitle.toLowerCase().includes('lab'));
    const defaultRoom = preferredRoom || (isLab ? 'ACL' : '501');
    const payload = {
      type: 'NEW_COURSE',
      courseId: course.courseId || course.id,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      creditHours: course.creditHours,
      courseType: course.courseType,
      weeklyHours: course.weeklyHours,
      teacher: course.teacher,
      teacherId: course.teacher?.teacherId || null,
      teacherName: course.teacher?.teacherName || 'Not Assigned',
      teacherShortCode: course.teacher?.shortCode || course.teacher?.teacherName || '',
      teacherType: course.teacher?.type || 'department',
      sourceSemesterId: semester.semesterId,
      termCode: semester.shortTerm || semester.termCode,
      semesterName: semester.semesterName,
      room: defaultRoom
    };
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
    } catch (err) {
      // fallback
    }
    setDraggedItem(payload);
  };

  const handleSlotDragStart = (e, slot) => {
    if (slot.isLocked) return;
    const payload = {
      type: 'MOVE_SLOT',
      slot
    };
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
    } catch (err) {
      // fallback
    }
    setDraggedItem(payload);
  };

  const handleCellDrop = (e, targetDay, targetSemesterId, targetPeriodId) => {
    e.preventDefault();
    setDragOverCell(null);

    let data = draggedItem;
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch (err) {
      // fallback
    }

    if (!data || !activeRoutine) return;

    const currentSchedule = activeRoutine.schedule || [];
    const targetSem = (activeRoutine.semesters || []).find(s => s.semesterId === targetSemesterId);
    if (!targetSem) return;

    if (data.type === 'NEW_COURSE') {
      const isLab = data.courseType === 'Sessional' || (data.courseTitle && data.courseTitle.toLowerCase().includes('lab'));
      const span = isLab ? 3 : 1;
      const preferredRoom = data.room || null;

      // Validate span does not exceed daily schedule or cross protected break
      const covered = getCoveredPeriodIds(targetPeriodId, span);
      if (!covered) {
        showFeedback('error', `Cannot place ${data.courseCode}: Class cannot cross protected 1:00-2:00 PM Break or exceed daily periods.`);
        setDraggedItem(null);
        return;
      }

      // Automatically allocate available conflict-free room
      const assignedRoom = getAvailableRoom(targetDay, targetPeriodId, span, isLab, currentSchedule, preferredRoom);

      // Candidate slot
      const candidate = normalizeSlot({
        id: `slot-drag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        semesterId: targetSemesterId,
        termCode: targetSem.shortTerm || targetSem.termCode || 'Sem',
        semesterName: targetSem.semesterName || 'Semester',
        courseId: data.courseId,
        courseCode: data.courseCode,
        courseTitle: data.courseTitle,
        creditHours: data.creditHours || 3.0,
        courseType: data.courseType || 'Theory',
        teacherId: data.teacherId || null,
        teacherName: data.teacherName || 'Not Assigned',
        teacherShortCode: data.teacherShortCode || '',
        teacherType: data.teacherType || 'department',
        day: targetDay,
        periodId: targetPeriodId,
        span: span,
        room: assignedRoom,
        isLocked: false
      });

      // Check conflict
      const conflict = checkSlotConflict(candidate, currentSchedule, currentSchedule);
      if (conflict && conflict.hasConflict) {
        showFeedback('error', `Conflict: ${conflict.message}`);
        setDraggedItem(null);
        return;
      }

      // Check weekly hours progress
      const existingCourseSlots = currentSchedule.filter(s => s.courseId === data.courseId && s.semesterId === targetSemesterId);
      const scheduledHours = existingCourseSlots.reduce((acc, s) => acc + (Number(s.span) || 1), 0);
      const requiredHours = Number(data.weeklyHours) || calculateWeeklyHours(data);

      if (scheduledHours >= requiredHours) {
        const confirmExtra = window.confirm(`Course ${data.courseCode} already has ${scheduledHours}/${requiredHours} weekly hours scheduled. Do you want to schedule an extra slot?`);
        if (!confirmExtra) {
          setDraggedItem(null);
          return;
        }
      }

      // Merge adjacent slots of the same course in this semester if scheduled beside each other
      const updatedSchedule = mergeAdjacentSameCourseSlots([...currentSchedule, candidate]);
      setActiveRoutine(prev => ({
        ...prev,
        schedule: updatedSchedule
      }));
      showFeedback('success', `Scheduled ${data.courseCode} (Room ${assignedRoom}) on ${targetDay} (${targetPeriodId.toUpperCase()})`);
      setDraggedItem(null);

    } else if (data.type === 'MOVE_SLOT') {
      const slot = data.slot;
      if (!slot) return;

      // If dropped onto the exact same position, do nothing
      if (slot.day === targetDay && slot.periodId === targetPeriodId && slot.semesterId === targetSemesterId) {
        setDraggedItem(null);
        return;
      }

      const span = Number(slot.span) || 1;
      const isLab = slot.courseType === 'Sessional' || span >= 3;
      const covered = getCoveredPeriodIds(targetPeriodId, span);
      if (!covered) {
        showFeedback('error', `Cannot move ${slot.courseCode}: Cannot cross protected 1:00-2:00 PM Break or exceed daily periods.`);
        setDraggedItem(null);
        return;
      }

      const otherSlots = currentSchedule.filter(s => s.id !== slot.id);

      // Check if target cell already has a slot for this semester
      const existingAtTarget = otherSlots.find(s => 
        s.day === targetDay && 
        s.semesterId === targetSemesterId && 
        s.periodId === targetPeriodId
      );

      if (existingAtTarget) {
        // If same course: merge them into a single multi-hour cell!
        if (existingAtTarget.courseCode === slot.courseCode || existingAtTarget.courseId === slot.courseId) {
          const combinedSpan = (Number(existingAtTarget.span) || 1) + span;
          const combinedCovered = getCoveredPeriodIds(targetPeriodId, combinedSpan);
          if (!combinedCovered) {
            showFeedback('error', `Cannot merge: Exceeds daily periods or crosses protected 1:00-2:00 PM Break.`);
            setDraggedItem(null);
            return;
          }
          const mergedSlot = {
            ...existingAtTarget,
            span: combinedSpan,
            coveredPeriods: combinedCovered
          };
          const updatedSchedule = mergeAdjacentSameCourseSlots(otherSlots.map(s => s.id === existingAtTarget.id ? mergedSlot : s));
          setActiveRoutine(prev => ({ ...prev, schedule: updatedSchedule }));
          showFeedback('success', `Merged 2 periods of ${slot.courseCode} into a single ${combinedSpan}h class!`);
          setDraggedItem(null);
          return;
        }

        // If different course: swap them between the two cells
        const newRoomForSlot = getAvailableRoom(targetDay, targetPeriodId, span, isLab, otherSlots.filter(s => s.id !== existingAtTarget.id), slot.room);
        const newRoomForExisting = getAvailableRoom(slot.day, slot.periodId, existingAtTarget.span || 1, existingAtTarget.courseType === 'Sessional', otherSlots.filter(s => s.id !== existingAtTarget.id), existingAtTarget.room);

        const movedSlot = normalizeSlot({
          ...slot,
          day: targetDay,
          periodId: targetPeriodId,
          semesterId: targetSemesterId,
          room: newRoomForSlot
        });

        const movedExisting = normalizeSlot({
          ...existingAtTarget,
          day: slot.day,
          periodId: slot.periodId,
          room: newRoomForExisting
        });

        const swappedSchedule = otherSlots.filter(s => s.id !== existingAtTarget.id).concat([movedSlot, movedExisting]);
        const conflict1 = checkSlotConflict(movedSlot, swappedSchedule.filter(s => s.id !== movedSlot.id), swappedSchedule);
        const conflict2 = checkSlotConflict(movedExisting, swappedSchedule.filter(s => s.id !== movedExisting.id), swappedSchedule);

        if (conflict1?.hasConflict || conflict2?.hasConflict) {
          showFeedback('error', `Cannot swap: ${conflict1?.message || conflict2?.message}`);
          setDraggedItem(null);
          return;
        }

        const updatedSchedule = mergeAdjacentSameCourseSlots(swappedSchedule);
        setActiveRoutine(prev => ({ ...prev, schedule: updatedSchedule }));
        showFeedback('success', `Swapped ${slot.courseCode} and ${existingAtTarget.courseCode}!`);
        setDraggedItem(null);
        return;
      }

      // Target cell is empty: move slot with conflict-free room assignment
      const assignedRoom = getAvailableRoom(targetDay, targetPeriodId, span, isLab, otherSlots, slot.room);

      const candidate = normalizeSlot({
        ...slot,
        day: targetDay,
        periodId: targetPeriodId,
        semesterId: targetSemesterId,
        termCode: targetSem.shortTerm || slot.termCode,
        semesterName: targetSem.semesterName || slot.semesterName,
        room: assignedRoom
      });

      // Check conflict against OTHER slots
      const conflict = checkSlotConflict(candidate, otherSlots, otherSlots);
      if (conflict && conflict.hasConflict) {
        showFeedback('error', `Move Rejected (Conflict): ${conflict.message}. Original slot restored.`);
        setDraggedItem(null);
        return;
      }

      // Valid move! If landing beside another period of same course, merge them
      const updatedSchedule = mergeAdjacentSameCourseSlots(otherSlots.concat([candidate]));
      setActiveRoutine(prev => ({
        ...prev,
        schedule: updatedSchedule
      }));
      showFeedback('success', `Moved ${slot.courseCode} to ${targetDay} (${targetPeriodId.toUpperCase()}, Room ${assignedRoom})`);
      setDraggedItem(null);
    }
  };

  // =========================================================================
  // 7. SAVE DRAFT & PUBLISH ROUTINE
  // =========================================================================
  const handleSaveRoutineDraft = async () => {
    if (!activeRoutine) return;
    setIsSavingRoutine(true);

    try {
      const routineDataPayload = {
        ...activeRoutine.rawRoutineData,
        routineName: activeRoutine.title,
        department: activeRoutine.department,
        academicYear: activeRoutine.academicYear,
        effectiveFrom: activeRoutine.effectiveFrom,
        semesters: activeRoutine.semesters,
        schedule: activeRoutine.schedule || []
      };

      const payload = {
        title: activeRoutine.title,
        department: activeRoutine.department,
        academicYear: activeRoutine.academicYear,
        effectiveFrom: activeRoutine.effectiveFrom,
        status: activeRoutine.status,
        routineData: routineDataPayload
      };

      await safeFetchJson(`/api/routines/${activeRoutine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      showFeedback('success', 'Draft saved successfully to database!');
      await fetchRoutinesList();
    } catch (err) {
      console.error('Error saving routine:', err);
      showFeedback('error', 'Failed to save draft: ' + err.message);
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const handleConfirmPublish = async ({ note, diff }) => {
    if (!activeRoutine) return;
    setIsPublishing(true);

    try {
      // 1. Save current state first
      const routineDataPayload = {
        ...activeRoutine.rawRoutineData,
        routineName: activeRoutine.title,
        department: activeRoutine.department,
        academicYear: activeRoutine.academicYear,
        effectiveFrom: activeRoutine.effectiveFrom,
        semesters: activeRoutine.semesters,
        schedule: activeRoutine.schedule || []
      };

      await safeFetchJson(`/api/routines/${activeRoutine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeRoutine.title,
          department: activeRoutine.department,
          academicYear: activeRoutine.academicYear,
          effectiveFrom: activeRoutine.effectiveFrom,
          status: 'PUBLISHED',
          routineData: routineDataPayload
        })
      });

      // 2. Call publish endpoint
      const publishRes = await safeFetchJson(`/api/routines/${activeRoutine.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          diff,
          updated_by: user?.name || user?.username || 'Department Authority'
        })
      });

      const nextVersion = publishRes.version_number || (activeRoutine.version_number || 1) + 1;
      setActiveRoutine(prev => ({
        ...prev,
        status: 'PUBLISHED',
        is_active: 1,
        version_number: nextVersion
      }));

      setOriginalRoutine(JSON.parse(JSON.stringify(activeRoutine)));
      setIsPublishModalOpen(false);
      showFeedback('success', `🎉 Published Version ${nextVersion}! Teacher profiles & Notice Board updated.`);
      await fetchRoutinesList();
    } catch (err) {
      console.error('Publish error:', err);
      showFeedback('error', 'Failed to publish routine: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Restore historical routine version
  const handleRestoreVersion = async (version) => {
    if (!activeRoutine) return;
    try {
      const res = await safeFetchJson(`/api/routines/${activeRoutine.id}/restore-version/${version.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restored_by: user?.name || user?.username || 'Department Authority'
        })
      });

      if (res.routine) {
        const r = res.routine;
        const parsedData = r.routineData || {};
        const rawSemesters = Array.isArray(parsedData.semesters) ? parsedData.semesters : [];
        const normalizedSemesters = rawSemesters.map(sem => ({
          ...sem,
          courses: (sem.courses || []).map(normalizeCourse)
        }));
        const rawSchedule = Array.isArray(parsedData.schedule) ? parsedData.schedule : [];
        const normalizedSchedule = rawSchedule.map(normalizeSlot);

        const loadedRoutine = {
          id: r.id,
          title: r.title,
          department: r.department || 'CSE',
          academicYear: r.academicYear || '',
          effectiveFrom: r.effectiveFrom || '',
          status: r.status || 'DRAFT',
          version_number: r.version_number || res.new_version_number || 1,
          is_active: r.is_active || 1,
          semesters: normalizedSemesters,
          schedule: normalizedSchedule,
          rawRoutineData: parsedData
        };

        setActiveRoutine(loadedRoutine);
        setOriginalRoutine(JSON.parse(JSON.stringify(loadedRoutine)));
        setIsHistoryModalOpen(false);
        showFeedback('success', `Restored Version ${version.version_number} as new Version ${res.new_version_number || loadedRoutine.version_number}!`);
        await fetchRoutinesList();
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      showFeedback('error', 'Failed to restore version: ' + err.message);
    }
  };

  // Delete Routine
  const handleDeleteRoutine = async () => {
    if (!deleteTargetRoutine) return;
    setDeletingRoutine(true);

    try {
      await safeFetchJson(`/api/routines/${deleteTargetRoutine.id}`, {
        method: 'DELETE'
      });

      showFeedback('success', `Deleted routine "${deleteTargetRoutine.title}" successfully.`);
      setDeleteTargetRoutine(null);
      if (activeRoutine?.id === deleteTargetRoutine.id) {
        setActiveRoutine(null);
      }
      await fetchRoutinesList();
    } catch (err) {
      console.error('Error deleting routine:', err);
      showFeedback('error', 'Failed to delete routine: ' + err.message);
    } finally {
      setDeletingRoutine(false);
    }
  };

  // Export Word (.doc)
  const handleExportWord = () => {
    if (!activeRoutine) return;
    try {
      exportOfficialRoutineToWord({
        title: activeRoutine.title,
        academicYear: activeRoutine.academicYear,
        effectiveFrom: activeRoutine.effectiveFrom,
        semesters: activeRoutine.semesters || [],
        schedule: activeRoutine.schedule || [],
        teacherWorkloadMap
      });
      showFeedback('success', 'Official routine exported to Word (.doc) successfully!');
    } catch (err) {
      console.error('Word export error:', err);
      showFeedback('error', 'Failed to export Word document: ' + err.message);
    }
  };

  // Print Routine
  const handlePrintRoutine = () => {
    window.print();
  };

  // Display schedule with adjacent same-course periods merged
  const mergedDisplaySchedule = useMemo(() => {
    return mergeAdjacentSameCourseSlots(activeRoutine?.schedule || []);
  }, [activeRoutine?.schedule]);

  // Teacher workload map memo
  const teacherWorkloadMap = useMemo(() => {
    if (!activeRoutine || !Array.isArray(activeRoutine.semesters)) return {};
    const map = {};
    const schedule = activeRoutine.schedule || [];

    activeRoutine.semesters.forEach(sem => {
      (sem.courses || []).forEach(c => {
        const t = c.teacher;
        if (!t || t.type === 'none' || c.assignmentStatus === 'Pending' || t.teacherName === 'Not Assigned') {
          return;
        }

        const isDept = t.type === 'department' && t.teacherId;
        const key = isDept
          ? `dept_${t.teacherId}`
          : `non_dept_${(t.teacherName || '').trim().toLowerCase()}_${(t.department || '').trim().toLowerCase()}`;

        if (!map[key]) {
          map[key] = {
            teacherId: t.teacherId || null,
            teacherName: t.teacherName,
            type: t.type,
            department: t.department || 'CSE',
            designation: t.designation || '',
            shortCode: t.shortCode || '',
            courseCount: 0,
            weeklyHours: 0,
            scheduledHours: 0,
            remainingHours: 0,
            courses: []
          };
        }

        const hrs = Number(c.weeklyHours || c.creditHours || 3);
        const cid = c.courseId || c.id;
        const slots = schedule.filter(s => {
          const matchCourse = (s.courseId && (s.courseId === cid || s.courseId === c.id || s.courseId === c.courseId)) ||
            (s.courseCode && c.courseCode && s.courseCode.trim().toUpperCase() === c.courseCode.trim().toUpperCase());
          return matchCourse;
        });
        const courseSchedHours = slots.reduce((acc, s) => acc + (Number(s.span) || 1), 0);
        const courseRemainingHours = Math.max(0, hrs - courseSchedHours);

        map[key].courseCount += 1;
        map[key].weeklyHours += hrs;
        map[key].scheduledHours += courseSchedHours;
        map[key].remainingHours += courseRemainingHours;

        map[key].courses.push({
          courseId: cid,
          courseCode: c.courseCode,
          courseTitle: c.courseTitle,
          creditHours: Number(c.creditHours || 3),
          weeklyHours: hrs,
          scheduledHours: courseSchedHours,
          remainingHours: courseRemainingHours,
          courseType: c.courseType || 'Theory',
          semesterName: sem.semesterName,
          termCode: sem.shortTerm || sem.termCode
        });
      });
    });

    return map;
  }, [activeRoutine]);

  // Unassigned / Unscheduled Courses helper memo
  const unassignedCoursesList = useMemo(() => {
    if (!activeRoutine || !Array.isArray(activeRoutine.semesters)) return [];
    const list = [];
    activeRoutine.semesters.forEach((sem, sIdx) => {
      (sem.courses || []).forEach((c, cIdx) => {
        const isUnassigned = !c.teacher || c.teacher.type === 'none' || c.teacher.teacherName === 'Not Assigned' || c.assignmentStatus === 'Pending';
        const isScheduled = (activeRoutine.schedule || []).some(s => s.courseId === (c.courseId || c.id));
        if (isUnassigned || !isScheduled) {
          list.push({
            semesterIndex: sIdx,
            courseIndex: cIdx,
            semesterId: sem.semesterId,
            semesterName: sem.semesterName,
            termCode: sem.shortTerm || sem.termCode,
            course: c,
            isUnassigned,
            isScheduled
          });
        }
      });
    });
    return list;
  }, [activeRoutine]);

  // Active semester for current tab
  const activeSemester = activeRoutine?.semesters[selectedSemesterIndex] || null;

  // Semesters for add semester modal
  const semestersForSelectedSession = useMemo(() => {
    const sess = academicTree.find(s => s.id === selectedSessionForAdd);
    return sess?.semesters || [];
  }, [academicTree, selectedSessionForAdd]);

  return (
    <div className="routine-management-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* FEEDBACK TOAST */}
      {feedback && (
        <div 
          className="no-print" 
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            background: feedback.type === 'success' ? '#ecfdf5' : feedback.type === 'info' ? '#eff6ff' : '#fef2f2',
            border: feedback.type === 'success' ? '1px solid #a7f3d0' : feedback.type === 'info' ? '1px solid #bfdbfe' : '1px solid #fecaca',
            color: feedback.type === 'success' ? '#065f46' : feedback.type === 'info' ? '#1e40af' : '#991b1b',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
            animation: 'fadeInUp 0.2s ease-out'
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : feedback.type === 'info' ? <Info size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. THREE-CARD ROUTINE LANDING HEADER */}
      {/* ========================================================================= */}
      <div className="no-print">
        <RoutineLandingHeader 
          activeCategory={activeCategory}
          onSelectCategory={(cat) => {
            setActiveCategory(cat);
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 2. LAB EXAM / THEORY EXAM FUTURE MODULE CARDS */}
      {/* ========================================================================= */}
      {activeCategory !== 'CLASS_ROUTINE' && (
        <div 
          style={{
            background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
            borderRadius: '20px',
            padding: '3rem 2rem',
            color: '#ffffff',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem'
          }}
        >
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: activeCategory === 'LAB_EXAM_ROUTINE' 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
            }}
          >
            {activeCategory === 'LAB_EXAM_ROUTINE' ? <FlaskConical size={32} color="#ffffff" /> : <GraduationCap size={32} color="#ffffff" />}
          </div>

          <div>
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', fontWeight: 800, padding: '0.35rem 0.85rem' }}>
              ⚡ Architecture Ready • Upcoming Exam Module
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.85rem 0 0.4rem', color: '#ffffff' }}>
              {activeCategory === 'LAB_EXAM_ROUTINE' ? 'Lab Exam Routine System' : 'Theory Exam Routine System'}
            </h2>
            <p style={{ maxWidth: '640px', margin: '0 auto', fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
              {activeCategory === 'LAB_EXAM_ROUTINE'
                ? 'The database and scheduling infrastructure are prepared for laboratory exam management. This section will handle lab exam groups, lab room assignments (ACL, Robotics, Hardware, S/W), external examiner scheduling, and seat plans.'
                : 'The database and scheduling infrastructure are prepared for semester final theory examinations. This section will handle exam hall seat arrangements, invigilator teacher rosters, and examination committee routines.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveCategory('CLASS_ROUTINE')}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
              }}
            >
              Open Class Routine Management
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CLASS ROUTINE: DASHBOARD VIEW */}
      {/* ========================================================================= */}
      {activeCategory === 'CLASS_ROUTINE' && subViewMode === 'DASHBOARD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* Main Hero Dashboard Card */}
          <ClassRoutineDashboard 
            activeRoutine={activeRoutine}
            loading={loadingActiveRoutine}
            onUpdateRoutine={() => {
              setSubViewMode('BUILDER');
              setWorkspaceTab('TIMETABLE_GRID');
            }}
            onViewRoutine={() => {
              setSubViewMode('BUILDER');
              setWorkspaceTab('TIMETABLE_GRID');
            }}
            onRoutineHistory={() => setIsHistoryModalOpen(true)}
            onManageCourses={() => {
              setSubViewMode('BUILDER');
              setWorkspaceTab('COURSES');
            }}
            onManageTeachers={() => setIsWorkloadModalOpen(true)}
            onExportWord={handleExportWord}
            onPrint={handlePrintRoutine}
          />

          {/* Quick Routine Switcher / All Routines Table */}
          <div 
            className="no-print card"
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  All Academic Routines ({routinesList.length})
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Select or switch active routines across academic sessions.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={fetchRoutinesList}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} className={loadingRoutines ? 'spin' : ''} /> Refresh
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.15rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  <PlusCircle size={16} /> + New Routine
                </button>
              </div>
            </div>

            {loadingRoutines ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem', color: '#6366f1' }} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Loading Academic Routines...</div>
              </div>
            ) : routinesList.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <CalendarCheck size={42} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>No Routines Created Yet</h4>
                <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.82rem' }}>
                  Create your first university routine to start managing semesters and schedules.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  style={{
                    background: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Create Routine
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {routinesList.map(r => {
                  const isCurrentActive = activeRoutine?.id === r.id;
                  const isDbActive = Boolean(r.is_active);

                  return (
                    <div 
                      key={r.id}
                      style={{
                        padding: '1.15rem',
                        borderRadius: '14px',
                        border: isCurrentActive ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        background: isCurrentActive ? '#f8fafc' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        boxShadow: isCurrentActive ? '0 4px 15px rgba(99, 102, 241, 0.1)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                              {r.title}
                            </h4>
                            {isDbActive && (
                              <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.68rem', fontWeight: 800 }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                            {r.academicYear} • CSE
                          </div>
                        </div>

                        <span className="badge" style={{ background: r.status === 'PUBLISHED' ? '#ecfdf5' : '#f1f5f9', color: r.status === 'PUBLISHED' ? '#059669' : '#475569', fontSize: '0.72rem', fontWeight: 800 }}>
                          v{r.version_number || 1} {r.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenRoutine(r.id);
                              setSubViewMode('BUILDER');
                            }}
                            style={{
                              background: '#6366f1',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Open & Edit
                          </button>

                          {activeRoutine?.id !== r.id && (
                            <button
                              type="button"
                              onClick={() => handleOpenRoutine(r.id)}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Select
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setDeleteTargetRoutine(r)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                          title="Delete Routine"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CLASS ROUTINE: BUILDER WORKSPACE VIEW */}
      {/* ========================================================================= */}
      {activeCategory === 'CLASS_ROUTINE' && subViewMode === 'BUILDER' && activeRoutine && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Builder Top Action Bar */}
          <div 
            className="no-print"
            style={{
              background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setSubViewMode('DASHBOARD')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} /> Routine Dashboard
              </button>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
                    {activeRoutine.title}
                  </h2>
                  <span className="badge" style={{ background: '#6366f1', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800 }}>
                    v{activeRoutine.version_number || 1}
                  </span>
                  {Boolean(activeRoutine.is_active) && (
                    <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800 }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  {activeRoutine.academicYear} • {activeRoutine.department} Department • Effective: {activeRoutine.effectiveFrom || 'Current'}
                </div>
              </div>
            </div>

            {/* Builder Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsAutoScheduleModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                }}
              >
                <Sparkles size={16} /> Auto-Generate Routine
              </button>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <History size={16} /> History
              </button>

              <button
                type="button"
                onClick={handleExportWord}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} /> Word (.doc)
              </button>

              <button
                type="button"
                onClick={handlePrintRoutine}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <Printer size={16} /> Print
              </button>

              <button
                type="button"
                onClick={handleSaveRoutineDraft}
                disabled={isSavingRoutine}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.55rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <Save size={16} /> {isSavingRoutine ? 'Saving...' : 'Save Draft'}
              </button>

              <button
                type="button"
                onClick={() => setIsPublishModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Send size={16} /> Publish Changes
              </button>
            </div>
          </div>

          {/* Builder Workspace Tab Bar */}
          <div 
            className="no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              padding: '0.5rem 0.75rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setWorkspaceTab('TIMETABLE_GRID')}
                style={{
                  background: workspaceTab === 'TIMETABLE_GRID' ? '#6366f1' : 'transparent',
                  color: workspaceTab === 'TIMETABLE_GRID' ? '#ffffff' : '#475569',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <Grid size={16} /> Official Timetable Grid (5 Days)
              </button>

              <button
                type="button"
                onClick={() => setWorkspaceTab('COURSES')}
                style={{
                  background: workspaceTab === 'COURSES' ? '#6366f1' : 'transparent',
                  color: workspaceTab === 'COURSES' ? '#ffffff' : '#475569',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <BookOpen size={16} /> Semester Courses & Teachers ({activeRoutine.semesters?.reduce((acc, s) => acc + (s.courses?.length || 0), 0) || 0})
              </button>
            </div>

            {/* Quick action buttons on tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleOpenAddSemesterModal}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Plus size={14} /> Add Semester
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: SEMESTER COURSES & TEACHER MANAGEMENT */}
          {/* ========================================================================= */}
          {workspaceTab === 'COURSES' && (
            <SemesterCourseManager 
              semesters={activeRoutine.semesters || []}
              activeSemesterIndex={selectedSemesterIndex}
              selectedSemesterIndex={selectedSemesterIndex}
              currentSchedule={activeRoutine.schedule || []}
              onSelectSemester={setSelectedSemesterIndex}
              onSelectSemesterIndex={setSelectedSemesterIndex}
              onAddCourse={handleOpenAddCourseModal}
              onOpenAddCourseModal={handleOpenAddCourseModal}
              onEditCourse={handleOpenEditCourseModal}
              onOpenEditCourseModal={handleOpenEditCourseModal}
              onDeleteCourse={handleDeleteCourse}
              onUpdateCourseStatus={handleToggleCourseStatus}
              onToggleCourseStatus={handleToggleCourseStatus}
              onToggleIncludeCourse={handleToggleCourseInRoutine}
              onToggleCourseInRoutine={handleToggleCourseInRoutine}
              onOpenTeacherModal={(arg1, arg2, arg3) => {
                if (typeof arg1 === 'object' && arg1 !== null) {
                  // (course, idx, semIdx)
                  handleOpenTeacherModal(arg3 !== undefined ? arg3 : selectedSemesterIndex, arg2, arg1);
                } else if (typeof arg3 === 'object' && arg3 !== null) {
                  // (semIdx, idx, course)
                  handleOpenTeacherModal(arg1, arg2, arg3);
                } else if (typeof arg2 === 'object' && arg2 !== null) {
                  // (idx, course)
                  handleOpenTeacherModal(selectedSemesterIndex, arg1, arg2);
                }
              }}
              onOpenCopySemesterModal={() => setIsCopySemesterModalOpen(true)}
              onAddSemesterModalOpen={handleOpenAddSemesterModal}
              onOpenStudentModal={() => setIsStudentModalOpen(true)}
            />
          )}

          {/* ========================================================================= */}
          {/* TAB 2: OFFICIAL 5-DAY TIMETABLE GRID */}
          {/* ========================================================================= */}
          {workspaceTab === 'TIMETABLE_GRID' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: '1.25rem',
              alignItems: 'start'
            }}>
              
              {/* LEFT PANEL: Selected Semester Courses & Drag-and-Drop Source */}
              <CourseDragPanel 
                semesters={activeRoutine.semesters || []}
                selectedSemesterIndex={selectedSemesterIndex}
                onSelectSemesterIndex={setSelectedSemesterIndex}
                onOpenAddSemesterModal={handleOpenAddSemesterModal}
                onRemoveSemester={handleRemoveSemester}
                onOpenTeacherModal={(semIdx, cIdx, course) => handleOpenTeacherModal(semIdx, cIdx, course)}
                onOpenManualScheduleModal={(semId, courseId) => handleOpenManualScheduleModal(semId, courseId)}
                currentSchedule={activeRoutine.schedule || []}
                onDragStartCourse={handleCourseDragStart}
              />

              {/* RIGHT PANEL: Official Timetable Grid & Droppable Target */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                
                {/* 1. Schedule Conflicts Banner (if any) */}
                {entireConflicts.length > 0 && (
                  <div 
                    className="no-print" 
                    style={{
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: '14px',
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '6px', color: '#b91c1c' }}>
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#991b1b' }}>
                          {entireConflicts.length} Timetable Conflicts Detected!
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.1rem' }}>
                          Overlapping teacher assignments or room double-bookings require resolution.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsConflictListModalOpen(true)}
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      View All ({entireConflicts.length})
                    </button>
                  </div>
                )}

                {/* Printable routine wrapper containing Header, Table Grid, and Footer */}
                <div className="official-routine-print-wrapper">
                  {/* 2. Official Institutional Header (Screen & Landscape Print) */}
                  <div 
                    className="official-routine-header"
                  style={{
                    textAlign: 'center',
                    padding: '1rem 1.25rem',
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <h1 
                    className="univ-title" 
                    style={{ 
                      margin: 0, 
                      fontSize: '1.25rem', 
                      fontWeight: 900, 
                      color: '#0f172a', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.4px',
                      lineHeight: 1.2
                    }}
                  >
                    Pabna University of Science and Technology
                  </h1>
                  <h2 
                    className="dept-title" 
                    style={{ 
                      margin: '3px 0 0', 
                      fontSize: '1.02rem', 
                      fontWeight: 800, 
                      color: '#1e3a8a',
                      lineHeight: 1.2
                    }}
                  >
                    Department of Computer Science & Engineering
                  </h2>
                  <div 
                    className="routine-meta" 
                    style={{ 
                      fontSize: '0.8rem', 
                      color: '#334155', 
                      fontWeight: 600, 
                      marginTop: '5px' 
                    }}
                  >
                    <strong>Class Routine:</strong> {activeRoutine.title} • <strong>Session:</strong> {activeRoutine.academicYear} • <strong>Effective Date:</strong> {activeRoutine.effectiveFrom || 'Current'}
                  </div>
                </div>

                {/* 3. Timetable Grid Control Bar */}
                <div 
                  className="no-print" 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      Active Routine Semesters ({activeRoutine.semesters?.length || 0}):
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {(activeRoutine.semesters || []).map((s, idx) => (
                        <button
                          key={s.semesterId || idx}
                          type="button"
                          onClick={() => setSelectedSemesterIndex(idx)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            border: 'none',
                            background: idx === selectedSemesterIndex ? '#4338ca' : '#e0e7ff',
                            color: idx === selectedSemesterIndex ? '#ffffff' : '#3730a3',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {s.shortTerm || s.termCode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Drag cards from left panel or
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenManualScheduleModal()}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '7px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                      }}
                    >
                      <Plus size={13} /> Add Class Manually
                    </button>
                  </div>
                </div>

                {/* 4. Timetable Schedule Grid Table (Official Structure) */}
                <div 
                  className="official-routine-print-container"
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    overflow: 'hidden'
                  }}
                >
                  <div className="official-table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                    <table 
                      className="official-timetable-grid"
                      style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse', 
                        minWidth: '940px', 
                        fontSize: '0.8rem' 
                      }}
                    >
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#ffffff', borderBottom: '2px solid #334155' }}>
                          <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, borderRight: '1px solid #334155' }}>
                            Day
                          </th>
                          <th style={{ padding: '0.75rem 0.5rem', width: '65px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 800, borderRight: '1.5px solid #334155' }}>
                            Sem
                          </th>
                          {SCHEDULE_PERIODS.map(p => {
                            if (p.isBreak) {
                              return (
                                <th 
                                  key={p.id}
                                  style={{
                                    padding: '0.75rem 0.4rem',
                                    width: '65px',
                                    textAlign: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    background: '#1e293b',
                                    color: '#f59e0b',
                                    borderLeft: '1.5px solid #475569',
                                    borderRight: '1.5px solid #475569'
                                  }}
                                >
                                  <div>BREAK</div>
                                  <div style={{ fontSize: '0.64rem', fontWeight: 600, opacity: 0.9 }}>
                                    {p.startTime}-{p.endTime}
                                  </div>
                                </th>
                              );
                            }
                            return (
                              <th 
                                key={p.id}
                                style={{
                                  padding: '0.65rem 0.35rem',
                                  textAlign: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  borderRight: '1px solid #334155'
                                }}
                              >
                                <div style={{ color: '#e2e8f0' }}>{p.label}</div>
                                <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#94a3b8' }}>
                                  {p.startTime} - {p.endTime}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {SCHEDULE_DAYS.map(dayObj => {
                          const semesters = activeRoutine.semesters || [];
                          if (semesters.length === 0) {
                            return (
                              <tr key={dayObj.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '1rem', fontWeight: 800, background: '#f8fafc', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                  {dayObj.name}
                                </td>
                                <td colSpan={SCHEDULE_PERIODS.length + 1} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No semesters added. Click "Add Semester" on the left panel.
                                </td>
                              </tr>
                            );
                          }

                          return semesters.map((sem, semIdx) => {
                            const isLastSemOfDay = semIdx === semesters.length - 1;

                            return (
                              <tr 
                                key={`${dayObj.name}-${sem.semesterId}`}
                                style={{
                                  borderBottom: isLastSemOfDay ? '2.5px solid #94a3b8' : '1px solid #e2e8f0',
                                  background: semIdx % 2 === 0 ? '#ffffff' : '#fafbfc'
                                }}
                              >
                                {/* Day Column (rowspan for all semesters) */}
                                {semIdx === 0 && (
                                  <td 
                                    rowSpan={semesters.length}
                                    style={{
                                      padding: '0.75rem 0.5rem',
                                      fontWeight: 900,
                                      textAlign: 'center',
                                      background: '#f1f5f9',
                                      color: '#0f172a',
                                      borderRight: '2px solid #cbd5e1',
                                      verticalAlign: 'middle',
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    <div style={{ fontWeight: 900 }}>
                                      {dayObj.name}
                                    </div>
                                  </td>
                                )}

                                {/* Semester Identifier Column */}
                                <td 
                                  style={{
                                    padding: '0.5rem 0.35rem',
                                    textAlign: 'center',
                                    fontWeight: 800,
                                    color: '#3730a3',
                                    background: '#e0e7ff',
                                    borderRight: '1.5px solid #cbd5e1',
                                    verticalAlign: 'middle',
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  {sem.shortTerm || sem.termCode}
                                </td>

                                {/* Period Columns */}
                                {SCHEDULE_PERIODS.map(period => {
                                  if (period.isBreak) {
                                    if (semIdx === 0) {
                                      return (
                                        <td 
                                          key={`break-${dayObj.name}`}
                                          rowSpan={semesters.length}
                                          style={{
                                            background: '#fef3c7',
                                            borderLeft: '1.5px solid #cbd5e1',
                                            borderRight: '1.5px solid #cbd5e1',
                                            textAlign: 'center',
                                            verticalAlign: 'middle',
                                            color: '#92400e',
                                            fontWeight: 800,
                                            fontSize: '0.72rem',
                                            letterSpacing: '1px',
                                            padding: '0.4rem 0.2rem',
                                            userSelect: 'none'
                                          }}
                                        >
                                          <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', margin: '0 auto' }}>
                                            BREAK (01:00 - 02:00)
                                          </div>
                                        </td>
                                      );
                                    }
                                    return null;
                                  }

                                  const slotStartingHere = mergedDisplaySchedule.find(s => 
                                    s.day === dayObj.name && 
                                    s.semesterId === sem.semesterId && 
                                    s.periodId === period.id
                                  );

                                  const slotCoveringEarlier = mergedDisplaySchedule.find(s => 
                                    s.day === dayObj.name && 
                                    s.semesterId === sem.semesterId && 
                                    s.periodId !== period.id && 
                                    (s.coveredPeriods || getCoveredPeriodIds(s.periodId, s.span || 1))?.includes(period.id)
                                  );

                                  if (slotCoveringEarlier) {
                                    return null;
                                  }

                                  const isCellDragTarget = 
                                    dragOverCell?.day === dayObj.name && 
                                    dragOverCell?.semesterId === sem.semesterId && 
                                    dragOverCell?.periodId === period.id;

                                  if (slotStartingHere) {
                                    const span = slotStartingHere.span || 1;
                                    const isConflicted = entireConflicts.some(cf => cf.slotIds?.includes(slotStartingHere.id));
                                    const isSessional = slotStartingHere.courseType === 'Sessional' || span >= 3;
                                    const isLocked = Boolean(slotStartingHere.isLocked);

                                    return (
                                      <td 
                                        key={`slot-${slotStartingHere.id}`}
                                        colSpan={span}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                        onDragEnter={(e) => { e.preventDefault(); setDragOverCell({ day: dayObj.name, semesterId: sem.semesterId, periodId: period.id }); }}
                                        onDragLeave={() => setDragOverCell(null)}
                                        onDrop={(e) => handleCellDrop(e, dayObj.name, sem.semesterId, period.id)}
                                        style={{
                                          padding: '0.35rem 0.4rem',
                                          verticalAlign: 'middle',
                                          borderRight: '1px solid #e2e8f0',
                                          borderLeft: isConflicted ? '2.5px solid #ef4444' : isLocked ? '2.5px solid #f59e0b' : 'none',
                                          background: isCellDragTarget 
                                            ? '#e0e7ff' 
                                            : isConflicted 
                                              ? '#fee2e2' 
                                              : isLocked
                                                ? '#fffbeb'
                                                : isSessional 
                                                  ? '#f3e8ff' 
                                                  : span === 2 
                                                    ? '#eff6ff' 
                                                    : '#f8fafc'
                                        }}
                                      >
                                        <div 
                                          draggable={!isLocked}
                                          onDragStart={(e) => handleSlotDragStart(e, slotStartingHere)}
                                          onDragEnd={() => { setDraggedItem(null); setDragOverCell(null); }}
                                          title={isLocked ? "Slot locked from editing" : "Drag to move slot to another day/time"}
                                          style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '8px',
                                            background: isConflicted ? '#fecaca' : '#ffffff',
                                            border: isConflicted ? '1.5px solid #dc2626' : isLocked ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                            position: 'relative',
                                            cursor: isLocked ? 'default' : 'grab'
                                          }}
                                        >
                                          {/* Top row: Course Code & Room */}
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                              <strong className="course-code-print" style={{ 
                                                color: isConflicted ? '#991b1b' : '#0f172a', 
                                                fontSize: '0.82rem',
                                                letterSpacing: '0.3px'
                                              }}>
                                                {slotStartingHere.courseCode}
                                              </strong>
                                              {isLocked && (
                                                <span title="Locked Slot: Preserves position during auto-scheduling" style={{ color: '#d97706', display: 'inline-flex' }}>
                                                  <Lock size={12} />
                                                </span>
                                              )}
                                            </div>
                                            
                                            <span style={{
                                              background: isConflicted ? '#f87171' : isLocked ? '#f59e0b' : '#334155',
                                              color: '#ffffff',
                                              borderRadius: '4px',
                                              padding: '0.1rem 0.35rem',
                                              fontSize: '0.65rem',
                                              fontWeight: 800
                                            }}>
                                              {slotStartingHere.room || '501'}
                                            </span>
                                          </div>

                                          {/* Middle row: Teacher Short Code / Name */}
                                          <div style={{ 
                                            fontSize: '0.72rem', 
                                            fontWeight: 700, 
                                            color: isConflicted ? '#b91c1c' : (!slotStartingHere.teacherName || slotStartingHere.teacherName === 'Not Assigned' ? '#d97706' : '#4338ca'),
                                            marginTop: '0.2rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                          }}>
                                            {slotStartingHere.teacherShortCode ? (
                                              slotStartingHere.teacherShortCode
                                            ) : slotStartingHere.teacherName && slotStartingHere.teacherName !== 'Not Assigned' ? (
                                              slotStartingHere.teacherName
                                            ) : (
                                              <span style={{ 
                                                display: 'inline-block', 
                                                background: '#fef3c7', 
                                                color: '#b45309', 
                                                padding: '1px 5px', 
                                                borderRadius: '4px',
                                                fontSize: '0.68rem',
                                                fontWeight: 800
                                              }}>
                                                Pending Teacher
                                              </span>
                                            )}
                                          </div>

                                          {/* Bottom row: Span info & quick edit/delete/lock */}
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                                            <span style={{ 
                                              fontSize: '0.62rem', 
                                              fontWeight: 700, 
                                              color: isSessional ? '#7e22ce' : '#64748b' 
                                            }}>
                                              {span === 3 ? 'Lab (3h)' : span === 2 ? 'Theory (2h)' : '1h'}
                                            </span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                              {/* Lock / Unlock Toggle Button */}
                                              <button
                                                type="button"
                                                title={isLocked ? "Unlock Slot" : "Lock Slot"}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleLockSlot(slotStartingHere.id);
                                                }}
                                                style={{
                                                  background: isLocked ? '#fef3c7' : 'none',
                                                  border: isLocked ? '1px solid #f59e0b' : 'none',
                                                  borderRadius: '4px',
                                                  padding: '2px',
                                                  cursor: 'pointer',
                                                  color: isLocked ? '#d97706' : '#94a3b8'
                                                }}
                                              >
                                                {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                              </button>

                                              <button
                                                type="button"
                                                title="Edit slot details"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenEditSlotModal(slotStartingHere);
                                                }}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  padding: '2px',
                                                  cursor: 'pointer',
                                                  color: '#6366f1'
                                                }}
                                              >
                                                <Edit3 size={12} />
                                              </button>
                                              
                                              <button
                                                type="button"
                                                title="Remove slot"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteSlot(slotStartingHere.id);
                                                }}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  padding: '2px',
                                                  cursor: 'pointer',
                                                  color: '#ef4444'
                                                }}
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }

                                  // Empty Slot Cell (Drop Target)
                                  return (
                                    <td 
                                      key={`empty-${dayObj.name}-${sem.semesterId}-${period.id}`}
                                      onClick={() => handleOpenAddSlotModal(dayObj.name, sem.semesterId, period.id)}
                                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                      onDragEnter={(e) => { e.preventDefault(); setDragOverCell({ day: dayObj.name, semesterId: sem.semesterId, periodId: period.id }); }}
                                      onDragLeave={() => setDragOverCell(null)}
                                      onDrop={(e) => handleCellDrop(e, dayObj.name, sem.semesterId, period.id)}
                                      title={`Drag a course here or click to schedule on ${dayObj.name} (${period.label}) for ${sem.shortTerm || sem.termCode}`}
                                      style={{
                                        padding: '0.4rem',
                                        textAlign: 'center',
                                        borderRight: '1px solid #e2e8f0',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        background: isCellDragTarget ? '#e0e7ff' : 'transparent',
                                        outline: isCellDragTarget ? '2px dashed #6366f1' : 'none'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!dragOverCell) e.currentTarget.style.background = '#f1f5f9';
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!dragOverCell) e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      <span style={{ 
                                        color: isCellDragTarget ? '#4f46e5' : '#cbd5e1', 
                                        fontSize: '0.85rem', 
                                        fontWeight: isCellDragTarget ? 800 : 400,
                                        userSelect: 'none' 
                                      }}>
                                        +
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Official Timetable Footer & Chairman's Signature Block */}
                <div 
                  className="official-routine-footer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginTop: '1.25rem',
                    padding: '1.25rem 1.5rem',
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1.5px solid #cbd5e1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Academic Notes */}
                  <div style={{ maxWidth: '480px', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                      Official Academic Notes & Timetable Rules:
                    </div>
                    <div>1. Class duration is 1 hour per period for Theory courses and 3 consecutive hours for Lab/Sessional blocks.</div>
                    <div>2. Protected Break is observed daily across all semesters from 01:00 PM to 02:00 PM (No classes scheduled).</div>
                    <div>3. This official departmental routine has been prepared and published for university circulation and notice boards.</div>
                  </div>

                  {/* Chairman Signature Area (Bottom-Right Corner) */}
                  <div 
                    className="chairman-signature-block"
                    style={{
                      textAlign: 'center',
                      minWidth: '280px',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    <div style={{ height: '55px' }}>
                      {/* Blank whitespace for authentic handwritten signature */}
                    </div>
                    <div style={{ 
                      borderTop: '1.5px solid #0f172a', 
                      paddingTop: '6px', 
                      fontWeight: 900, 
                      fontSize: '0.88rem', 
                      color: '#0f172a' 
                    }}>
                      Chairman
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 700, marginTop: '2px' }}>
                      Department of Computer Science and Engineering
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                      Pabna University of Science and Technology
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS INTEGRATION */}
      {/* ========================================================================= */}

      {/* 0. MANUAL SCHEDULE MODAL */}
      <ManualScheduleModal 
        isOpen={isManualScheduleModalOpen}
        onClose={() => setIsManualScheduleModalOpen(false)}
        semesters={activeRoutine?.semesters || []}
        currentSchedule={activeRoutine?.schedule || []}
        initialSemesterId={manualScheduleInitialSemId}
        initialCourseId={manualScheduleInitialCourseId}
        onSaveSlot={handleSaveManualSlot}
      />

      {/* 1. AUTO SCHEDULE MODAL */}
      <AutoScheduleModal 
        isOpen={isAutoScheduleModalOpen}
        onClose={() => setIsAutoScheduleModalOpen(false)}
        activeRoutine={activeRoutine}
        semesters={activeRoutine?.semesters || []}
        currentSchedule={activeRoutine?.schedule || []}
        onApplySchedule={handleApplyAutoSchedule}
        onApplyGeneratedSchedule={handleApplyAutoSchedule}
      />

      {/* 2. PUBLISH SUMMARY MODAL */}
      <PublishSummaryModal 
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onConfirmPublish={handleConfirmPublish}
        currentRoutine={activeRoutine}
        originalRoutine={originalRoutine}
        isPublishing={isPublishing}
      />

      {/* 3. ROUTINE HISTORY MODAL */}
      <RoutineHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        routineId={activeRoutine?.id}
        currentRoutine={activeRoutine}
        onRestoreVersion={handleRestoreVersion}
        onExportWord={handleExportWord}
      />

      {/* 4. COURSE FORM MODAL */}
      <CourseFormModal 
        isOpen={isCourseFormModalOpen}
        onClose={() => {
          setIsCourseFormModalOpen(false);
          setEditingCourseTarget(null);
        }}
        onSaveCourse={handleSaveCourse}
        editingCourse={editingCourseTarget}
        semesterName={activeSemester?.semesterName}
      />

      {/* 5. COPY SEMESTER MODAL */}
      <CopySemesterModal 
        isOpen={isCopySemesterModalOpen}
        onClose={() => setIsCopySemesterModalOpen(false)}
        onConfirmCopy={handleConfirmCopySemester}
        currentSemester={activeSemester}
        availableSemesters={activeRoutine?.semesters || []}
      />

      {/* 6. TEACHER ASSIGNMENT MODAL */}
      {teacherModalState && (
        <TeacherAssignmentModal 
          isOpen={Boolean(teacherModalState)}
          onClose={() => setTeacherModalState(null)}
          course={teacherModalState.course}
          targetCourse={teacherModalState.course}
          initialTeacher={teacherModalState.initialTeacher}
          deptTeachers={deptTeachers}
          onSaveAssignment={handleSaveTeacherAssignment}
          onSaveTeacherAssignment={handleSaveTeacherAssignment}
        />
      )}

      {/* 7. CREATE NEW ROUTINE MODAL */}
      {isCreateModalOpen && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              animation: 'fadeInUp 0.25s ease-out'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <PlusCircle size={22} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Create New Routine</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRoutineSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Routine Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE Class Routine - Spring 2027"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Academic Session *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Session 2026-2027"
                  value={createForm.academicYear}
                  onChange={(e) => setCreateForm({ ...createForm, academicYear: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Effective Date
                </label>
                <input
                  type="date"
                  value={createForm.effectiveFrom}
                  onChange={(e) => setCreateForm({ ...createForm, effectiveFrom: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRoutine}
                  style={{ padding: '0.55rem 1.35rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {creatingRoutine ? 'Creating...' : 'Create Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. ADD SEMESTER MODAL */}
      {isAddSemesterModalOpen && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              animation: 'fadeInUp 0.25s ease-out'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Layers size={22} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Add Semester Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSemesterModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSemesterSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Select Session *
                </label>
                <select
                  value={selectedSessionForAdd}
                  onChange={(e) => {
                    setSelectedSessionForAdd(e.target.value);
                    const sess = academicTree.find(s => s.id === e.target.value);
                    if (sess && sess.semesters && sess.semesters[0]) {
                      setSelectedSemesterIdForAdd(sess.semesters[0].id);
                    }
                  }}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', background: '#ffffff' }}
                >
                  {academicTree.map(s => (
                    <option key={s.id} value={s.id}>{s.sessionName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Select Semester *
                </label>
                <select
                  value={selectedSemesterIdForAdd}
                  onChange={(e) => setSelectedSemesterIdForAdd(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', background: '#ffffff' }}
                >
                  {semestersForSelectedSession.length === 0 ? (
                    <option value="">No semesters found in this session</option>
                  ) : (
                    semestersForSelectedSession.map(sm => (
                      <option key={sm.id} value={sm.id}>
                        {sm.semesterName} ({sm.shortTerm || sm.termCode}) - {sm.courseCount || 0} Courses
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setIsAddSemesterModalOpen(false)}
                  style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSemester}
                  style={{ padding: '0.55rem 1.35rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {addingSemester ? 'Adding...' : 'Add Semester'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. SLOT CREATE / EDIT MODAL */}
      {slotModalState && slotModalState.isOpen && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              animation: 'fadeInUp 0.25s ease-out'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock size={22} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {slotModalState.mode === 'EDIT' ? 'Edit Class Slot' : 'Schedule New Class Period'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSlotModalState(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Conflict alert preview */}
              {candidateConflict && candidateConflict.hasConflict && (
                <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  <span>{candidateConflict.message}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Semester *
                  </label>
                  <select
                    value={slotModalState.semesterId}
                    onChange={(e) => handleSlotSemesterChange(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {(activeRoutine.semesters || []).map(s => (
                      <option key={s.semesterId} value={s.semesterId}>
                        {s.semesterName} ({s.shortTerm || s.termCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Course *
                  </label>
                  <select
                    value={slotModalState.courseId}
                    onChange={(e) => handleSlotCourseChange(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {((activeRoutine.semesters.find(s => s.semesterId === slotModalState.semesterId)?.courses) || []).map(c => (
                      <option key={c.courseId || c.id} value={c.courseId || c.id}>
                        {c.courseCode} - {c.courseTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Day *
                  </label>
                  <select
                    value={slotModalState.day}
                    onChange={(e) => setSlotModalState({ ...slotModalState, day: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {SCHEDULE_DAYS.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Starting Period *
                  </label>
                  <select
                    value={slotModalState.startPeriodId}
                    onChange={(e) => setSlotModalState({ ...slotModalState, startPeriodId: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {SCHEDULE_PERIODS.filter(p => !p.isBreak).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.startTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Duration / Span *
                  </label>
                  <select
                    value={slotModalState.span}
                    onChange={(e) => setSlotModalState({ ...slotModalState, span: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    <option value={1}>1 Hour (1 Period)</option>
                    <option value={2}>2 Hours (2 Periods)</option>
                    <option value={3}>3 Hours (Lab Block)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Room Allocation *
                  </label>
                  <select
                    value={slotModalState.room}
                    onChange={(e) => setSlotModalState({ ...slotModalState, room: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {COMMON_ROOMS.map(rm => (
                      <option key={rm} value={rm}>{rm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Teacher Assigned
                  </label>
                  <div style={{ padding: '0.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    {slotModalState.teacherShortCode || slotModalState.teacherName || 'Not Assigned'}
                  </div>
                </div>
              </div>

              {/* Locked checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="slotLockCheckbox"
                  checked={Boolean(slotModalState.isLocked)}
                  onChange={(e) => setSlotModalState({ ...slotModalState, isLocked: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="slotLockCheckbox" style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Lock size={14} color="#d97706" /> Lock this slot (Preserves slot when auto-scheduling)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setSlotModalState(null)}
                  style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlot}
                  style={{ padding: '0.55rem 1.35rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  <Check size={16} /> {slotModalState.mode === 'EDIT' ? 'Save Changes' : 'Add to Schedule'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 10. CONFLICTS LIST MODAL */}
      {isConflictListModalOpen && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: '#dc2626',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={22} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Schedule Conflicts</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConflictListModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {entireConflicts.map((cf, idx) => (
                <div key={idx} style={{ padding: '0.85rem 1rem', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span className="badge" style={{ background: '#b91c1c', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800 }}>
                      {cf.type.replace('_', ' ')}
                    </span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', marginTop: '0.25rem' }}>
                      {cf.message}
                    </div>
                  </div>
                  {cf.slotIds?.[0] && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteSlot(cf.slotIds[0]);
                      }}
                      style={{ background: '#ffffff', border: '1px solid #f87171', color: '#b91c1c', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsConflictListModalOpen(false)}
                style={{ padding: '0.45rem 1.15rem', borderRadius: '8px', border: 'none', background: '#334155', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. FACULTY WORKLOAD OVERVIEW MODAL */}
      {isWorkloadModalOpen && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={22} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Faculty Workload Overview</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkloadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {Object.values(teacherWorkloadMap).map((tw, idx) => (
                  <div key={idx} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fafbfc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>{tw.teacherName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{tw.department} • {tw.designation || 'Faculty'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                        <span className="badge" style={{ background: '#6366f1', color: '#ffffff', fontSize: '0.7rem', fontWeight: 800 }}>
                          {tw.weeklyHours}h / week
                        </span>
                        <div style={{ display: 'flex', gap: '4px', fontSize: '0.66rem', fontWeight: 800 }}>
                          <span style={{ color: '#059669', background: '#ecfdf5', padding: '1px 4px', borderRadius: '4px' }}>
                            Filled: {tw.scheduledHours}h
                          </span>
                          <span style={{ color: tw.remainingHours === 0 ? '#059669' : '#d97706', background: tw.remainingHours === 0 ? '#ecfdf5' : '#fffbeb', padding: '1px 4px', borderRadius: '4px' }}>
                            {tw.remainingHours === 0 ? '✓ Complete' : `${tw.remainingHours}h left`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {tw.courses.map((cs, cIdx) => (
                        <div key={cIdx} style={{ fontSize: '0.74rem', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{cs.courseCode} ({cs.termCode})</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>
                              {cs.scheduledHours}/{cs.weeklyHours}h
                            </span>
                            <span style={{ fontWeight: 700, color: cs.remainingHours === 0 ? '#059669' : '#d97706', fontSize: '0.68rem' }}>
                              ({cs.remainingHours === 0 ? '✓' : `${cs.remainingHours}h left`})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsWorkloadModalOpen(false)}
                style={{ padding: '0.45rem 1.15rem', borderRadius: '8px', border: 'none', background: '#334155', color: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. DELETE ROUTINE CONFIRMATION MODAL */}
      {deleteTargetRoutine && (
        <div 
          className="modal-backdrop-custom"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#dc2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Confirm Deletion</h3>
            </div>
            <p style={{ margin: '0.85rem 0 1.25rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete routine <strong>"{deleteTargetRoutine.title}"</strong>? This will permanently remove its routine schedules.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteTargetRoutine(null)}
                disabled={deletingRoutine}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRoutine}
                disabled={deletingRoutine}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                {deletingRoutine ? 'Deleting...' : 'Delete Routine'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
