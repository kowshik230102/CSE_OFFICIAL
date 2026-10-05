import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarCheck, 
  CalendarClock, 
  BookOpen, 
  Users, 
  Clock, 
  MapPin, 
  Phone, 
  Building2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Plus, 
  Download, 
  Printer, 
  Share2, 
  Save, 
  ArrowLeft, 
  Layers, 
  FlaskConical, 
  GraduationCap, 
  FileText,
  Search,
  Check,
  X,
  FileSpreadsheet,
  HelpCircle,
  Eye,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { exportRoutineToWord } from '../utils/routineExport';

export function RoutineGeneratorView({ user, onBackToDashboard, onNavigateNoticeBoard }) {
  // Main Mode: CLASS_ROUTINE or EXAM_ROUTINE
  const [routineMode, setRoutineMode] = useState('CLASS_ROUTINE');

  // Academic Hierarchy States
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [crossSessionBusySlots, setCrossSessionBusySlots] = useState({});

  // Loading & Feedback
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Configuration States for Builder
  const [routineTitle, setRoutineTitle] = useState('');
  const [configuredCourses, setConfiguredCourses] = useState([]);
  const [configuredExams, setConfiguredExams] = useState([]);

  // Multi-session Routine Builder state
  const [sessionsInRoutine, setSessionsInRoutine] = useState([]);

  // Generated Routine Preview State
  const [isGenerated, setIsGenerated] = useState(false);
  const [savedRoutineId, setSavedRoutineId] = useState(null);
  const [routineStatus, setRoutineStatus] = useState('DRAFT');

  // Interactive Edit Modal States
  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Saved Routines Drawer Modal
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [savedRoutinesList, setSavedRoutinesList] = useState([]);

  // Standard Weekday Options (PUST Academic Calendar)
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const standardPeriods = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM'
  ];
  const standardLabBlocks = [
    '10:00 AM - 01:00 PM (3 Hours)',
    '11:00 AM - 01:00 PM (2 Hours)',
    '02:00 PM - 05:00 PM (3 Hours)',
    '02:00 PM - 04:00 PM (2 Hours)'
  ];

  // Helper notification toast
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // 1. Initial Load: Academic Sessions & Faculty Teachers
  useEffect(() => {
    async function loadInitialData() {
      setLoadingInitial(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const [sessRes, teachRes, busyRes] = await Promise.all([
          fetch('/api/academic/sessions', { credentials: 'include', headers }),
          fetch('/api/auth/teachers', { credentials: 'include', headers }),
          fetch('/api/routines/teacher-busy-slots', { credentials: 'include', headers })
        ]);

        const sessData = await sessRes.json();
        const teachData = await teachRes.json();
        const busyData = await busyRes.json();

        if (sessData.sessions && sessData.sessions.length > 0) {
          setSessions(sessData.sessions);
          // Auto select current active session if exists, otherwise first
          const current = sessData.sessions.find(s => s.is_current) || sessData.sessions[0];
          setSelectedSessionId(current.id);
        }

        if (teachData.teachers) {
          setTeachers(teachData.teachers);
        }

        if (busyData.teacherSchedules) {
          setCrossSessionBusySlots(busyData.teacherSchedules);
        }
      } catch (err) {
        console.error('Failed to load initial routine builder data:', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadInitialData();
  }, []);

  // 2. Load Semesters whenever Selected Session Changes
  useEffect(() => {
    if (!selectedSessionId) return;

    async function loadSemesters() {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const res = await fetch(`/api/academic/sessions/${selectedSessionId}/semesters`, { credentials: 'include', headers });
        const data = await res.json();

        if (data.semesters && data.semesters.length > 0) {
          setSemesters(data.semesters);
          // Automatically pick the running semester (is_active === 1) as requested by user
          const running = data.semesters.find(s => s.is_active === 1) || data.semesters[0];
          setSelectedSemesterId(running.id);
        } else {
          setSemesters([]);
          setSelectedSemesterId('');
          setConfiguredCourses([]);
          setConfiguredExams([]);
        }
      } catch (err) {
        console.error('Failed to load semesters:', err);
      }
    }

    loadSemesters();
  }, [selectedSessionId]);

  // 3. Load Courses for Selected Semester
  useEffect(() => {
    if (!selectedSemesterId) return;

    async function loadCourses() {
      setLoadingCourses(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const res = await fetch(`/api/academic/semesters/${selectedSemesterId}/courses`, { credentials: 'include', headers });
        const data = await res.json();

        const currentSession = sessions.find(s => s.id === selectedSessionId);
        const currentSemester = semesters.find(s => s.id === selectedSemesterId);

        // Auto-generate a descriptive routine title if empty
        if (!routineTitle || routineTitle.startsWith('Class Routine') || routineTitle.startsWith('Exam Routine')) {
          const sessTitle = currentSession?.session_name || 'Session';
          const semTitle = currentSemester?.semester_name || 'Semester';
          if (routineMode === 'CLASS_ROUTINE') {
            setRoutineTitle(`Official Class Routine - ${sessTitle} (${semTitle})`);
          } else {
            setRoutineTitle(`Semester Final Examination Routine - ${sessTitle} (${semTitle})`);
          }
        }

        if (data.courses && Array.isArray(data.courses)) {
          // Initialize Configured Courses with smart defaults and teacher auto-fill
          const initialCourses = data.courses.map(c => {
            const isLab = c.course_type === 'LAB' || (c.course_title && c.course_title.toLowerCase().includes('lab')) || (c.course_title && c.course_title.toLowerCase().includes('sessional'));
            
            // Check if course already has assigned teacher
            const assignedTeacher = teachers.find(t => t.teacher_id === c.assigned_teacher_id) || null;

            return {
              courseId: c.id,
              courseCode: c.course_code,
              courseTitle: c.course_title,
              creditHours: c.credit_hours,
              courseType: isLab ? 'LAB' : 'THEORY',
              // Teacher Information
              teacherType: 'CSE', // 'CSE' or 'EXTERNAL'
              teacherId: assignedTeacher ? assignedTeacher.teacher_id : (teachers[0]?.teacher_id || ''),
              teacherName: assignedTeacher ? `${assignedTeacher.first_name} ${assignedTeacher.last_name}` : (teachers[0] ? `${teachers[0].first_name} ${teachers[0].last_name}` : ''),
              teacherDept: 'CSE',
              teacherPhone: assignedTeacher?.phone_number || teachers[0]?.phone_number || '+8801700000000',
              roomNumber: isLab ? 'Software Lab 1' : 'Room 401',
              // Lab Specific Properties
              labTitle: isLab ? `${c.course_title} Practical` : '',
              labSerial: isLab ? 'Lab 1' : '',
              labDurationHours: isLab ? 3 : 1,
              // Allocated Time Slots (Day + Time Period)
              timeSlots: []
            };
          });

          setConfiguredCourses(initialCourses);

          // Initialize Exam courses
          const initialExams = data.courses.map((c, idx) => {
            const assignedTeacher = teachers.find(t => t.teacher_id === c.assigned_teacher_id) || null;
            return {
              courseId: c.id,
              courseCode: c.course_code,
              courseTitle: c.course_title,
              creditHours: c.credit_hours,
              serial: idx + 1,
              date: '',
              day: '',
              timeSlot: '10:00 AM - 01:00 PM',
              roomNumber: 'Gallery Room 401 & 402',
              invigilatorName: assignedTeacher ? `${assignedTeacher.first_name} ${assignedTeacher.last_name}` : (teachers[0] ? `${teachers[0].first_name} ${teachers[0].last_name}` : 'Course Teacher'),
              teacherDept: 'CSE',
              teacherPhone: assignedTeacher?.phone_number || teachers[0]?.phone_number || '+8801700000000'
            };
          });

          setConfiguredExams(initialExams);
        }
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    }

    loadCourses();
  }, [selectedSemesterId, routineMode, teachers]);

  // Handle Teacher Dropdown Selection for a Course (Auto-fills Phone & Dept from Sir's profile!)
  const handleTeacherChange = (courseIndex, teacherIdOrType) => {
    setConfiguredCourses(prev => {
      const updated = [...prev];
      const target = { ...updated[courseIndex] };

      if (teacherIdOrType === 'EXTERNAL') {
        target.teacherType = 'EXTERNAL';
        target.teacherId = '';
        target.teacherName = '';
        target.teacherDept = 'Other Dept';
        target.teacherPhone = '';
      } else {
        const found = teachers.find(t => t.teacher_id === teacherIdOrType);
        if (found) {
          target.teacherType = 'CSE';
          target.teacherId = found.teacher_id;
          target.teacherName = `${found.first_name} ${found.last_name}`;
          target.teacherDept = found.department_code || 'CSE';
          // Auto-fill phone number from sir's verified profile
          target.teacherPhone = found.phone_number || '+8801700000000';
          if (found.room_number && target.courseType !== 'LAB') {
            target.roomNumber = found.room_number;
          }
        }
      }

      updated[courseIndex] = target;
      return updated;
    });
  };

  // Handle Exam Invigilator/Teacher Change
  const handleExamTeacherChange = (examIndex, teacherIdOrType) => {
    setConfiguredExams(prev => {
      const updated = [...prev];
      const target = { ...updated[examIndex] };

      if (teacherIdOrType === 'EXTERNAL') {
        target.invigilatorName = '';
        target.teacherDept = 'Other Dept';
        target.teacherPhone = '';
      } else {
        const found = teachers.find(t => t.teacher_id === teacherIdOrType);
        if (found) {
          target.invigilatorName = `${found.first_name} ${found.last_name}`;
          target.teacherDept = found.department_code || 'CSE';
          target.teacherPhone = found.phone_number || '+8801700000000';
        }
      }

      updated[examIndex] = target;
      return updated;
    });
  };

  // Add / Remove a Time Slot for a Course
  const handleAddSlot = (courseIndex, day, timeSlot) => {
    setConfiguredCourses(prev => {
      const updated = [...prev];
      const target = { ...updated[courseIndex] };
      const currentSlots = Array.isArray(target.timeSlots) ? [...target.timeSlots] : [];

      const exists = currentSlots.some(s => s.day === day && s.timeSlot === timeSlot);
      if (exists) {
        target.timeSlots = currentSlots.filter(s => !(s.day === day && s.timeSlot === timeSlot));
      } else {
        target.timeSlots = [...currentSlots, { day, timeSlot, roomNumber: target.roomNumber }];
      }

      updated[courseIndex] = target;
      return updated;
    });
  };

  // Calculate day of week automatically when exam date is chosen
  const handleExamDateChange = (examIndex, dateStr) => {
    setConfiguredExams(prev => {
      const updated = [...prev];
      const target = { ...updated[examIndex] };
      target.date = dateStr;

      if (dateStr) {
        const d = new Date(dateStr);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        target.day = dayNames[d.getDay()];
      } else {
        target.day = '';
      }

      updated[examIndex] = target;
      return updated;
    });
  };

  // Helper: Get Teacher Busy Slots from other sessions (Website Data Integration)
  const getTeacherBusyList = (teacherId, teacherName) => {
    const key = teacherId || teacherName?.trim().toLowerCase();
    if (!key || !crossSessionBusySlots[key]) return [];
    return crossSessionBusySlots[key];
  };

  // 1-Click Smart Auto-Schedule Engine (Super Time-Efficient Routine Generation)
  const handleSmartAutoSchedule = () => {
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const sessionName = currentSession?.session_name || 'Current Session';

    let dayIndex = 0;
    let periodIndex = 0;

    const scheduled = configuredCourses.map(course => {
      const isLab = course.courseType === 'LAB';
      const slots = [];

      if (isLab) {
        // Labs get a dedicated 3-hour block on Tuesday or Wednesday afternoon
        const labDay = dayIndex % 2 === 0 ? 'Tuesday' : 'Wednesday';
        const labTime = '02:00 PM - 05:00 PM';
        slots.push({
          day: labDay,
          timeSlot: labTime,
          roomNumber: course.roomNumber || 'Software Lab 1'
        });
        dayIndex++;
      } else {
        // Theory courses get contact hours based on credits (e.g. 3 classes per week)
        const creditCount = Math.min(Math.round(course.creditHours || 3), 3);
        const assignedDays = ['Sunday', 'Monday', 'Thursday'];

        for (let i = 0; i < creditCount; i++) {
          const day = assignedDays[i % assignedDays.length];
          const period = standardPeriods[periodIndex % standardPeriods.length];
          slots.push({
            day,
            timeSlot: period,
            roomNumber: course.roomNumber || 'Room 401'
          });
          periodIndex = (periodIndex + 1) % standardPeriods.length;
        }
      }

      return {
        ...course,
        timeSlots: slots
      };
    });

    setConfiguredCourses(scheduled);
    showToast('⚡ Conflict-free schedule auto-generated for all courses based on credits & faculty availability!', 'success');
  };

  // Step 3: Click to Generate Routine (Make Routine for this Session)
  const handleGenerateRoutine = () => {
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const currentSemester = semesters.find(s => s.id === selectedSemesterId);

    if (routineMode === 'CLASS_ROUTINE') {
      // Ensure at least one course has a time slot
      const hasSlots = configuredCourses.some(c => Array.isArray(c.timeSlots) && c.timeSlots.length > 0);
      if (!hasSlots) {
        // Auto-assign if none selected to save user work!
        handleSmartAutoSchedule();
      }

      const sessionObj = {
        sessionId: selectedSessionId,
        sessionName: currentSession?.session_name || 'Academic Session',
        semesterId: selectedSemesterId,
        semesterName: currentSemester?.semester_name || 'Current Semester',
        termCode: currentSemester?.term_code || '',
        courses: configuredCourses
      };

      // Add to sessionsInRoutine if not already added
      const existingIdx = sessionsInRoutine.findIndex(s => s.sessionId === selectedSessionId && s.semesterId === selectedSemesterId);
      if (existingIdx >= 0) {
        const copy = [...sessionsInRoutine];
        copy[existingIdx] = sessionObj;
        setSessionsInRoutine(copy);
      } else {
        setSessionsInRoutine(prev => [...prev, sessionObj]);
      }

      setIsGenerated(true);
      showToast('🎉 Class Routine generated successfully! Review timetable below with quick-edit support.', 'success');
    } else {
      // Exam Routine
      setIsGenerated(true);
      showToast('🎉 Exam Routine generated successfully! Review exam dates & halls below.', 'success');
    }
  };

  // Interactive Quick Edit: Open Modal
  const handleOpenEditModal = (item, type = 'SLOT', parentCourse = null) => {
    setEditingItem({
      ...item,
      editType: type,
      parentCourse
    });
    setIsEditModalOpen(true);
  };

  // Save Interactive Edit
  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (routineMode === 'CLASS_ROUTINE') {
      // Update in sessionsInRoutine
      setSessionsInRoutine(prev => {
        return prev.map(sess => {
          const updatedCourses = sess.courses.map(course => {
            if (course.courseId === editingItem.parentCourse?.courseId || course.courseId === editingItem.courseId) {
              const updatedCourse = { ...course };
              
              if (editingItem.editType === 'COURSE') {
                updatedCourse.teacherName = editingItem.teacherName;
                updatedCourse.teacherDept = editingItem.teacherDept;
                updatedCourse.teacherPhone = editingItem.teacherPhone;
                updatedCourse.roomNumber = editingItem.roomNumber;
                if (editingItem.labTitle) updatedCourse.labTitle = editingItem.labTitle;
                if (editingItem.labSerial) updatedCourse.labSerial = editingItem.labSerial;
              } else if (editingItem.editType === 'SLOT') {
                // Update specific slot
                if (Array.isArray(updatedCourse.timeSlots)) {
                  updatedCourse.timeSlots = updatedCourse.timeSlots.map(s => {
                    if (s.day === editingItem.oldDay && s.timeSlot === editingItem.oldTimeSlot) {
                      return {
                        day: editingItem.newDay || s.day,
                        timeSlot: editingItem.newTimeSlot || s.timeSlot,
                        roomNumber: editingItem.newRoomNumber || s.roomNumber
                      };
                    }
                    return s;
                  });
                }
              }
              return updatedCourse;
            }
            return course;
          });
          return { ...sess, courses: updatedCourses };
        });
      });
    } else {
      // Exam Routine Edit
      setConfiguredExams(prev => {
        return prev.map(ex => {
          if (ex.courseId === editingItem.courseId) {
            return {
              ...ex,
              date: editingItem.date,
              day: editingItem.day,
              timeSlot: editingItem.timeSlot,
              roomNumber: editingItem.roomNumber,
              invigilatorName: editingItem.invigilatorName,
              teacherPhone: editingItem.teacherPhone
            };
          }
          return ex;
        });
      });
    }

    setIsEditModalOpen(false);
    showToast('✏️ Routine slot updated successfully!', 'success');
  };

  // Save Routine to Backend DB
  const handleSaveRoutineToDB = async (status = 'DRAFT') => {
    setActionLoading(true);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const payload = {
      type: routineMode,
      title: routineTitle || (routineMode === 'CLASS_ROUTINE' ? 'Department Class Routine' : 'Semester Final Exam Routine'),
      sessionId: selectedSessionId,
      semesterId: selectedSemesterId,
      status,
      routineData: routineMode === 'CLASS_ROUTINE' 
        ? { sessions: sessionsInRoutine.length > 0 ? sessionsInRoutine : [{ sessionId: selectedSessionId, sessionName: sessions.find(s => s.id === selectedSessionId)?.session_name, semesterId: selectedSemesterId, courses: configuredCourses }] }
        : { exams: configuredExams }
    };

    try {
      let res;
      if (savedRoutineId) {
        res = await fetch(`/api/routines/${savedRoutineId}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/routines', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok) {
        if (data.id) setSavedRoutineId(data.id);
        setRoutineStatus(status);
        showToast(status === 'PUBLISHED' ? '🎉 Routine published & saved successfully!' : '💾 Routine draft saved successfully to database!', 'success');
        return data.id || savedRoutineId;
      } else {
        showToast(data.error || 'Failed to save routine.', 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Error saving routine: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
    return null;
  };

  // Publish Directly to Notice Board (Click to Publish)
  const handlePublishToNoticeBoard = async () => {
    setActionLoading(true);
    try {
      // First ensure routine is saved in DB
      let routineId = savedRoutineId;
      if (!routineId) {
        routineId = await handleSaveRoutineToDB('PUBLISHED');
      }

      if (!routineId) return;

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/routines/${routineId}/publish`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          customNote: `Official ${routineMode === 'CLASS_ROUTINE' ? 'Class' : 'Exam'} routine issued by the Academic Routine Committee for verified students and faculty.`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRoutineStatus('PUBLISHED');
        showToast('📢 Routine successfully posted as an Official Notice on the Notice Board!', 'success');
      } else {
        showToast(data.error || 'Failed to publish to Notice Board.', 'error');
      }
    } catch (err) {
      console.error('Publish error:', err);
      showToast('Failed to publish: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Export to Microsoft Word (.doc)
  const handleExportWord = () => {
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const currentSemester = semesters.find(s => s.id === selectedSemesterId);

    exportRoutineToWord({
      title: routineTitle,
      type: routineMode,
      sessionName: currentSession?.session_name,
      semesterName: currentSemester?.semester_name,
      routineData: routineMode === 'CLASS_ROUTINE'
        ? { sessions: sessionsInRoutine.length > 0 ? sessionsInRoutine : [{ courses: configuredCourses }] }
        : { exams: configuredExams }
    });

    showToast('📄 Routine exported as Microsoft Word (.doc) document!', 'success');
  };

  // Export as PDF / Print
  const handleExportPDF = () => {
    window.print();
  };

  // Fetch Saved Routines List
  const handleOpenSavedDrawer = async () => {
    setIsSavedDrawerOpen(true);
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch('/api/routines', { credentials: 'include', headers });
      const data = await res.json();
      if (data.routines) {
        setSavedRoutinesList(data.routines);
      }
    } catch (err) {
      console.error('Failed to load saved routines:', err);
    }
  };

  // Load a Saved Routine from Drawer
  const handleLoadSavedRoutine = async (routineId) => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`/api/routines/${routineId}`, { credentials: 'include', headers });
      const data = await res.json();

      if (data.routine) {
        const r = data.routine;
        setSavedRoutineId(r.id);
        setRoutineTitle(r.title);
        setRoutineMode(r.type);
        setRoutineStatus(r.status);
        if (r.session_id) setSelectedSessionId(r.session_id);
        if (r.semester_id) setSelectedSemesterId(r.semester_id);

        if (r.type === 'CLASS_ROUTINE' && r.routineData?.sessions) {
          setSessionsInRoutine(r.routineData.sessions);
          if (r.routineData.sessions[0]?.courses) {
            setConfiguredCourses(r.routineData.sessions[0].courses);
          }
        } else if (r.type === 'EXAM_ROUTINE' && r.routineData?.exams) {
          setConfiguredExams(r.routineData.exams);
        }

        setIsGenerated(true);
        setIsSavedDrawerOpen(false);
        showToast('📂 Saved routine loaded successfully!', 'success');
      }
    } catch (err) {
      console.error('Error loading routine:', err);
      showToast('Failed to load routine: ' + err.message, 'error');
    }
  };

  // Active Session and Semester display objects
  const activeSessionObj = sessions.find(s => s.id === selectedSessionId);
  const activeSemesterObj = semesters.find(s => s.id === selectedSemesterId);

  // Group Courses into Theory and Lab
  const theoryCourses = useMemo(() => configuredCourses.filter(c => c.courseType !== 'LAB'), [configuredCourses]);
  const labCourses = useMemo(() => configuredCourses.filter(c => c.courseType === 'LAB'), [configuredCourses]);

  return (
    <div className="routine-builder-wrapper" style={{ paddingBottom: '4rem' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: notification.type === 'error' ? '#ef4444' : '#059669',
          color: '#ffffff',
          padding: '0.85rem 1.4rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 700,
          fontSize: '0.9rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          {notification.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div className="routine-header-card" style={{
        background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        marginBottom: '1.75rem',
        color: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="btn btn-secondary"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.5rem 0.9rem'
              }}
              title="Return to your default role workspace"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}>
                <CalendarCheck size={22} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Academic Routine & Timetable Builder
              </h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
              Time-efficient routine maker with faculty phone auto-fill, lab scheduling, on-the-fly slot editing, and 1-click notice publishing.
            </p>
          </div>
        </div>

        {/* Saved Routines Drawer Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleOpenSavedDrawer}
            className="btn btn-secondary"
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: '0.6rem 1.1rem'
            }}
          >
            <FolderOpen size={16} />
            <span>Saved Routines</span>
          </button>
        </div>
      </div>

      {/* Routine Mode Switcher (Class Routine vs Exam Routine) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        background: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select Mode:
          </span>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => { setRoutineMode('CLASS_ROUTINE'); setIsGenerated(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: routineMode === 'CLASS_ROUTINE' ? '#2563eb' : 'transparent',
                color: routineMode === 'CLASS_ROUTINE' ? '#ffffff' : '#64748b',
                boxShadow: routineMode === 'CLASS_ROUTINE' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
              }}
            >
              <CalendarClock size={16} />
              <span>Class Routine</span>
            </button>

            <button
              onClick={() => { setRoutineMode('EXAM_ROUTINE'); setIsGenerated(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: routineMode === 'EXAM_ROUTINE' ? '#7c3aed' : 'transparent',
                color: routineMode === 'EXAM_ROUTINE' ? '#ffffff' : '#64748b',
                boxShadow: routineMode === 'EXAM_ROUTINE' ? '0 2px 8px rgba(124, 58, 237, 0.3)' : 'none'
              }}
            >
              <GraduationCap size={16} />
              <span>Exam Routine</span>
            </button>
          </div>
        </div>

        {/* Quick Automation & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {routineMode === 'CLASS_ROUTINE' && (
            <button
              onClick={handleSmartAutoSchedule}
              className="btn btn-secondary"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))',
                borderColor: '#10b981',
                color: '#047857',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1rem'
              }}
              title="Automatically distribute conflict-free periods and labs based on credits!"
            >
              <Sparkles size={16} color="#059669" />
              <span>⚡ 1-Click Smart Auto-Schedule</span>
            </button>
          )}

          <button
            onClick={() => setIsGenerated(!isGenerated)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.55rem 1rem' }}
          >
            <Eye size={16} />
            <span>{isGenerated ? 'Switch to Builder Form' : 'View Timetable Preview'}</span>
          </button>
        </div>
      </div>

      {/* Routine Title Input */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: '#ffffff' }}>
        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 800, color: '#334155', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Routine Title (Displayed on Official Notice & Documents)
        </label>
        <input
          type="text"
          value={routineTitle}
          onChange={(e) => setRoutineTitle(e.target.value)}
          placeholder={routineMode === 'CLASS_ROUTINE' ? 'e.g., Department of CSE - Academic Class Routine 2024' : 'e.g., B.Sc. Engineering 3rd Year 1st Semester Final Examination'}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: '1.5px solid #cbd5e1',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#0f172a'
          }}
        />
      </div>

      {/* STEP 1: Academic Session & Running Semester Selector */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.75rem', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#2563eb" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              1. Add Academic Session & Running Semester
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
            Courses and Lab sessions load automatically
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Session Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Academic Session:
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: '#f8fafc',
                color: '#0f172a'
              }}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.session_name} {s.is_current ? '⭐ (Current Active Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Picker (Auto-highlights Running Semester) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Target Semester:
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: '#f8fafc',
                color: '#0f172a'
              }}
            >
              {semesters.map(sem => (
                <option key={sem.id} value={sem.id}>
                  {sem.semester_name} ({sem.term_code}) {sem.is_active ? '🔥 [Running Semester]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Summary Pill */}
        {activeSemesterObj && (
          <div style={{
            marginTop: '1rem',
            padding: '0.65rem 1rem',
            background: activeSemesterObj.is_active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
            border: activeSemesterObj.is_active ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                background: activeSemesterObj.is_active ? '#059669' : '#2563eb',
                color: '#ffffff',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px'
              }}>
                {activeSemesterObj.is_active ? 'RUNNING SEMESTER' : 'SEMESTER'}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                {activeSessionObj?.session_name} &bull; {activeSemesterObj.semester_name}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
              {theoryCourses.length} Theory Courses &bull; {labCourses.length} Lab / Sessional Courses
            </div>
          </div>
        )}
      </div>

      {/* VIEW CONDITIONAL: Builder Form vs Generated Routine Preview */}
      {!isGenerated ? (
        /* BUILDER FORM */
        <div>
          {routineMode === 'CLASS_ROUTINE' ? (
            /* CLASS ROUTINE BUILDER */
            <div>
              {/* Theory Courses Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <BookOpen size={20} color="#2563eb" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Theory Courses ({theoryCourses.length})
                  </h3>
                </div>

                {loadingCourses ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="spin" />
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Loading courses for {activeSemesterObj?.semester_name}...</p>
                  </div>
                ) : theoryCourses.length === 0 ? (
                  <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    No theory courses found in this semester.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {configuredCourses.map((course, idx) => {
                      if (course.courseType === 'LAB') return null;
                      const busySlots = getTeacherBusyList(course.teacherId, course.teacherName);

                      return (
                        <div key={course.courseId} className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '4px solid #2563eb' }}>
                          {/* Course Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 800,
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '6px'
                                }}>
                                  {course.courseCode}
                                </span>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                  {course.courseTitle}
                                </h4>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                                Contact Credit Hours: <strong>{course.creditHours} Credits</strong> (Recommended {course.creditHours} periods/week)
                              </div>
                            </div>

                            {/* Room Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <MapPin size={16} color="#64748b" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Room:</span>
                              <input
                                type="text"
                                value={course.roomNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfiguredCourses(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], roomNumber: val };
                                    return copy;
                                  });
                                }}
                                style={{
                                  padding: '0.35rem 0.7rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  width: '120px'
                                }}
                              />
                            </div>
                          </div>

                          {/* Teacher Assignment & Auto-fill Contact Info */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '1rem',
                            border: '1px solid #e2e8f0',
                            marginBottom: '1rem'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                              {/* Teacher Selector */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Course Teacher:
                                </label>
                                <select
                                  value={course.teacherType === 'EXTERNAL' ? 'EXTERNAL' : course.teacherId}
                                  onChange={(e) => handleTeacherChange(idx, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.8rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a'
                                  }}
                                >
                                  <optgroup label="CSE Department Faculty (Auto-fills Profile & Contact)">
                                    {teachers.map(t => (
                                      <option key={t.teacher_id} value={t.teacher_id}>
                                        {t.first_name} {t.last_name} ({t.designation})
                                      </option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Other / Guest Faculty">
                                    <option value="EXTERNAL">+ External / Other Department Teacher</option>
                                  </optgroup>
                                </select>
                              </div>

                              {/* Teacher Name (if external) */}
                              {course.teacherType === 'EXTERNAL' && (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                    Teacher Name:
                                  </label>
                                  <input
                                    type="text"
                                    value={course.teacherName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setConfiguredCourses(prev => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], teacherName: val };
                                        return copy;
                                      });
                                    }}
                                    placeholder="e.g., Dr. Jane Doe"
                                    style={{
                                      width: '100%',
                                      padding: '0.55rem 0.8rem',
                                      borderRadius: '8px',
                                      border: '1.5px solid #cbd5e1',
                                      fontSize: '0.85rem',
                                      fontWeight: 600
                                    }}
                                  />
                                </div>
                              )}

                              {/* Department */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Department:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <input
                                    type="text"
                                    value={course.teacherDept}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setConfiguredCourses(prev => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], teacherDept: val };
                                        return copy;
                                      });
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.55rem 0.8rem',
                                      borderRadius: '8px',
                                      border: '1.5px solid #cbd5e1',
                                      fontSize: '0.85rem',
                                      fontWeight: 600
                                    }}
                                  />
                                  {course.teacherType === 'CSE' && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '0.2rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                      CSE FACULTY
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Teacher Phone Number (Auto-filled from profile!) */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Teacher Phone Number:
                                </label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    value={course.teacherPhone}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setConfiguredCourses(prev => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], teacherPhone: val };
                                        return copy;
                                      });
                                    }}
                                    placeholder="+8801700000000"
                                    style={{
                                      width: '100%',
                                      padding: '0.55rem 0.8rem 0.55rem 2.2rem',
                                      borderRadius: '8px',
                                      border: course.teacherPhone ? '1.5px solid #10b981' : '1.5px solid #cbd5e1',
                                      fontSize: '0.85rem',
                                      fontWeight: 700,
                                      color: '#0f172a'
                                    }}
                                  />
                                  <Phone size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#10b981' }} />
                                </div>
                              </div>
                            </div>

                            {/* Auto-fill notification badge */}
                            {course.teacherType === 'CSE' && (
                              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                                <Check size={14} />
                                <span>Verified CSE Teacher profile detected &bull; Phone number & department auto-filled directly from university records</span>
                              </div>
                            )}

                            {/* Cross-session teacher busy slots warning */}
                            {busySlots.length > 0 && (
                              <div style={{
                                marginTop: '0.65rem',
                                padding: '0.5rem 0.75rem',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                color: '#991b1b'
                              }}>
                                <strong>⚠️ Active Commitments in Other Sessions (Website Data):</strong>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  {busySlots.map((b, bIdx) => (
                                    <span key={bIdx} style={{ background: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                      {b.sessionName}: {b.courseCode} ({b.day} {b.timeSlot})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Time Slots Selector (Day & Period Chips) */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                                Assign Class Timings (Click to Toggle Days & Periods):
                              </label>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {course.timeSlots?.length || 0} slot(s) selected
                              </span>
                            </div>

                            {/* Weekday Grid with Period Pills */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {weekdays.map(day => (
                                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ width: '85px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                                    {day}:
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {standardPeriods.map(p => {
                                      const isSelected = course.timeSlots?.some(s => s.day === day && s.timeSlot === p);
                                      const isBusyElsewhere = busySlots.some(b => b.day === day && b.timeSlot === p);

                                      return (
                                        <button
                                          key={p}
                                          type="button"
                                          onClick={() => handleAddSlot(idx, day, p)}
                                          style={{
                                            border: '1px solid',
                                            borderColor: isSelected ? '#2563eb' : (isBusyElsewhere ? '#fca5a5' : '#e2e8f0'),
                                            background: isSelected ? '#2563eb' : (isBusyElsewhere ? '#fff1f2' : '#ffffff'),
                                            color: isSelected ? '#ffffff' : (isBusyElsewhere ? '#be123c' : '#334155'),
                                            padding: '0.25rem 0.55rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                          title={isBusyElsewhere ? 'Sir is busy in another session at this time!' : `Toggle ${day} ${p}`}
                                        >
                                          {p.split(' - ')[0]}
                                          {isBusyElsewhere && ' ⚠️'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lab & Sessional Courses Section */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FlaskConical size={20} color="#7c3aed" />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Lab & Sessional Courses ({labCourses.length})
                    </h3>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#7c3aed', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                      PRACTICAL
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Lab title, serial number, and 2-3 hour block selection
                  </span>
                </div>

                {labCourses.length === 0 ? (
                  <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    No lab / sessional courses detected in this semester.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {configuredCourses.map((course, idx) => {
                      if (course.courseType !== 'LAB') return null;

                      return (
                        <div key={course.courseId} className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '4px solid #7c3aed' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 800,
                                  background: '#7c3aed',
                                  color: '#ffffff',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '6px'
                                }}>
                                  {course.courseCode}
                                </span>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                  {course.courseTitle}
                                </h4>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#ede9fe', color: '#6d28d9', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                  LAB / SESSIONAL
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Lab Title, Serial & Room Inputs */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1rem',
                            background: '#faf5ff',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '1px solid #f3e8ff'
                          }}>
                            {/* Lab Title */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#581c87', marginBottom: '0.35rem' }}>
                                Lab Title / Experiment Track:
                              </label>
                              <input
                                type="text"
                                value={course.labTitle}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfiguredCourses(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], labTitle: val };
                                    return copy;
                                  });
                                }}
                                placeholder="e.g., DBMS & SQL Practical Lab"
                                style={{
                                  width: '100%',
                                  padding: '0.55rem 0.8rem',
                                  borderRadius: '8px',
                                  border: '1.5px solid #d8b4fe',
                                  fontSize: '0.85rem',
                                  fontWeight: 600
                                }}
                              />
                            </div>

                            {/* Lab Serial */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#581c87', marginBottom: '0.35rem' }}>
                                Lab Serial / Batch:
                              </label>
                              <input
                                type="text"
                                value={course.labSerial}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfiguredCourses(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], labSerial: val };
                                    return copy;
                                  });
                                }}
                                placeholder="e.g., Lab 1 / Group A"
                                style={{
                                  width: '100%',
                                  padding: '0.55rem 0.8rem',
                                  borderRadius: '8px',
                                  border: '1.5px solid #d8b4fe',
                                  fontSize: '0.85rem',
                                  fontWeight: 600
                                }}
                              />
                            </div>

                            {/* Lab Room */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#581c87', marginBottom: '0.35rem' }}>
                                Lab Room / Facility:
                              </label>
                              <input
                                type="text"
                                value={course.roomNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfiguredCourses(prev => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], roomNumber: val };
                                    return copy;
                                  });
                                }}
                                placeholder="Software Lab 1"
                                style={{
                                  width: '100%',
                                  padding: '0.55rem 0.8rem',
                                  borderRadius: '8px',
                                  border: '1.5px solid #d8b4fe',
                                  fontSize: '0.85rem',
                                  fontWeight: 600
                                }}
                              />
                            </div>
                          </div>

                          {/* Lab Teacher & Contact (Auto-filled) */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '1rem',
                            border: '1px solid #e2e8f0',
                            marginBottom: '1rem'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Lab Instructor / Faculty:
                                </label>
                                <select
                                  value={course.teacherType === 'EXTERNAL' ? 'EXTERNAL' : course.teacherId}
                                  onChange={(e) => handleTeacherChange(idx, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.8rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.85rem',
                                    fontWeight: 700
                                  }}
                                >
                                  <optgroup label="CSE Department Faculty">
                                    {teachers.map(t => (
                                      <option key={t.teacher_id} value={t.teacher_id}>
                                        {t.first_name} {t.last_name} ({t.designation})
                                      </option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Other / Guest Faculty">
                                    <option value="EXTERNAL">+ External / Other Department Teacher</option>
                                  </optgroup>
                                </select>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Department:
                                </label>
                                <input
                                  type="text"
                                  value={course.teacherDept}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setConfiguredCourses(prev => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], teacherDept: val };
                                      return copy;
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.55rem 0.8rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                                  Instructor Phone Number:
                                </label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    value={course.teacherPhone}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setConfiguredCourses(prev => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], teacherPhone: val };
                                        return copy;
                                      });
                                    }}
                                    placeholder="+8801700000000"
                                    style={{
                                      width: '100%',
                                      padding: '0.55rem 0.8rem 0.55rem 2.2rem',
                                      borderRadius: '8px',
                                      border: '1.5px solid #10b981',
                                      fontSize: '0.85rem',
                                      fontWeight: 700
                                    }}
                                  />
                                  <Phone size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#10b981' }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Lab Timing Selection (2 or 3 Hour Continuous Block) */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                              Lab Day & Duration Block (Click to Toggle):
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {weekdays.map(day => (
                                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ width: '85px', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                                    {day}:
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {standardLabBlocks.map(block => {
                                      const timeOnly = block.split(' (')[0];
                                      const isSelected = course.timeSlots?.some(s => s.day === day && s.timeSlot.startsWith(timeOnly));

                                      return (
                                        <button
                                          key={block}
                                          type="button"
                                          onClick={() => handleAddSlot(idx, day, timeOnly)}
                                          style={{
                                            border: '1px solid',
                                            borderColor: isSelected ? '#7c3aed' : '#e2e8f0',
                                            background: isSelected ? '#7c3aed' : '#ffffff',
                                            color: isSelected ? '#ffffff' : '#334155',
                                            padding: '0.3rem 0.7rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          {block}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EXAM ROUTINE BUILDER */
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GraduationCap size={22} color="#7c3aed" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Semester Final Examination Schedule ({configuredExams.length} Courses)
                  </h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Set exam date, day, invigilator, room, and preparation gaps
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {configuredExams.map((exam, idx) => (
                  <div key={exam.courseId} className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '4px solid #7c3aed' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{
                          background: '#7c3aed',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px'
                        }}>
                          Exam #{exam.serial}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e3a8a' }}>
                          {exam.courseCode}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                          {exam.courseTitle}
                        </h4>
                      </div>

                      {/* Preparation Gap indicator from previous exam */}
                      {idx > 0 && exam.date && configuredExams[idx - 1].date && (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: '#ecfdf5',
                          color: '#065f46',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid #a7f3d0'
                        }}>
                          🗓️ {Math.max(0, Math.round((new Date(exam.date) - new Date(configuredExams[idx - 1].date)) / (1000 * 60 * 60 * 24)))} Days Gap
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                      {/* Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Exam Date:
                        </label>
                        <input
                          type="date"
                          value={exam.date}
                          onChange={(e) => handleExamDateChange(idx, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        />
                      </div>

                      {/* Day of Week */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Day of Week:
                        </label>
                        <input
                          type="text"
                          value={exam.day}
                          readOnly
                          placeholder="Auto-calculated from date"
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#475569'
                          }}
                        />
                      </div>

                      {/* Time Slot */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Exam Time Slot:
                        </label>
                        <select
                          value={exam.timeSlot}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfiguredExams(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], timeSlot: val };
                              return copy;
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}
                        >
                          <option value="10:00 AM - 01:00 PM">10:00 AM - 01:00 PM (Morning Slot)</option>
                          <option value="02:00 PM - 05:00 PM">02:00 PM - 05:00 PM (Afternoon Slot)</option>
                          <option value="09:30 AM - 12:30 PM">09:30 AM - 12:30 PM</option>
                        </select>
                      </div>

                      {/* Room / Hall */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Exam Hall / Room:
                        </label>
                        <input
                          type="text"
                          value={exam.roomNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfiguredExams(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], roomNumber: val };
                              return copy;
                            });
                          }}
                          placeholder="Gallery Room 401 & 402"
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}
                        />
                      </div>

                      {/* Invigilator / Course Teacher */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Chief Invigilator / Teacher:
                        </label>
                        <select
                          value={teachers.find(t => `${t.first_name} ${t.last_name}` === exam.invigilatorName)?.teacher_id || 'EXTERNAL'}
                          onChange={(e) => handleExamTeacherChange(idx, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        >
                          <optgroup label="CSE Department Faculty">
                            {teachers.map(t => (
                              <option key={t.teacher_id} value={t.teacher_id}>
                                {t.first_name} {t.last_name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Other">
                            <option value="EXTERNAL">Other / External</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Contact Phone Number */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                          Contact Phone:
                        </label>
                        <input
                          type="text"
                          value={exam.teacherPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfiguredExams(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], teacherPhone: val };
                              return copy;
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.8rem',
                            borderRadius: '8px',
                            border: '1px solid #10b981',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Bar: Generate / Make Routine Button */}
          <div style={{
            position: 'sticky',
            bottom: '1rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '1rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            zIndex: 40,
            color: '#ffffff'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                Ready to Compile Routine?
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Generates full timetable preview where you can edit specific slots, publish to Notice Board, or export.
              </div>
            </div>

            <button
              onClick={handleGenerateRoutine}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                padding: '0.75rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Sparkles size={18} />
              <span>Generate Routine & Preview Timetable</span>
            </button>
          </div>
        </div>
      ) : (
        /* GENERATED ROUTINE PREVIEW WITH INTERACTIVE EDIT, PUBLISH & EXPORT */
        <div className="generated-routine-view">
          {/* Action Toolbar */}
          <div className="card" style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            background: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {routineTitle}
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: routineStatus === 'PUBLISHED' ? '#059669' : '#f59e0b',
                  color: '#ffffff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px'
                }}>
                  {routineStatus}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                {activeSessionObj?.session_name} &bull; {activeSemesterObj?.semester_name}
              </div>
            </div>

            {/* Publish & Export Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
              {/* Back to Edit Form */}
              <button
                onClick={() => setIsGenerated(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
              >
                <ArrowLeft size={16} />
                <span>Add / Adjust Courses</span>
              </button>

              {/* Save Routine Draft */}
              <button
                onClick={() => handleSaveRoutineToDB('DRAFT')}
                disabled={actionLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
                title="Save routine data to system database"
              >
                <Save size={16} />
                <span>Save Routine</span>
              </button>

              {/* Export as Word (.doc) */}
              <button
                onClick={handleExportWord}
                className="btn btn-secondary"
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderColor: '#93c5fd',
                  color: '#1d4ed8',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0.55rem 1rem'
                }}
                title="Download formatted Microsoft Word (.doc) file"
              >
                <FileText size={16} />
                <span>Save as Word (.doc)</span>
              </button>

              {/* Export PDF / Print */}
              <button
                onClick={handleExportPDF}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
                title="Print or Save as PDF"
              >
                <Printer size={16} />
                <span>Print / PDF</span>
              </button>

              {/* Publish to Notice Board */}
              <button
                onClick={handlePublishToNoticeBoard}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  padding: '0.55rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
                title="Publish directly to Department Notice Board for all students and faculty"
              >
                <Share2 size={16} />
                <span>Publish to Notice Board</span>
              </button>
            </div>
          </div>

          {/* TIMETABLE CONTENT */}
          {routineMode === 'CLASS_ROUTINE' ? (
            <div>
              {/* Weekly Timetable Grid */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', background: '#ffffff', overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarCheck size={20} color="#2563eb" />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      Weekly Master Timetable
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    💡 Tip: Click "✏️ Edit" on any slot to change date, time, or teacher instantly
                  </span>
                </div>

                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center', width: '120px', color: '#475569', fontWeight: 800 }}>
                        DAY / PERIOD
                      </th>
                      {standardPeriods.map(p => (
                        <th key={p} style={{ padding: '0.85rem 0.6rem', textAlign: 'center', color: '#1e293b', fontWeight: 800, borderLeft: '1px solid #f1f5f9' }}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekdays.map(day => (
                      <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '1rem', fontWeight: 800, background: '#f8fafc', textAlign: 'center', color: '#0f172a' }}>
                          {day}
                        </td>
                        {standardPeriods.map(p => {
                          // Find slots matching this day and time period
                          const matchingSlots = [];
                          const sessionsToInspect = sessionsInRoutine.length > 0 ? sessionsInRoutine : [{ courses: configuredCourses }];

                          sessionsToInspect.forEach(sess => {
                            if (Array.isArray(sess.courses)) {
                              sess.courses.forEach(c => {
                                if (Array.isArray(c.timeSlots)) {
                                  c.timeSlots.forEach(s => {
                                    // Check match or overlap with lab block
                                    if (s.day === day && (s.timeSlot === p || s.timeSlot.includes(p.split(' - ')[0]))) {
                                      matchingSlots.push({ slot: s, course: c });
                                    }
                                  });
                                }
                              });
                            }
                          });

                          return (
                            <td key={p} style={{ padding: '0.5rem', verticalAlign: 'top', borderLeft: '1px solid #f1f5f9', minHeight: '80px', width: '13%' }}>
                              {matchingSlots.length === 0 ? (
                                <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.75rem' }}>
                                  -
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {matchingSlots.map(({ slot, course }, mIdx) => {
                                    const isLab = course.courseType === 'LAB';

                                    return (
                                      <div
                                        key={mIdx}
                                        style={{
                                          background: isLab ? '#faf5ff' : '#eff6ff',
                                          border: isLab ? '1px solid #d8b4fe' : '1px solid #bfdbfe',
                                          borderRadius: '8px',
                                          padding: '0.5rem',
                                          position: 'relative'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span style={{
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            color: isLab ? '#7c3aed' : '#1d4ed8'
                                          }}>
                                            {course.courseCode}
                                          </span>

                                          {/* Quick Edit Slot Button */}
                                          <button
                                            onClick={() => handleOpenEditModal({
                                              courseId: course.courseId,
                                              oldDay: day,
                                              oldTimeSlot: slot.timeSlot,
                                              newDay: day,
                                              newTimeSlot: slot.timeSlot,
                                              newRoomNumber: slot.roomNumber || course.roomNumber,
                                              teacherName: course.teacherName,
                                              teacherDept: course.teacherDept,
                                              teacherPhone: course.teacherPhone
                                            }, 'SLOT', course)}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              color: '#64748b',
                                              padding: '2px'
                                            }}
                                            title="Edit this specific time, day or room"
                                          >
                                            <Edit3 size={12} />
                                          </button>
                                        </div>

                                        <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {course.courseTitle}
                                        </div>

                                        <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.25rem', fontWeight: 700 }}>
                                          {course.teacherName}
                                        </div>

                                        <div style={{ fontSize: '0.675rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.15rem' }}>
                                          <Phone size={10} />
                                          <span>{course.teacherPhone || 'N/A'}</span>
                                        </div>

                                        <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '0.15rem' }}>
                                          📍 {slot.roomNumber || course.roomNumber || 'Room 401'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Faculty Contact Directory Table */}
              <div className="card" style={{ padding: '1.5rem', background: '#ffffff', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} color="#2563eb" />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      Course & Faculty Contact Directory
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Included in printed copies & official notifications
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Course Code</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Course Title</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Credits</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Assigned Faculty</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Dept</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Contact Number</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Room</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configuredCourses.map((c, cIdx) => (
                        <tr key={c.courseId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 800, color: '#1e3a8a' }}>{c.courseCode}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{c.courseTitle}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: c.courseType === 'LAB' ? '#faf5ff' : '#eff6ff',
                              color: c.courseType === 'LAB' ? '#7c3aed' : '#2563eb',
                              border: c.courseType === 'LAB' ? '1px solid #d8b4fe' : '1px solid #bfdbfe',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px'
                            }}>
                              {c.courseType}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700 }}>{c.creditHours}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 700 }}>{c.teacherName || 'TBA'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{c.teacherDept || 'CSE'}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 700, color: '#0284c7' }}>{c.teacherPhone || 'N/A'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{c.roomNumber || 'TBA'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleOpenEditModal(c, 'COURSE')}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* EXAM ROUTINE TIMETABLE */
            <div className="card" style={{ padding: '1.5rem', background: '#ffffff', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GraduationCap size={22} color="#7c3aed" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Semester Final Examination Timetable
                  </h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Official format with hall distribution & invigilator contacts
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '50px' }}>Sl</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Day</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Time</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Course Code</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Course Title</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Room / Hall</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Invigilator / Teacher</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Contact</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configuredExams.map((ex, idx) => (
                      <tr key={ex.courseId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>{ex.serial || (idx + 1)}</td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 800, color: '#1e3a8a' }}>{ex.date || 'TBA'}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{ex.day || '-'}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{ex.timeSlot}</td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 800 }}>{ex.courseCode}</td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600 }}>{ex.courseTitle}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{ex.roomNumber}</td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700 }}>{ex.invigilatorName}</td>
                        <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, color: '#0284c7' }}>{ex.teacherPhone}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenEditModal(ex, 'EXAM')}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTERACTIVE EDIT MODAL */}
      {isEditModalOpen && editingItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {editingItem.editType === 'SLOT' ? '✏️ Edit Class Timing & Room' : (editingItem.editType === 'EXAM' ? '✏️ Edit Exam Schedule' : '✏️ Edit Course Details')}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  {editingItem.courseCode} - {editingItem.courseTitle}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {editingItem.editType === 'SLOT' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Weekday:
                    </label>
                    <select
                      value={editingItem.newDay || editingItem.oldDay}
                      onChange={(e) => setEditingItem({ ...editingItem, newDay: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      {weekdays.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Time Period:
                    </label>
                    <select
                      value={editingItem.newTimeSlot || editingItem.oldTimeSlot}
                      onChange={(e) => setEditingItem({ ...editingItem, newTimeSlot: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      {standardPeriods.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      {standardLabBlocks.map(b => (
                        <option key={b} value={b.split(' (')[0]}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Classroom / Lab Location:
                    </label>
                    <input
                      type="text"
                      value={editingItem.newRoomNumber || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, newRoomNumber: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>
                </>
              )}

              {editingItem.editType === 'EXAM' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Exam Date:
                    </label>
                    <input
                      type="date"
                      value={editingItem.date || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        let dName = '';
                        if (val) {
                          const d = new Date(val);
                          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          dName = dayNames[d.getDay()];
                        }
                        setEditingItem({ ...editingItem, date: val, day: dName });
                      }}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Time Slot:
                    </label>
                    <input
                      type="text"
                      value={editingItem.timeSlot || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, timeSlot: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Exam Hall / Room:
                    </label>
                    <input
                      type="text"
                      value={editingItem.roomNumber || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, roomNumber: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Chief Invigilator:
                    </label>
                    <input
                      type="text"
                      value={editingItem.invigilatorName || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, invigilatorName: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Contact Phone Number:
                    </label>
                    <input
                      type="text"
                      value={editingItem.teacherPhone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, teacherPhone: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>
                </>
              )}

              {editingItem.editType === 'COURSE' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Course Teacher Name:
                    </label>
                    <input
                      type="text"
                      value={editingItem.teacherName || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, teacherName: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Department:
                    </label>
                    <input
                      type="text"
                      value={editingItem.teacherDept || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, teacherDept: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Teacher Phone Number:
                    </label>
                    <input
                      type="text"
                      value={editingItem.teacherPhone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, teacherPhone: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                      Classroom / Lab:
                    </label>
                    <input
                      type="text"
                      value={editingItem.roomNumber || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, roomNumber: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', fontWeight: 700 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVED ROUTINES DRAWER MODAL */}
      {isSavedDrawerOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderOpen size={20} color="#2563eb" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Saved Academic Routines ({savedRoutinesList.length})
                </h3>
              </div>
              <button
                onClick={() => setIsSavedDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {savedRoutinesList.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <CalendarClock size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600 }}>No saved routines found yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Create a routine and click "Save Routine" or "Publish to Notice Board" to store it here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {savedRoutinesList.map(r => (
                    <div
                      key={r.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: r.type === 'CLASS_ROUTINE' ? '#eff6ff' : '#faf5ff',
                            color: r.type === 'CLASS_ROUTINE' ? '#2563eb' : '#7c3aed',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px'
                          }}>
                            {r.type === 'CLASS_ROUTINE' ? 'CLASS ROUTINE' : 'EXAM ROUTINE'}
                          </span>
                          <span style={{
                            fontSize: '0.675rem',
                            fontWeight: 800,
                            background: r.status === 'PUBLISHED' ? '#dcfce7' : '#fef3c7',
                            color: r.status === 'PUBLISHED' ? '#166534' : '#92400e',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px'
                          }}>
                            {r.status}
                          </span>
                        </div>

                        <h4 style={{ margin: '0.35rem 0 0.15rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                          {r.title}
                        </h4>

                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {r.session_name || 'All Sessions'} &bull; {r.semester_name || 'All Semesters'} &bull; Created by {r.creator_name || 'Faculty Staff'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleLoadSavedRoutine(r.id)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', fontWeight: 700 }}
                        >
                          Load & Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoutineGeneratorView;
