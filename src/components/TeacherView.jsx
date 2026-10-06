import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeBoard } from './NoticeBoard';
import { computeStudentCA, computeClassRanks, formatOrdinal } from '../utils/assessment';
import { 
  BookOpen, 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Trash2, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  Award, 
  Users, 
  Bell,
  Save,
  Medal,
  Sparkles,
  FileCheck,
  File,
  Table,
  Zap,
  Check,
  Layers,
  Building,
  Search,
  Eye,
  ShieldCheck,
  GraduationCap,
  UserPlus,
  Copy,
  CheckCircle2,
  Key,
  Briefcase,
  RefreshCw,
  Plus,
  PlusCircle,
  Calendar,
  Hash,
  FolderPlus
} from 'lucide-react';

export const TeacherView = ({ initialTab = 'my-courses' }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  const isChair = Boolean(user?.isChair || user?.email === 'chair.cse_pust@gmail.com' || (user?.designation && user.designation.toLowerCase().includes('chair')));

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [assignedCourses, setAssignedCourses] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseDetails, setCourseDetails] = useState(null);
  const [isAssignedTeacher, setIsAssignedTeacher] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [ctMarksData, setCtMarksData] = useState({ students: [], marks: [] });
  const [message, setMessage] = useState(null);

  // Chairman Specific States
  const [oversightCourses, setOversightCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [oversightSearch, setOversightSearch] = useState('');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('ALL');

  // Chairman Create Account States (Staff & Teacher)
  const [createRole, setCreateRole] = useState('OFFICE_STAFF'); // 'OFFICE_STAFF' | 'TEACHER'
  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    designation: '',
    roomNumber: '',
    phoneNumber: '',
  });
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState(null);
  const [managedAccounts, setManagedAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  // Department Information & Curriculum States
  const [curriculumData, setCurriculumData] = useState({ semesters: [], total_courses: 0 });
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  const [deptInfoSubTab, setDeptInfoSubTab] = useState('syllabus'); // 'syllabus' | 'students'
  const [activeSemesterFilter, setActiveSemesterFilter] = useState('ALL');

  // Student Overview (40 Seats Intake) States
  const [studentsOverview, setStudentsOverview] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Add Course Modal State
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({
    semesterId: '',
    courseCode: '',
    courseTitle: '',
    creditHours: '3.0',
    courseType: 'THEORY',
    syllabusOutline: '',
    assignedTeacherId: '',
  });
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);
  const [courseActionFeedback, setCourseActionFeedback] = useState(null);

  // Add Session & Add Student Modals States
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionName: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  });
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({
    sessionId: '',
    studentRoll: '',
    registrationNo: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
  });
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentActionFeedback, setStudentActionFeedback] = useState(null);

  // Course workspace active sub-tab ('assessment' | 'materials')
  const [workspaceTab, setWorkspaceTab] = useState('assessment');

  // Matrix marks state: { [studentId]: { ct1: '', ct2: '', ct3: '', attendance: '', remarks: '' } }
  const [matrixMarks, setMatrixMarks] = useState({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  // Material Upload Form
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', file: null });

  // AI Smart Auto-Detect Modal State (PDF, Excel, CSV, Text)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiFile, setAiFile] = useState(null);
  const [aiRawText, setAiRawText] = useState('');
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 1. Fetch Teacher's Assigned Courses & Chairman Department Data
  useEffect(() => {
    fetchAssignedCourses();
    fetchCurriculum();
    fetchStudentsOverview();
    if (isChair) {
      fetchOversightCourses();
      fetchFacultyList();
      fetchManagedAccounts();
    }
  }, [user, isChair]);

  const fetchAssignedCourses = async () => {
    try {
      const res = await fetch('/api/courses/my-assigned', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAssignedCourses(data.courses || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOversightCourses = async () => {
    try {
      const res = await fetch('/api/courses/department-oversight', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOversightCourses(data.courses || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFacultyList = async () => {
    try {
      const res = await fetch('/api/auth/teachers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFacultyList(data.teachers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchManagedAccounts = async () => {
    if (!isChair) return;
    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/auth/chairman/managed-accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.accounts) {
        setManagedAccounts(data.accounts);
      }
    } catch (e) {
      console.error('Error loading managed accounts:', e);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e?.preventDefault();
    if (!accountForm.email || !accountForm.password) {
      setAccountFeedback({ type: 'error', text: 'Please provide both Email and Password.' });
      return;
    }
    if (accountForm.password.length < 6) {
      setAccountFeedback({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsSubmittingAccount(true);
    setAccountFeedback(null);

    try {
      const res = await fetch('/api/auth/chairman/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: createRole,
          email: accountForm.email.trim(),
          password: accountForm.password,
          firstName: accountForm.firstName.trim(),
          lastName: accountForm.lastName.trim(),
          designation: accountForm.designation.trim(),
          roomNumber: accountForm.roomNumber.trim(),
          phoneNumber: accountForm.phoneNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAccountFeedback({ type: 'error', text: data.error || 'Failed to provision account.' });
      } else {
        setAccountFeedback({
          type: 'success',
          text: data.message,
          credentials: {
            role: createRole,
            email: accountForm.email.trim(),
            password: accountForm.password,
            name: `${data.account?.firstName || ''} ${data.account?.lastName || ''}`.trim()
          }
        });
        setAccountForm({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          designation: '',
          roomNumber: '',
          phoneNumber: ''
        });
        fetchManagedAccounts();
        if (createRole === 'TEACHER') {
          fetchFacultyList();
        }
      }
    } catch (err) {
      setAccountFeedback({ type: 'error', text: 'Network connection error: ' + err.message });
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  // Curriculum & Student Information Fetch Handlers
  const fetchCurriculum = async () => {
    setIsLoadingCurriculum(true);
    try {
      const res = await fetch('/api/academic/curriculum', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.semesters) {
        setCurriculumData(data);
        if (!courseForm.semesterId && data.semesters.length > 0) {
          setCourseForm((prev) => ({ ...prev, semesterId: data.semesters[0].semester_id }));
        }
      }
    } catch (e) {
      console.error('Error fetching curriculum:', e);
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const fetchStudentsOverview = async () => {
    setIsLoadingStudents(true);
    try {
      const res = await fetch('/api/academic/students-overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.sessions) {
        setStudentsOverview(data.sessions);
        if (data.sessions.length > 0) {
          setSelectedSessionId((prev) => prev || data.sessions[0].session_id);
          setStudentForm((prev) => ({ ...prev, sessionId: prev.sessionId || data.sessions[0].session_id }));
        }
      }
    } catch (e) {
      console.error('Error fetching students overview:', e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleAddCourse = async (e) => {
    e?.preventDefault();
    if (!courseForm.courseCode || !courseForm.courseTitle || !courseForm.semesterId) {
      setCourseActionFeedback({ type: 'error', text: 'Please select a Semester, and provide both Course Code and Title.' });
      return;
    }

    setIsSubmittingCourse(true);
    setCourseActionFeedback(null);

    try {
      const res = await fetch('/api/academic/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(courseForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setCourseActionFeedback({ type: 'error', text: data.error || 'Failed to add course.' });
      } else {
        setCourseActionFeedback({
          type: 'success',
          text: data.message || `Course ${courseForm.courseCode} added successfully!`,
        });
        setCourseForm((prev) => ({
          ...prev,
          courseCode: '',
          courseTitle: '',
          creditHours: '3.0',
          courseType: 'THEORY',
          syllabusOutline: '',
          assignedTeacherId: '',
        }));
        await fetchCurriculum();
        setTimeout(() => {
          setIsAddCourseModalOpen(false);
          setCourseActionFeedback(null);
        }, 1200);
      }
    } catch (err) {
      setCourseActionFeedback({ type: 'error', text: 'Network connection error: ' + err.message });
    } finally {
      setIsSubmittingCourse(false);
    }
  };

  const handleAddSession = async (e) => {
    e?.preventDefault();
    if (!sessionForm.sessionName) {
      setStudentActionFeedback({ type: 'error', text: 'Session Name (e.g. 2024-2025) is required.' });
      return;
    }

    setIsSubmittingSession(true);
    setStudentActionFeedback(null);

    try {
      const res = await fetch('/api/academic/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_name: sessionForm.sessionName.trim(),
          start_date: sessionForm.startDate || new Date().toISOString().split('T')[0],
          end_date: sessionForm.endDate || null,
          is_current: sessionForm.isCurrent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudentActionFeedback({ type: 'error', text: data.error || 'Failed to create session.' });
      } else {
        setStudentActionFeedback({
          type: 'success',
          text: `Session ${sessionForm.sessionName} created with 40 seats capacity!`,
        });
        setSessionForm({ sessionName: '', startDate: '', endDate: '', isCurrent: false });
        await fetchStudentsOverview();
        if (data.session?.session_id) {
          setSelectedSessionId(data.session.session_id);
          setStudentForm((prev) => ({ ...prev, sessionId: data.session.session_id }));
        }
        setTimeout(() => {
          setIsAddSessionModalOpen(false);
          setStudentActionFeedback(null);
        }, 1200);
      }
    } catch (err) {
      setStudentActionFeedback({ type: 'error', text: 'Network connection error: ' + err.message });
    } finally {
      setIsSubmittingSession(false);
    }
  };

  const handleAddStudent = async (e) => {
    e?.preventDefault();
    if (!studentForm.sessionId || !studentForm.studentRoll || !studentForm.email) {
      setStudentActionFeedback({ type: 'error', text: 'Please fill in Session, Roll Number, and Email.' });
      return;
    }

    setIsSubmittingStudent(true);
    setStudentActionFeedback(null);

    try {
      const res = await fetch('/api/academic/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(studentForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setStudentActionFeedback({ type: 'error', text: data.error || 'Failed to enroll student.' });
      } else {
        setStudentActionFeedback({
          type: 'success',
          text: data.message || `Student ${studentForm.studentRoll} enrolled successfully!`,
        });
        setStudentForm((prev) => ({
          ...prev,
          studentRoll: '',
          registrationNo: '',
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phoneNumber: '',
        }));
        await fetchStudentsOverview();
        setTimeout(() => {
          setIsAddStudentModalOpen(false);
          setStudentActionFeedback(null);
        }, 1200);
      }
    } catch (err) {
      setStudentActionFeedback({ type: 'error', text: 'Network connection error: ' + err.message });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  // 2. Load Workspace when Course Selected
  useEffect(() => {
    if (activeCourseId) {
      loadCourseWorkspace(activeCourseId);
    }
  }, [activeCourseId]);

  const loadCourseWorkspace = async (courseId) => {
    try {
      // Course details
      const cRes = await fetch(`/api/courses/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
      const cData = await cRes.json();
      setCourseDetails(cData.course);
      setIsAssignedTeacher(cData.isAssignedTeacher);

      // Materials
      const mRes = await fetch(`/api/courses/${courseId}/materials`, { headers: { Authorization: `Bearer ${token}` } });
      const mData = await mRes.json();
      setMaterials(mData.materials || []);

      // CT Marks & Student Roster
      const marksRes = await fetch(`/api/courses/${courseId}/ct-marks`, { headers: { Authorization: `Bearer ${token}` } });
      const marksData = await marksRes.json();
      setCtMarksData(marksData);

      // Initialize Matrix Marks state from existing marks
      const initialMatrix = {};
      (marksData.students || []).forEach((s) => {
        initialMatrix[s.student_id] = { ct1: '', ct2: '', ct3: '', attendance: '', remarks: '' };
      });

      (marksData.marks || []).forEach((m) => {
        if (!initialMatrix[m.student_id]) {
          initialMatrix[m.student_id] = { ct1: '', ct2: '', ct3: '', attendance: '', remarks: '' };
        }
        const val = m.obtained_marks !== null && m.obtained_marks !== undefined ? m.obtained_marks : '';
        if (m.ct_number === 1) initialMatrix[m.student_id].ct1 = val;
        else if (m.ct_number === 2) initialMatrix[m.student_id].ct2 = val;
        else if (m.ct_number === 3) initialMatrix[m.student_id].ct3 = val;
        else if (m.ct_number === 4) initialMatrix[m.student_id].attendance = val;

        if (m.remarks && !initialMatrix[m.student_id].remarks) {
          initialMatrix[m.student_id].remarks = m.remarks;
        }
      });

      setMatrixMarks(initialMatrix);
    } catch (e) {
      console.error('Error loading course workspace:', e);
    }
  };

  // Live calculation of Continuous Assessment for all students
  const computedStudents = (ctMarksData.students || []).map((s) => {
    const studentEntry = matrixMarks[s.student_id] || { ct1: '', ct2: '', ct3: '', attendance: '', remarks: '' };
    const ca = computeStudentCA(studentEntry.ct1, studentEntry.ct2, studentEntry.ct3, studentEntry.attendance);
    return {
      ...s,
      marks: studentEntry,
      ca,
    };
  });

  // Calculate live class positions
  const rankMap = computeClassRanks(
    computedStudents.map((s) => ({
      studentId: s.student_id,
      totalCA: s.ca.totalCA,
    }))
  );

  // Handle inline change for CT1, CT2, CT3, Attendance, Remarks
  const handleMarkChange = (studentId, field, val) => {
    setMatrixMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { ct1: '', ct2: '', ct3: '', attendance: '', remarks: '' }),
        [field]: val,
      },
    }));
  };

  // Batch Save Continuous Assessment Matrix
  const handleSaveMatrix = async () => {
    if (!isAssignedTeacher) {
      return alert('Only the assigned faculty member can modify assessment marks.');
    }
    setIsSavingMatrix(true);

    const matrixPayload = Object.entries(matrixMarks).map(([studentId, marks]) => ({
      studentId,
      ct1: marks.ct1,
      ct2: marks.ct2,
      ct3: marks.ct3,
      attendance: marks.attendance,
      remarks: marks.remarks,
    }));

    try {
      const res = await fetch(`/api/courses/${activeCourseId}/ct-marks/matrix-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matrix: matrixPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'All Continuous Assessment marks saved successfully!' });
      loadCourseWorkspace(activeCourseId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Failed to save assessment matrix: ' + err.message);
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // AI Smart Auto-Detect for PDF, Excel, CSV, or Text
  const handleAiAutoDetect = async (fileToScan, textToScan) => {
    const targetFile = fileToScan !== undefined ? fileToScan : aiFile;
    const targetText = textToScan !== undefined ? textToScan : aiRawText;

    if (!targetFile && !targetText) {
      return alert('Please upload a PDF, Excel (.xlsx/.xls), CSV file or paste marks data.');
    }

    setAiScanning(true);
    setAiError(null);
    setAiResult(null);

    const formData = new FormData();
    if (targetFile) {
      formData.append('file', targetFile);
    } else if (targetText) {
      formData.append('rawText', targetText);
    }

    try {
      const res = await fetch(`/api/courses/${activeCourseId}/ct-marks/auto-detect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to detect marks from file');

      if (!data.results || data.results.length === 0) {
        setAiError('Could not find matching student roll numbers in this document. Please check that student IDs or rolls are included.');
      } else {
        setAiResult(data);
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiScanning(false);
    }
  };

  // Apply AI Extracted Marks to Matrix & Auto-Calculate
  const handleApplyAiMarks = async (saveDirectly = false) => {
    if (!aiResult || !aiResult.results) return;

    // Merge into matrixMarks state so form is automatically fulfilled
    const newMatrix = { ...matrixMarks };
    aiResult.results.forEach((item) => {
      newMatrix[item.studentId] = {
        ct1: item.ct1 !== '' && item.ct1 !== undefined ? item.ct1 : (newMatrix[item.studentId]?.ct1 ?? ''),
        ct2: item.ct2 !== '' && item.ct2 !== undefined ? item.ct2 : (newMatrix[item.studentId]?.ct2 ?? ''),
        ct3: item.ct3 !== '' && item.ct3 !== undefined ? item.ct3 : (newMatrix[item.studentId]?.ct3 ?? ''),
        attendance: item.attendance !== '' && item.attendance !== undefined ? item.attendance : (newMatrix[item.studentId]?.attendance ?? ''),
        remarks: item.remarks || (newMatrix[item.studentId]?.remarks ?? ''),
      };
    });

    setMatrixMarks(newMatrix);

    if (saveDirectly) {
      setIsSavingMatrix(true);
      const matrixPayload = Object.entries(newMatrix).map(([studentId, marks]) => ({
        studentId,
        ct1: marks.ct1,
        ct2: marks.ct2,
        ct3: marks.ct3,
        attendance: marks.attendance,
        remarks: marks.remarks,
      }));

      try {
        const res = await fetch(`/api/courses/${activeCourseId}/ct-marks/matrix-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ matrix: matrixPayload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMessage({
          type: 'success',
          text: `✨ AI detected and saved assessment marks for ${aiResult.results.length} students!`,
        });
        loadCourseWorkspace(activeCourseId);
      } catch (err) {
        alert('Failed to save to database: ' + err.message);
      } finally {
        setIsSavingMatrix(false);
      }
    } else {
      setMessage({
        type: 'success',
        text: `✨ AI fulfilled CT marks for ${aiResult.results.length} students! Best 2, Total CA (/30), Grade and Position calculated live on screen.`,
      });
    }

    setIsAiModalOpen(false);
    setAiResult(null);
    setAiFile(null);
    setAiRawText('');
    setTimeout(() => setMessage(null), 4000);
  };

  // Upload Material Handler
  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.title) return alert('Material title is required');

    const formData = new FormData();
    formData.append('title', materialForm.title);
    formData.append('description', materialForm.description);
    if (materialForm.file) {
      formData.append('file', materialForm.file);
    } else {
      formData.append('fileUrl', '/sample-materials/Lecture_01_Relational_Algebra.pdf');
    }

    try {
      const res = await fetch(`/api/courses/${activeCourseId}/materials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Lecture material published successfully!' });
      setMaterialForm({ title: '', description: '', file: null });
      loadCourseWorkspace(activeCourseId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  // Delete Material Handler
  const handleDeleteMaterial = async (matId) => {
    if (!confirm('Are you sure you want to remove this lecture material?')) return;
    try {
      const res = await fetch(`/api/courses/${activeCourseId}/materials/${matId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Material deleted.' });
      loadCourseWorkspace(activeCourseId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const filteredOversightCourses = (oversightCourses || []).filter((c) => {
    const query = oversightSearch.toLowerCase().trim();
    const matchesSearch = !query || 
      (c.course_code && c.course_code.toLowerCase().includes(query)) ||
      (c.course_title && c.course_title.toLowerCase().includes(query)) ||
      (c.assigned_teacher_name && c.assigned_teacher_name.toLowerCase().includes(query));
    const matchesSemester = selectedSemesterFilter === 'ALL' || c.semester_name === selectedSemesterFilter;
    return matchesSearch && matchesSemester;
  });

  const selectedSession = (studentsOverview || []).find((s) => s.session_id === selectedSessionId) || (studentsOverview && studentsOverview[0]) || null;

  const filteredStudents = (selectedSession?.students || []).filter((st) => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.toLowerCase();
    return (
      (st.student_roll && st.student_roll.toLowerCase().includes(q)) ||
      (st.first_name && st.first_name.toLowerCase().includes(q)) ||
      (st.last_name && st.last_name.toLowerCase().includes(q)) ||
      (st.email && st.email.toLowerCase().includes(q))
    );
  });

  const displayedSemesters = activeSemesterFilter === 'ALL'
    ? (curriculumData.semesters || [])
    : (curriculumData.semesters || []).filter(
        (s) => s.term_code === activeSemesterFilter || s.semester_id === activeSemesterFilter
      );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ========================================================= */}
      {/* COHESIVE HERO BANNER (IDENTICAL BEAUTIFUL DESIGN ON ALL PAGES) */}
      {/* ========================================================= */}
      {!activeCourseId ? (
        // DASHBOARD MAIN HERO
        isChair ? (
          <div className="role-hero-banner hero-teacher" style={{
            background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 45%, #1e3a8a 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(254, 243, 199, 0.25)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', color: '#0f172a', fontWeight: 800, border: '1px solid rgba(254, 243, 199, 0.5)', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)' }}>
                  🏛️ Executive Head of Department
                </span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  Dept of CSE • PUST
                </span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', color: '#e0e7ff' }}>
                  Office: Chairman Suite, Room 401, Academic Bldg 3, PUST
                </span>
              </div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)', color: '#ffffff' }}>
                Dr. Abdur Rahim — Chairman, Department of CSE
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginTop: '0.35rem', maxWidth: '720px', lineHeight: 1.5 }}>
                Executive Academic Command: Curriculum oversight, faculty allocation, Continuous Assessment (30 Marks) verification, and official university communications.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="hero-stat-widget" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <div className="hero-stat-val" style={{ color: '#fef08a' }}>{assignedCourses.length}</div>
                <div className="hero-stat-lbl">My Direct Courses</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">{oversightCourses.length}</div>
                <div className="hero-stat-lbl">Dept Courses</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">{facultyList.length}</div>
                <div className="hero-stat-lbl">Faculty Roster</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val" style={{ color: '#34d399' }}>30 Marks</div>
                <div className="hero-stat-lbl">CA Standard</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="role-hero-banner hero-teacher">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <span className="live-beacon" style={{ marginRight: '4px' }}></span> Designated Faculty Member
                </span>
                <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {user.designation || 'Faculty Member'} • Room: {user.roomNumber || 'Dept of CSE'}
                </span>
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                Faculty Command Center: {user.firstName} {user.lastName}
              </h2>
              <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.3rem', maxWidth: '650px' }}>
                Course curriculum control, lecture material publishing, and Class Test (CT) evaluation suite.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">{assignedCourses.length}</div>
                <div className="hero-stat-lbl">Assigned Courses</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">
                  {assignedCourses.reduce((acc, c) => acc + (parseInt(c.materials_count, 10) || 0), 0)}
                </div>
                <div className="hero-stat-lbl">Total Materials</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">
                  {assignedCourses.reduce((acc, c) => acc + (parseInt(c.marked_students_count, 10) || 0), 0)}
                </div>
                <div className="hero-stat-lbl">CT Evaluated</div>
              </div>
            </div>
          </div>
        )
      ) : (
        // COURSE WORKSPACE HERO (MATCHING RICH AESTHETIC)
        <div className="role-hero-banner hero-teacher">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                {courseDetails?.course_code}
              </span>
              <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }}>
                {courseDetails?.credit_hours} Credits • {courseDetails?.course_type || 'THEORY'}
              </span>
              {(isAssignedTeacher || isChair) ? (
                <span className="badge" style={{ background: isAssignedTeacher ? '#10b981' : 'linear-gradient(135deg, #b45309, #f59e0b)', color: isAssignedTeacher ? '#ffffff' : '#0f172a', fontWeight: 800, border: '1px solid rgba(255,255,255,0.3)' }}>
                  {isAssignedTeacher ? (isChair ? '★ Course Lead Faculty (Chairman)' : '★ Course Lead Faculty') : '★ Department Chairman Executive Oversight'}
                </span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                  <Lock size={12} style={{ marginRight: '4px' }} /> Read-Only Mode
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {courseDetails?.course_code}: {courseDetails?.course_title}
            </h2>
            <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.3rem', maxWidth: '650px' }}>
              {courseDetails?.session_name} • {courseDetails?.semester_name} • Continuous Assessment Evaluation Matrix
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'flex-end' }}>
            <button onClick={() => setActiveCourseId(null)} className="back-to-courses-btn">
              <ChevronLeft size={16} /> Back to Dashboard
            </button>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">{ctMarksData.students?.length || 0}</div>
                <div className="hero-stat-lbl">Enrolled Students</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val">{materials.length}</div>
                <div className="hero-stat-lbl">Materials</div>
              </div>
              <div className="hero-stat-widget">
                <div className="hero-stat-val" style={{ color: '#fef08a' }}>30</div>
                <div className="hero-stat-lbl">Total CA Marks</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {message && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <CheckCircle size={18} /> {message.text}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. MAIN TEACHER DASHBOARD (WHEN NO COURSE CLICKED) */}
      {/* ========================================================= */}
      {!activeCourseId ? (
        <>
          <div className="option-switch" role="tablist" aria-label="Teacher workspace sections">
            {(isChair ? [
              {
                id: 'my-courses',
                title: 'Dashboard Overview',
                sub: 'Continuous assessment 30 marks matrix & workspaces',
                icon: BookOpen,
                count: assignedCourses.length,
                theme: 'emerald',
              },
              {
                id: 'dept-info',
                title: 'Department Information',
                sub: 'Syllabus (1st to 4th Year) & Student records (40 Seats)',
                icon: GraduationCap,
                count: null,
                theme: 'cyan',
              },
              {
                id: 'notices',
                title: "Notice Board",
                sub: 'Department decrees, exam schedules & notices',
                icon: Bell,
                count: null,
                theme: 'indigo',
              },
              {
                id: 'create-account',
                title: 'Create Account',
                sub: 'Provision Staff or Teacher accounts directly',
                icon: UserPlus,
                count: managedAccounts.length,
                theme: 'amber',
              },
            ] : [
              {
                id: 'my-courses',
                title: 'Dashboard Overview',
                sub: 'Lecture materials, CT marks & course workspaces',
                icon: BookOpen,
                count: assignedCourses.length,
                theme: 'emerald',
              },
              {
                id: 'dept-info',
                title: 'Department Information',
                sub: 'Syllabus (1st to 4th Year) & Student records (40 Seats)',
                icon: GraduationCap,
                count: null,
                theme: 'cyan',
              },
              {
                id: 'notices',
                title: 'Notice Board',
                sub: 'Department announcements, exams & events',
                icon: Bell,
                count: null,
                theme: 'indigo',
              },
            ]).map((opt) => {
              const Icon = opt.icon;
              const isActive = activeTab === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`teacher-tab-${opt.id}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(opt.id)}
                  className={`option-card option-${opt.theme} ${isActive ? 'active' : ''}`}
                >
                  <span className="option-icon"><Icon size={22} /></span>
                  <span className="option-text">
                    <span className="option-title">{opt.title}</span>
                    <span className="option-sub">{opt.sub}</span>
                  </span>
                  {opt.count !== null && <span className="option-count">{opt.count}</span>}
                </button>
              );
            })}
          </div>

          {/* TAB 1: MY ASSIGNED COURSES */}
          {activeTab === 'my-courses' && (
            <section className="fade-in-up">
              <div className="section-heading">
                <div>
                  <h3>My Assigned Courses</h3>
                  <p>Select any course below to manage its Continuous Assessment (30 Marks) and Lecture Materials.</p>
                </div>
                <span className="ownership-pill"><CheckCircle size={14} /> Faculty Ownership</span>
              </div>

              {assignedCourses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><BookOpen size={30} /></div>
                  <h4>No Courses Assigned Yet</h4>
                  <p>The Department Office assigns faculty to semester courses. Please contact the academic office staff.</p>
                </div>
              ) : (
                <div className="course-grid">
                  {assignedCourses.map((c, idx) => {
                    const themes = ['emerald', 'blue', 'violet', 'amber'];
                    const theme = themes[idx % themes.length];
                    return (
                      <article key={c.id} className={`course-tile tile-${theme}`} style={{ animationDelay: `${idx * 70}ms` }}>
                        <div className="course-tile-head">
                          <div className="course-tile-tags">
                            <span className="tile-code">{c.course_code}</span>
                            <span className="tile-chip">{c.course_type || 'THEORY'}</span>
                            <span className="tile-chip">{c.credit_hours} Cr</span>
                          </div>
                          <h4 className="course-tile-title">{c.course_title}</h4>
                          <div className="course-tile-meta">
                            {c.session_name} • {c.semester_name}{c.term_code ? ` (${c.term_code})` : ''}
                          </div>
                        </div>

                        <div className="course-tile-body">
                          <div className="tile-stats">
                            <div className="tile-stat">
                              <FileText size={16} />
                              <div>
                                <strong>{c.materials_count || 0}</strong>
                                <span>Materials</span>
                              </div>
                            </div>
                            <div className="tile-stat">
                              <Users size={16} />
                              <div>
                                <strong>{c.marked_students_count || 0}</strong>
                                <span>Evaluated</span>
                              </div>
                            </div>
                          </div>

                          <button
                            id={`open-course-${c.id}`}
                            onClick={() => {
                              setActiveCourseId(c.id);
                              setWorkspaceTab('assessment');
                            }}
                            className="tile-cta"
                          >
                            Open Course Workspace <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: DEPARTMENT NOTICE BOARD */}
          {activeTab === 'notices' && (
            <NoticeBoard user={user} token={token} />
          )}

          {/* TAB 3: CREATE ACCOUNT (CHAIRMAN EXCLUSIVE) */}
          {activeTab === 'create-account' && isChair && (
            <section className="fade-in-up account-creation-container">
              {/* Header */}
              <div className="section-heading">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge" style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', color: '#0f172a', fontWeight: 800 }}>
                      🛡️ Chairman Authority • Account Provisioning
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Dept of Computer Science & Engineering</span>
                  </div>
                  <h3>Create Staff & Teacher Accounts</h3>
                  <p>Only the Department Chairman has privileges to create Faculty and Staff accounts. Students enroll independently.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge" style={{ background: '#3b82f6', color: '#ffffff', fontWeight: 700 }}>
                    {managedAccounts.length} Total Department Accounts
                  </span>
                </div>
              </div>

              {/* 2 OPTIONS TOGGLE (CREATE FOR STAFF / CREATE FOR TEACHER) */}
              <div className="account-role-selector">
                <button
                  type="button"
                  id="btn-role-staff"
                  onClick={() => { setCreateRole('OFFICE_STAFF'); setAccountFeedback(null); }}
                  className={`role-choice-btn role-staff ${createRole === 'OFFICE_STAFF' ? 'active' : ''}`}
                >
                  <div className="role-choice-icon staff-icon">
                    <Briefcase size={24} />
                  </div>
                  <div className="role-choice-text">
                    <span className="role-choice-title">1. Create for Staff</span>
                    <span className="role-choice-desc">Department Office, Administrative & Academic Support Staff</span>
                  </div>
                  {createRole === 'OFFICE_STAFF' && (
                    <span className="role-active-check"><CheckCircle2 size={20} /></span>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-role-teacher"
                  onClick={() => { setCreateRole('TEACHER'); setAccountFeedback(null); }}
                  className={`role-choice-btn role-teacher ${createRole === 'TEACHER' ? 'active' : ''}`}
                >
                  <div className="role-choice-icon teacher-icon">
                    <GraduationCap size={24} />
                  </div>
                  <div className="role-choice-text">
                    <span className="role-choice-title">2. Create for Teacher</span>
                    <span className="role-choice-desc">Professors, Lecturers & Faculty Course Evaluators</span>
                  </div>
                  {createRole === 'TEACHER' && (
                    <span className="role-active-check"><CheckCircle2 size={20} /></span>
                  )}
                </button>
              </div>

              {/* Main Provisioning Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                border: '1px solid #e2e8f0',
                padding: '1.75rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '1.25rem',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid #f1f5f9',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: createRole === 'TEACHER' ? '#e0e7ff' : '#e0f2fe',
                      color: createRole === 'TEACHER' ? '#4f46e5' : '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UserPlus size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {createRole === 'TEACHER' ? 'Create New Teacher Account' : 'Create New Office Staff Account'}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.775rem', color: '#64748b' }}>
                        Enter the Gmail / email and password to instantly generate the account credentials.
                      </p>
                    </div>
                  </div>

                  <span className="badge" style={{
                    background: createRole === 'TEACHER' ? '#e0e7ff' : '#e0f2fe',
                    color: createRole === 'TEACHER' ? '#4338ca' : '#0369a1',
                    fontWeight: 800,
                    padding: '0.35rem 0.75rem'
                  }}>
                    {createRole === 'TEACHER' ? 'Faculty Lead Profile' : 'Office Staff Profile'}
                  </span>
                </div>

                {/* Form */}
                <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Primary Required Fields: Email and Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        <span>Account Gmail / Email <span style={{ color: '#ef4444' }}>*</span></span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>Required</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="email"
                          id="input-account-email"
                          placeholder={createRole === 'TEACHER' ? "e.g. teacher.pust@gmail.com" : "e.g. staff.cse_pust@gmail.com"}
                          value={accountForm.email}
                          onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                          required
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.9rem', padding: '0.75rem 1rem' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                        This email will be used to log in. Any Gmail or university email address works.
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', margin: 0 }}>
                          Account Password <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const generated = 'CSE_' + Math.floor(100000 + Math.random() * 900000);
                            setAccountForm({ ...accountForm, password: generated });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: 0
                          }}
                        >
                          <Zap size={12} /> Auto-Generate
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          id="input-account-password"
                          placeholder="e.g. 12345678 or custom password"
                          value={accountForm.password}
                          onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                          required
                          minLength={6}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.9rem', padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                        Minimum 6 characters. Easily copyable upon creation.
                      </span>
                    </div>
                  </div>

                  {/* Optional Customization Section */}
                  <details style={{ background: '#f8fafc', padding: '0.85rem 1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', color: '#475569', userSelect: 'none' }}>
                      ⚙️ Optional Profile Details (First Name, Last Name, Designation, Office) — Click to expand
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>First Name</label>
                        <input
                          type="text"
                          placeholder={createRole === 'TEACHER' ? "Faculty" : "Office"}
                          value={accountForm.firstName}
                          onChange={(e) => setAccountForm({ ...accountForm, firstName: e.target.value })}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Last Name</label>
                        <input
                          type="text"
                          placeholder={createRole === 'TEACHER' ? "Teacher" : "Staff"}
                          value={accountForm.lastName}
                          onChange={(e) => setAccountForm({ ...accountForm, lastName: e.target.value })}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Designation</label>
                        <input
                          type="text"
                          placeholder={createRole === 'TEACHER' ? "e.g. Assistant Professor" : "e.g. Academic Officer"}
                          value={accountForm.designation}
                          onChange={(e) => setAccountForm({ ...accountForm, designation: e.target.value })}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Room / Office</label>
                        <input
                          type="text"
                          placeholder={createRole === 'TEACHER' ? "Academic Bldg 3, Room 405" : "Dept Office Room 302"}
                          value={accountForm.roomNumber}
                          onChange={(e) => setAccountForm({ ...accountForm, roomNumber: e.target.value })}
                          className="form-input"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </details>

                  {/* Submission & Action Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="submit"
                      id="btn-submit-create-account"
                      disabled={isSubmittingAccount}
                      className="btn"
                      style={{
                        background: createRole === 'TEACHER' 
                          ? 'linear-gradient(135deg, #4f46e5, #6366f1)' 
                          : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                        color: '#ffffff',
                        padding: '0.8rem 1.75rem',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        border: 'none',
                        cursor: isSubmittingAccount ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isSubmittingAccount ? (
                        <>Provisioning Account...</>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          Create {createRole === 'TEACHER' ? 'Teacher' : 'Staff'} Account Now
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Feedback message */}
                {accountFeedback && accountFeedback.type === 'error' && (
                  <div style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    color: '#b91c1c',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem'
                  }}>
                    <AlertCircle size={18} />
                    <span>{accountFeedback.text}</span>
                  </div>
                )}

                {/* Success Card with Credentials & 1-Click Copy */}
                {accountFeedback && accountFeedback.type === 'success' && accountFeedback.credentials && (
                  <div className="credential-success-card" style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontWeight: 800, fontSize: '1rem' }}>
                        <CheckCircle size={22} style={{ color: '#059669' }} />
                        <span>Account Provisioned Successfully!</span>
                      </div>
                      <span className="badge" style={{ background: '#059669', color: '#ffffff', fontWeight: 800 }}>
                        {accountFeedback.credentials.role} READY
                      </span>
                    </div>

                    <div className="credential-box">
                      <div className="credential-row">
                        <span className="credential-label">Account Role:</span>
                        <span className="credential-value">{accountFeedback.credentials.role === 'TEACHER' ? 'Faculty (Teacher)' : 'Office Staff'}</span>
                      </div>
                      <div className="credential-row">
                        <span className="credential-label">Login Email:</span>
                        <span className="credential-value">{accountFeedback.credentials.email}</span>
                      </div>
                      <div className="credential-row">
                        <span className="credential-label">Password:</span>
                        <span className="credential-value">{accountFeedback.credentials.password}</span>
                      </div>
                      {accountFeedback.credentials.name && (
                        <div className="credential-row">
                          <span className="credential-label">Registered Name:</span>
                          <span className="credential-value">{accountFeedback.credentials.name}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 500 }}>
                        Copy these credentials and securely share them with the {accountFeedback.credentials.role === 'TEACHER' ? 'teacher' : 'staff member'}.
                      </span>
                      <button
                        type="button"
                        id="btn-copy-credentials"
                        onClick={() => {
                          const credText = `--- PUST CSE Department Credentials ---\nRole: ${accountFeedback.credentials.role}\nEmail: ${accountFeedback.credentials.email}\nPassword: ${accountFeedback.credentials.password}\nPortal: ${window.location.origin}\n--------------------------------------`;
                          navigator.clipboard.writeText(credText);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 3000);
                        }}
                        className="copy-creds-btn"
                      >
                        {copiedKey ? (
                          <>
                            <Check size={16} /> Copied to Clipboard!
                          </>
                        ) : (
                          <>
                            <Copy size={16} /> Copy Login Credentials
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Directory of Managed Accounts */}
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                      Managed Department Accounts Directory ({managedAccounts.length})
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                      All verified Teacher and Staff accounts created by Department Authority.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search by email or name..."
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2rem', fontSize: '0.8rem', width: '100%', paddingBlock: '0.45rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={fetchManagedAccounts}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>
                </div>

                {isLoadingAccounts ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    Loading verified accounts...
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>User / Identity</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Account Role</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Designation & Office</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Created On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {managedAccounts
                          .filter(acc => {
                            if (!accountSearch.trim()) return true;
                            const q = accountSearch.toLowerCase();
                            return (
                              (acc.email && acc.email.toLowerCase().includes(q)) ||
                              (acc.first_name && acc.first_name.toLowerCase().includes(q)) ||
                              (acc.last_name && acc.last_name.toLowerCase().includes(q)) ||
                              (acc.designation && acc.designation.toLowerCase().includes(q))
                            );
                          })
                          .map((acc) => {
                            const isTeacher = acc.role === 'TEACHER';
                            const isSelf = acc.email === 'chair.cse_pust@gmail.com' || acc.id === user?.id;
                            return (
                              <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '10px',
                                      background: isTeacher ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                                      color: '#ffffff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      flexShrink: 0
                                    }}>
                                      {acc.first_name?.[0] || 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>{acc.first_name} {acc.last_name}</span>
                                        {isSelf && (
                                          <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                            CHAIRMAN (YOU)
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                                        {acc.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <span className="badge" style={{
                                    background: isTeacher ? '#e0e7ff' : '#e0f2fe',
                                    color: isTeacher ? '#4338ca' : '#0369a1',
                                    fontWeight: 700,
                                    fontSize: '0.75rem'
                                  }}>
                                    {isTeacher ? '🎓 TEACHER' : '💼 STAFF'}
                                  </span>
                                </td>

                                <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                                  <div style={{ fontWeight: 600 }}>{acc.designation || (isTeacher ? 'Faculty Member' : 'Office Staff')}</div>
                                  <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{acc.room_number || 'Academic Bldg 3'}</div>
                                </td>

                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: acc.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                                    background: acc.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '999px'
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: acc.status === 'ACTIVE' ? '#16a34a' : '#dc2626' }}></span>
                                    {acc.status || 'ACTIVE'}
                                  </span>
                                </td>

                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                                  {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : 'Active'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 4: DEPARTMENT INFORMATION (READ-ONLY FOR SHOWING INFO) */}
          {activeTab === 'dept-info' && (
            <section className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Section Header */}
              <div className="section-heading">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: '#0284c7', color: '#ffffff', fontWeight: 800 }}>
                      🏛️ Department Registry & Syllabus
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Undergraduate B.Sc. in CSE • 40 Seats Intake Capacity
                    </span>
                  </div>
                  <h3>Department Information</h3>
                  <p>Comprehensive curriculum syllabus from 1st Year to 4th Year and student intake directory across all academic sessions.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#0369a1',
                    background: '#e0f2fe',
                    padding: '0.35rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <Eye size={15} /> Read-Only Academic Reference
                  </span>
                </div>
              </div>

              {/* 2 Sub-Sections Navigation Switcher */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.75rem',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => setDeptInfoSubTab('syllabus')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: 'none',
                    background: deptInfoSubTab === 'syllabus' ? '#2563eb' : 'rgba(255,255,255,0.8)',
                    color: deptInfoSubTab === 'syllabus' ? '#ffffff' : '#475569',
                    boxShadow: deptInfoSubTab === 'syllabus' ? '0 4px 14px rgba(37,99,235,0.25)' : 'none'
                  }}
                >
                  <BookOpen size={16} /> 1. Department Syllabus & Curriculum
                </button>

                <button
                  type="button"
                  onClick={() => setDeptInfoSubTab('students')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: 'none',
                    background: deptInfoSubTab === 'students' ? '#059669' : 'rgba(255,255,255,0.8)',
                    color: deptInfoSubTab === 'students' ? '#ffffff' : '#475569',
                    boxShadow: deptInfoSubTab === 'students' ? '0 4px 14px rgba(5,150,105,0.25)' : 'none'
                  }}
                >
                  <Users size={16} /> 2. Student Information (40 Seats Intake)
                </button>
              </div>

              {/* SUBSECTION 1: SYLLABUS */}
              {deptInfoSubTab === 'syllabus' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Semester Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginRight: '0.25rem', flexShrink: 0 }}>
                      Filter Semester:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSemesterFilter('ALL')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid',
                        background: activeSemesterFilter === 'ALL' ? '#1e293b' : '#ffffff',
                        color: activeSemesterFilter === 'ALL' ? '#ffffff' : '#475569',
                        borderColor: activeSemesterFilter === 'ALL' ? '#1e293b' : '#cbd5e1'
                      }}
                    >
                      All 8 Semesters
                    </button>
                    {(curriculumData.semesters || []).map((sem) => (
                      <button
                        key={sem.semester_id}
                        type="button"
                        onClick={() => setActiveSemesterFilter(sem.term_code)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          border: '1px solid',
                          background: activeSemesterFilter === sem.term_code ? '#2563eb' : '#ffffff',
                          color: activeSemesterFilter === sem.term_code ? '#ffffff' : '#475569',
                          borderColor: activeSemesterFilter === sem.term_code ? '#2563eb' : '#cbd5e1'
                        }}
                      >
                        {sem.term_code} • {sem.semester_name}
                      </button>
                    ))}
                  </div>

                  {/* List of Semesters in Chronological Order */}
                  {isLoadingCurriculum ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw className="spin" size={28} style={{ margin: '0 auto 0.5rem' }} />
                      <div>Loading official CSE curriculum & syllabus...</div>
                    </div>
                  ) : (
                    displayedSemesters.map((sem) => (
                      <div
                        key={sem.semester_id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          padding: '1.25rem 1.5rem',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}
                      >
                        {/* Semester Header */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '0.75rem',
                          borderBottom: '1px solid #f1f5f9',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.8rem'
                            }}>
                              {sem.term_code}
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                {sem.semester_name}
                              </h4>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Department of CSE • Standard Academic Term
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                              {sem.courses?.length || 0} Courses
                            </span>
                            <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', fontWeight: 700 }}>
                              {sem.total_credits || 0} Total Credits
                            </span>
                          </div>
                        </div>

                        {/* Courses Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                          gap: '1rem'
                        }}>
                          {(sem.courses || []).map((crs) => (
                            <div
                              key={crs.id}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.65rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                                    <span style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      color: '#1e40af',
                                      background: '#dbeafe',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '6px'
                                    }}>
                                      {crs.course_code}
                                    </span>
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      color: crs.course_type === 'LAB_SESSIONAL' ? '#7c3aed' : '#0369a1',
                                      background: crs.course_type === 'LAB_SESSIONAL' ? '#f3e8ff' : '#e0f2fe',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '6px'
                                    }}>
                                      {crs.course_type === 'LAB_SESSIONAL' ? '🔬 Lab / Sessional' : '📖 Theory'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                                    {crs.course_title}
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  color: '#059669',
                                  background: '#ecfdf5',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {crs.credit_hours} Cr
                                </span>
                              </div>

                              {/* Detailed Syllabus Outline */}
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '0.65rem 0.75rem',
                                fontSize: '0.78rem',
                                color: '#334155',
                                lineHeight: 1.5,
                                flex: 1
                              }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                  Syllabus Content:
                                </div>
                                {crs.syllabus_outline || 'Standard university approved syllabus outline.'}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                                <span>Faculty: <strong>{crs.assigned_teacher_name || 'Department Faculty Pool'}</strong></span>
                                {crs.assigned_teacher_designation && (
                                  <span style={{ fontSize: '0.7rem' }}>{crs.assigned_teacher_designation}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUBSECTION 2: STUDENT INFORMATION (READ-ONLY) */}
              {deptInfoSubTab === 'students' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Department 40-Seat Quota Highlight Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, #09101d 0%, #0f2b38 50%, #064e3b 100%)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    color: '#ffffff',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontWeight: 800, marginBottom: '0.4rem', display: 'inline-block' }}>
                          DEPARTMENT STANDARD: 40 SEATS PER SESSION
                        </span>
                        <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                          Student Intake Capacity & Batch Enrollment
                        </h4>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                          Our Department of CSE admits exactly 40 students per academic batch/session.
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem 1.25rem', borderRadius: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>
                            {selectedSession?.enrolled_count || 0} / 40
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#e2e8f0', textTransform: 'uppercase', fontWeight: 700 }}>
                            Seats Enrolled
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem 1.25rem', borderRadius: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fef08a' }}>
                            {selectedSession ? (40 - (selectedSession.enrolled_count || 0)) : 40}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#e2e8f0', textTransform: 'uppercase', fontWeight: 700 }}>
                            Seats Available
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem 1.25rem', borderRadius: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa' }}>
                            {selectedSession?.fill_percentage || 0}%
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#e2e8f0', textTransform: 'uppercase', fontWeight: 700 }}>
                            Fill Rate
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar for 40 seats */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                        <span>Capacity Occupancy: {selectedSession?.enrolled_count || 0} of 40 Seats</span>
                        <span>{selectedSession?.remaining_seats ?? 40} Seats Remaining</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${selectedSession?.fill_percentage || 0}%`,
                            height: '100%',
                            background: (selectedSession?.fill_percentage || 0) >= 100
                              ? '#ef4444'
                              : (selectedSession?.fill_percentage || 0) > 75
                              ? '#f59e0b'
                              : '#10b981',
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Session Selector & Student Roster */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '1.5rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                  }}>
                    {/* Session Selector Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Select Session:</span>
                        {(studentsOverview || []).map((sess) => (
                          <button
                            key={sess.session_id}
                            type="button"
                            onClick={() => setSelectedSessionId(sess.session_id)}
                            style={{
                              padding: '0.45rem 0.9rem',
                              borderRadius: '8px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid',
                              background: selectedSessionId === sess.session_id ? '#059669' : '#f8fafc',
                              color: selectedSessionId === sess.session_id ? '#ffffff' : '#334155',
                              borderColor: selectedSessionId === sess.session_id ? '#059669' : '#cbd5e1'
                            }}
                          >
                            {sess.session_name} ({sess.enrolled_count || 0}/40)
                          </button>
                        ))}
                      </div>

                      {/* Search Bar */}
                      <div style={{ position: 'relative', width: '260px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search student or roll..."
                          value={studentSearchQuery}
                          onChange={(e) => setStudentSearchQuery(e.target.value)}
                          className="form-input"
                          style={{ paddingLeft: '2rem', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Students Table */}
                    {isLoadingStudents ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw className="spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                        <div>Loading student records...</div>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                        <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontWeight: 700 }}>No Students Found for this Session</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          Use the <strong>Student Information</strong> menu in the sidebar to enroll students (up to 40 seats).
                        </div>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>Roll No</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Email Address</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Reg No</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Phone</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((st) => (
                              <tr key={st.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#1e40af' }}>
                                  {st.student_roll}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                                  {st.first_name} {st.last_name}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                                  {st.email}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                                  {st.registration_no || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                                  {st.phone_number || '—'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#15803d',
                                    background: '#dcfce7',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px'
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                                    {st.status || 'ACTIVE'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 5: COURSE INFORMATION (MENU OPTION: CAN ADD NEW COURSE) */}
          {activeTab === 'course-info' && (
            <section className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header with "+ Add New Course" Button */}
              <div className="section-heading">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 800 }}>
                      📚 Undergraduate Curriculum
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Sequential 8 Semesters • 1st Year to 4th Year
                    </span>
                  </div>
                  <h3>Course Information & Curriculum Management</h3>
                  <p>Courses are chronologically organized by semester (1-1 to 4-2). Inspect course specifications or add new courses to any semester.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    id="btn-add-course"
                    onClick={() => {
                      setIsAddCourseModalOpen(true);
                      setCourseActionFeedback(null);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                    }}
                  >
                    <PlusCircle size={18} /> + Add New Course
                  </button>
                </div>
              </div>

              {/* Semester Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginRight: '0.25rem', flexShrink: 0 }}>
                  Jump to Term:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSemesterFilter('ALL')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    background: activeSemesterFilter === 'ALL' ? '#1e293b' : '#ffffff',
                    color: activeSemesterFilter === 'ALL' ? '#ffffff' : '#475569',
                    borderColor: activeSemesterFilter === 'ALL' ? '#1e293b' : '#cbd5e1'
                  }}
                >
                  All 8 Semesters
                </button>
                {(curriculumData.semesters || []).map((sem) => (
                  <button
                    key={sem.semester_id || sem.id}
                    type="button"
                    onClick={() => setActiveSemesterFilter(sem.term_code)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      border: '1px solid',
                      background: activeSemesterFilter === sem.term_code ? '#2563eb' : '#ffffff',
                      color: activeSemesterFilter === sem.term_code ? '#ffffff' : '#475569',
                      borderColor: activeSemesterFilter === sem.term_code ? '#2563eb' : '#cbd5e1'
                    }}
                  >
                    {sem.term_code} • {sem.semester_name}
                  </button>
                ))}
              </div>

              {/* Sequential Semesters List */}
              {isLoadingCurriculum ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw className="spin" size={28} style={{ margin: '0 auto 0.5rem' }} />
                  <div>Loading courses...</div>
                </div>
              ) : (
                displayedSemesters.map((sem) => (
                  <div
                    key={sem.semester_id || sem.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      padding: '1.5rem',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px solid #f1f5f9',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.9rem'
                        }}>
                          {sem.term_code}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                            {sem.semester_name}
                          </h4>
                          <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                            {sem.courses?.length || 0} Courses • {sem.total_credits || 0} Credits
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCourseForm((prev) => ({ ...prev, semesterId: sem.semester_id || sem.id }));
                          setIsAddCourseModalOpen(true);
                          setCourseActionFeedback(null);
                        }}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Plus size={14} /> Add Course to {sem.term_code}
                      </button>
                    </div>

                    {/* Course Cards Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                      gap: '1rem'
                    }}>
                      {(sem.courses || []).map((crs) => (
                        <div
                          key={crs.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '1.15rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                                <span style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 800,
                                  fontSize: '0.85rem',
                                  color: '#1e40af',
                                  background: '#dbeafe',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  {crs.course_code}
                                </span>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: (crs.course_type === 'Sessional' || crs.course_type === 'LAB') ? '#6d28d9' : crs.course_type === 'Viva' ? '#b45309' : '#0369a1',
                                  background: (crs.course_type === 'Sessional' || crs.course_type === 'LAB') ? '#f5f3ff' : crs.course_type === 'Viva' ? '#fef3c7' : '#e0f2fe',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  {(crs.course_type === 'Sessional' || crs.course_type === 'LAB') ? '🔬 Sessional' : crs.course_type === 'Viva' ? '🗣️ Viva Voce' : '📖 Theory Course'}
                                </span>
                              </div>
                              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                                {crs.course_title}
                              </h5>
                            </div>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              color: '#059669',
                              background: '#ecfdf5',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              whiteSpace: 'nowrap'
                            }}>
                              {crs.credit_hours} Cr
                            </span>
                          </div>

                          <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            fontSize: '0.8rem',
                            color: '#334155',
                            lineHeight: 1.5,
                            flex: 1
                          }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                              Syllabus Outline:
                            </div>
                            {crs.syllabus_outline || 'Comprehensive course syllabus outline.'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                            <span>Faculty: <strong>{crs.assigned_teacher_name || 'Unassigned'}</strong></span>
                            {crs.assigned_teacher_designation && (
                              <span style={{ fontSize: '0.72rem' }}>{crs.assigned_teacher_designation}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {/* TAB 6: STUDENT INFORMATION (MENU OPTION: CAN ADD SESSION & ENROLL STUDENT) */}
          {activeTab === 'student-info' && (
            <section className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header with "+ Create Session" and "+ Add Student" Buttons */}
              <div className="section-heading">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: '#059669', color: '#ffffff', fontWeight: 800 }}>
                      🎓 40 Seats Intake Capacity
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Department of Computer Science & Engineering
                    </span>
                  </div>
                  <h3>Student Information & Section Management</h3>
                  <p>Department approved capacity is 40 seats per session. Create new sections/sessions and enroll student records.</p>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    id="btn-create-session"
                    onClick={() => {
                      setIsAddSessionModalOpen(true);
                      setStudentActionFeedback(null);
                    }}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '0.65rem 1.15rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem'
                    }}
                  >
                    <FolderPlus size={16} /> + Create New Session / Section
                  </button>

                  <button
                    type="button"
                    id="btn-add-student"
                    onClick={() => {
                      setIsAddStudentModalOpen(true);
                      setStudentActionFeedback(null);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
                    }}
                  >
                    <UserPlus size={16} /> + Add Student to Session
                  </button>
                </div>
              </div>

              {/* 40-Seats Quota Highlight Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #09101d 0%, #1e293b 50%, #064e3b 100%)',
                borderRadius: '16px',
                padding: '1.5rem',
                color: '#ffffff',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontWeight: 800, marginBottom: '0.4rem', display: 'inline-block' }}>
                      DEPARTMENT APPROVED INTAKE: 40 SEATS
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                      Session: {selectedSession?.session_name || 'Active Session'}
                    </h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                      Enrollment quota status for the selected session. Limit is strictly enforced at 40 students.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.65rem 1.15rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
                        {selectedSession?.enrolled_count || 0} / 40
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 700 }}>
                        Enrolled
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.65rem 1.15rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fef08a' }}>
                        {selectedSession ? (40 - (selectedSession.enrolled_count || 0)) : 40}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 700 }}>
                        Seats Left
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.65rem 1.15rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
                        {selectedSession?.fill_percentage || 0}%
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 700 }}>
                        Capacity
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quota Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                    <span>{selectedSession?.enrolled_count || 0} of 40 Seats Occupied</span>
                    <span>{selectedSession?.remaining_seats ?? 40} Seats Available</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${selectedSession?.fill_percentage || 0}%`,
                        height: '100%',
                        background: (selectedSession?.fill_percentage || 0) >= 100
                          ? '#ef4444'
                          : (selectedSession?.fill_percentage || 0) > 75
                          ? '#f59e0b'
                          : '#10b981',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Session Selector & Management Table */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Select Session / Section:</span>
                    {(studentsOverview || []).map((sess) => (
                      <button
                        key={sess.session_id}
                        type="button"
                        onClick={() => setSelectedSessionId(sess.session_id)}
                        style={{
                          padding: '0.45rem 0.9rem',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid',
                          background: selectedSessionId === sess.session_id ? '#059669' : '#f8fafc',
                          color: selectedSessionId === sess.session_id ? '#ffffff' : '#334155',
                          borderColor: selectedSessionId === sess.session_id ? '#059669' : '#cbd5e1'
                        }}
                      >
                        {sess.session_name} ({sess.enrolled_count || 0}/40)
                      </button>
                    ))}
                  </div>

                  <div style={{ position: 'relative', width: '260px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search student or roll..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '2rem', fontSize: '0.82rem', width: '100%' }}
                    />
                  </div>
                </div>

                {/* Table */}
                {isLoadingStudents ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw className="spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                    <div>Loading student records...</div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                    <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700 }}>No Students Enrolled in this Session Yet</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      Click <strong>+ Add Student to Session</strong> above to enroll up to 40 students.
                    </div>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Roll No</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Email Address</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Reg No</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Phone</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((st) => (
                          <tr key={st.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#1e40af' }}>
                              {st.student_roll}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                              {st.first_name} {st.last_name}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                              {st.email}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                              {st.registration_no || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                              {st.phone_number || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#15803d',
                                background: '#dcfce7',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                                {st.status || 'ACTIVE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* MODAL 1: ADD NEW COURSE */}
          {/* ========================================================= */}
          {isAddCourseModalOpen && (
            <div className="modal-backdrop" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                animation: 'scaleIn 0.2s ease'
              }}>
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(135deg, #09101d 0%, #1e3a8a 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <PlusCircle size={22} style={{ color: '#60a5fa' }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add New Academic Course</h4>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Department of Computer Science & Engineering</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddCourseModalOpen(false)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddCourse} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Semester Target */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Target Semester <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={courseForm.semesterId}
                      onChange={(e) => setCourseForm({ ...courseForm, semesterId: e.target.value })}
                      required
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.88rem' }}
                    >
                      <option value="">Select Semester...</option>
                      {(curriculumData.semesters || []).map((sem) => (
                        <option key={sem.semester_id} value={sem.semester_id}>
                          {sem.term_code} • {sem.semester_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course Code and Title */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Course Code <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CSE-2101"
                        value={courseForm.courseCode}
                        onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
                        required
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Course Title <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Data Structures & Algorithms"
                        value={courseForm.courseTitle}
                        onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
                        required
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      />
                    </div>
                  </div>

                  {/* Credits & Type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Credit Hours <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="6.0"
                        value={courseForm.creditHours}
                        onChange={(e) => setCourseForm({ ...courseForm, creditHours: e.target.value })}
                        required
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Course Type <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={courseForm.courseType}
                        onChange={(e) => setCourseForm({ ...courseForm, courseType: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      >
                        <option value="THEORY">Theory (Lecture)</option>
                        <option value="LAB_SESSIONAL">Lab / Sessional</option>
                      </select>
                    </div>
                  </div>

                  {/* Faculty Assignment (Optional) */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Designate Course Teacher (Optional)
                    </label>
                    <select
                      value={courseForm.assignedTeacherId}
                      onChange={(e) => setCourseForm({ ...courseForm, assignedTeacherId: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.88rem' }}
                    >
                      <option value="">Department Faculty Pool (Assign Later)</option>
                      {facultyList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.email}) — {f.designation || 'Faculty'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Syllabus Outline */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Detailed Syllabus Outline & Topics
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Enter detailed course topics, reference textbooks, and continuous evaluation criteria..."
                      value={courseForm.syllabusOutline}
                      onChange={(e) => setCourseForm({ ...courseForm, syllabusOutline: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>

                  {/* Feedback */}
                  {courseActionFeedback && (
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: courseActionFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
                      color: courseActionFeedback.type === 'error' ? '#b91c1c' : '#065f46',
                      border: `1px solid ${courseActionFeedback.type === 'error' ? '#fecaca' : '#a7f3d0'}`
                    }}>
                      {courseActionFeedback.text}
                    </div>
                  )}

                  {/* Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsAddCourseModalOpen(false)}
                      style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingCourse}
                      style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isSubmittingCourse ? 'Adding Course...' : 'Create Course Now'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL 2: CREATE NEW SESSION / SECTION */}
          {/* ========================================================= */}
          {isAddSessionModalOpen && (
            <div className="modal-backdrop" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '500px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(135deg, #09101d 0%, #064e3b 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <FolderPlus size={22} style={{ color: '#34d399' }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Create New Academic Session / Section</h4>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Intake Quota: 40 Seats Approved</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddSessionModalOpen(false)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddSession} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Session Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2024-2025"
                      value={sessionForm.sessionName}
                      onChange={(e) => setSessionForm({ ...sessionForm, sessionName: e.target.value })}
                      required
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.9rem' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                      Each new session is configured with standard department capacity of <strong>40 seats</strong>.
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={sessionForm.startDate}
                        onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        End Date
                      </label>
                      <input
                        type="date"
                        value={sessionForm.endDate}
                        onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <input
                      type="checkbox"
                      id="isCurrentSession"
                      checked={sessionForm.isCurrent}
                      onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="isCurrentSession" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      Set as current active academic session
                    </label>
                  </div>

                  {studentActionFeedback && (
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: studentActionFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
                      color: studentActionFeedback.type === 'error' ? '#b91c1c' : '#065f46',
                      border: `1px solid ${studentActionFeedback.type === 'error' ? '#fecaca' : '#a7f3d0'}`
                    }}>
                      {studentActionFeedback.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsAddSessionModalOpen(false)}
                      style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSession}
                      style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: '#059669', color: '#ffffff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isSubmittingSession ? 'Creating...' : 'Create Session (40 Seats)'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL 3: ADD STUDENT TO SESSION (ENFORCING 40 SEATS LIMIT) */}
          {/* ========================================================= */}
          {isAddStudentModalOpen && (
            <div className="modal-backdrop" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{
                background: '#ffffff',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'linear-gradient(135deg, #09101d 0%, #065f46 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <UserPlus size={22} style={{ color: '#34d399' }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Student to Session</h4>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Intake Quota: Strict 40 Seats Limit</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddStudentModalOpen(false)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddStudent} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Target Session with 40-Seats Tracker */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Target Session / Section <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={studentForm.sessionId}
                      onChange={(e) => setStudentForm({ ...studentForm, sessionId: e.target.value })}
                      required
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.88rem' }}
                    >
                      <option value="">Select Session...</option>
                      {(studentsOverview || []).map((sess) => (
                        <option key={sess.session_id} value={sess.session_id}>
                          {sess.session_name} ({sess.enrolled_count || 0}/40 seats filled • {40 - (sess.enrolled_count || 0)} available)
                        </option>
                      ))}
                    </select>

                    {/* Seat capacity feedback */}
                    {studentForm.sessionId && (() => {
                      const sess = (studentsOverview || []).find((s) => s.session_id === studentForm.sessionId);
                      const isFull = sess && sess.enrolled_count >= 40;
                      return (
                        <div style={{
                          marginTop: '0.4rem',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isFull ? '#fee2e2' : '#ecfdf5',
                          color: isFull ? '#b91c1c' : '#065f46',
                          border: `1px solid ${isFull ? '#fca5a5' : '#a7f3d0'}`
                        }}>
                          {isFull
                            ? '⚠️ Max Capacity Reached: 40/40 seats occupied in this session. Cannot enroll more.'
                            : `✅ Available Capacity: ${40 - (sess?.enrolled_count || 0)} seats remaining out of 40.`}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Student Roll and Registration No */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Roll / Student ID <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 240101"
                        value={studentForm.studentRoll}
                        onChange={(e) => setStudentForm({ ...studentForm, studentRoll: e.target.value })}
                        required
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Registration No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24010101"
                        value={studentForm.registrationNo}
                        onChange={(e) => setStudentForm({ ...studentForm, registrationNo: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        First Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Md. Tanvir"
                        value={studentForm.firstName}
                        onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Last Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hossain"
                        value={studentForm.lastName}
                        onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      />
                    </div>
                  </div>

                  {/* Email & Initial Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                        Student Email (Login) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. tanvir.cse@gmail.com"
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                        required
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setStudentForm({ ...studentForm, password: 'STU_' + Math.floor(100000 + Math.random() * 900000) })}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Auto-Generate
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Default: 12345678"
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'block' }}>
                      Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +880 1712-345678"
                      value={studentForm.phoneNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, phoneNumber: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.88rem' }}
                    />
                  </div>

                  {studentActionFeedback && (
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: studentActionFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
                      color: studentActionFeedback.type === 'error' ? '#b91c1c' : '#065f46',
                      border: `1px solid ${studentActionFeedback.type === 'error' ? '#fecaca' : '#a7f3d0'}`
                    }}>
                      {studentActionFeedback.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsAddStudentModalOpen(false)}
                      style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingStudent || (() => {
                        const sess = (studentsOverview || []).find((s) => s.session_id === studentForm.sessionId);
                        return Boolean(sess && sess.enrolled_count >= 40);
                      })()}
                      style={{
                        padding: '0.65rem 1.5rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#059669',
                        color: '#ffffff',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: (() => {
                          const sess = (studentsOverview || []).find((s) => s.session_id === studentForm.sessionId);
                          return (sess && sess.enrolled_count >= 40) ? 0.5 : 1;
                        })()
                      }}
                    >
                      {isSubmittingStudent ? 'Enrolling...' : 'Enroll Student'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ========================================================= */
        /* 2. SPECIFIC COURSE WORKSPACE VIEW (MATCHING DESIGN) */
        /* ========================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Workspace Option Switcher (Matches Main Page Design) */}
          <div className="option-switch" role="tablist" aria-label="Course workspace options">
            {[
              {
                id: 'assessment',
                title: 'Continuous Assessment (30 Marks Matrix)',
                sub: '3 CTs (Best 2) + Attendance (/10) • Grade & Position live calculation',
                icon: Award,
                count: `${computedStudents.length} Students`,
                theme: 'emerald',
              },
              {
                id: 'materials',
                title: 'Lecture Materials & Syllabi',
                sub: 'Upload course lecture notes, slides and syllabus documents',
                icon: FileText,
                count: `${materials.length} Files`,
                theme: 'indigo',
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const isActive = workspaceTab === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`course-workspace-tab-${opt.id}`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setWorkspaceTab(opt.id)}
                  className={`option-card option-${opt.theme} ${isActive ? 'active' : ''}`}
                >
                  <span className="option-icon"><Icon size={22} /></span>
                  <span className="option-text">
                    <span className="option-title">{opt.title}</span>
                    <span className="option-sub">{opt.sub}</span>
                  </span>
                  <span className="option-count">{opt.count}</span>
                </button>
              );
            })}
          </div>

          {/* OPTION 1: CONTINUOUS ASSESSMENT MATRIX (30 MARKS) */}
          {workspaceTab === 'assessment' && (
            <section className="fade-in-up">
              {/* Assessment Policy & Actions Header */}
              <div className="ca-policy-card">
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065f46', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} /> Continuous Assessment Policy (Total 30 Marks)
                  </div>
                  <div className="ca-policy-points">
                    <span className="ca-pill">CT-1, CT-2, CT-3: Max 10 Marks each</span>
                    <span className="ca-pill">Attendance: Max 10 Marks</span>
                    <span className="ca-pill" style={{ background: '#ecfdf5', borderColor: '#10b981', color: '#047857' }}>
                      Final CA = Best 2 of 3 CTs (20) + Attendance (10) = 30 Marks
                    </span>
                    <span className="ca-pill" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af' }}>
                      Letter Grade & Position computed live
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {isAssignedTeacher && (
                    <>
                      {/* AI SMART AUTO-FILL BUTTON (REPLACES CSV-ONLY) */}
                      <button
                        onClick={() => {
                          setIsAiModalOpen(true);
                          setAiResult(null);
                          setAiError(null);
                          setAiFile(null);
                          setAiRawText('');
                        }}
                        className="ai-smart-btn"
                        title="Upload PDF, Excel, CSV or text sheet for AI auto-extraction and calculation"
                      >
                        <Sparkles size={16} /> AI Auto-Fill (PDF, Excel, CSV)
                      </button>

                      <button
                        onClick={handleSaveMatrix}
                        disabled={isSavingMatrix}
                        className="btn btn-primary"
                        style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem' }}
                      >
                        <Save size={16} /> {isSavingMatrix ? 'Saving...' : 'Save Assessment Matrix'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Assessment Matrix Table */}
              <div className="ca-matrix-card">
                <div className="ca-matrix-header">
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Class Continuous Assessment (CA) Roster
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                      {isAssignedTeacher 
                        ? 'Enter marks directly below or click "AI Auto-Fill" to submit PDF/Excel/CSV files. All marks, Best 2, Grade, and Position calculate automatically.'
                        : 'Read-only view of published marks for this course.'}
                    </p>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    Enrolled: <strong style={{ color: '#0f172a' }}>{computedStudents.length} Students</strong>
                  </div>
                </div>

                <div className="ca-matrix-table-wrap">
                  <table className="ca-table">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th style={{ textAlign: 'center' }}>CT-1 (/10)</th>
                        <th style={{ textAlign: 'center' }}>CT-2 (/10)</th>
                        <th style={{ textAlign: 'center' }}>CT-3 (/10)</th>
                        <th style={{ textAlign: 'center' }} className="col-highlight-best">Best 2 CTs (/20)</th>
                        <th style={{ textAlign: 'center' }}>Attendance (/10)</th>
                        <th style={{ textAlign: 'center' }} className="col-highlight-total">Final CA (/30)</th>
                        <th style={{ textAlign: 'center' }}>Grade</th>
                        <th style={{ textAlign: 'center' }}>Position</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            No students enrolled in this course session yet.
                          </td>
                        </tr>
                      ) : (
                        computedStudents.map((s) => {
                          const rank = rankMap[s.student_id];
                          const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : rank ? 'rank-other' : 'rank-none';

                          return (
                            <tr key={s.student_id}>
                              {/* Roll Number */}
                              <td style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                {s.student_roll}
                              </td>

                              {/* Student Name */}
                              <td style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {s.student_name}
                              </td>

                              {/* CT 1 */}
                              <td style={{ textAlign: 'center' }}>
                                {isAssignedTeacher ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={s.marks.ct1}
                                    placeholder="—"
                                    onChange={(e) => handleMarkChange(s.student_id, 'ct1', e.target.value)}
                                    className="ca-input"
                                    style={s.ca.countedCTs.has(1) ? { borderColor: '#3b82f6', background: '#eff6ff' } : {}}
                                  />
                                ) : (
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    {s.marks.ct1 !== '' ? s.marks.ct1 : '—'}
                                  </span>
                                )}
                              </td>

                              {/* CT 2 */}
                              <td style={{ textAlign: 'center' }}>
                                {isAssignedTeacher ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={s.marks.ct2}
                                    placeholder="—"
                                    onChange={(e) => handleMarkChange(s.student_id, 'ct2', e.target.value)}
                                    className="ca-input"
                                    style={s.ca.countedCTs.has(2) ? { borderColor: '#3b82f6', background: '#eff6ff' } : {}}
                                  />
                                ) : (
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    {s.marks.ct2 !== '' ? s.marks.ct2 : '—'}
                                  </span>
                                )}
                              </td>

                              {/* CT 3 */}
                              <td style={{ textAlign: 'center' }}>
                                {isAssignedTeacher ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={s.marks.ct3}
                                    placeholder="—"
                                    onChange={(e) => handleMarkChange(s.student_id, 'ct3', e.target.value)}
                                    className="ca-input"
                                    style={s.ca.countedCTs.has(3) ? { borderColor: '#3b82f6', background: '#eff6ff' } : {}}
                                  />
                                ) : (
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    {s.marks.ct3 !== '' ? s.marks.ct3 : '—'}
                                  </span>
                                )}
                              </td>

                              {/* Best 2 of CTs */}
                              <td style={{ textAlign: 'center' }} className="col-highlight-best">
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                                  {s.ca.best2Sum} <span style={{ fontSize: '0.72rem', color: '#64748b' }}>/20</span>
                                </span>
                              </td>

                              {/* Attendance */}
                              <td style={{ textAlign: 'center' }}>
                                {isAssignedTeacher ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={s.marks.attendance}
                                    placeholder="—"
                                    onChange={(e) => handleMarkChange(s.student_id, 'attendance', e.target.value)}
                                    className="ca-input"
                                    style={{ borderColor: '#10b981', background: '#ecfdf5' }}
                                  />
                                ) : (
                                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    {s.marks.attendance !== '' ? s.marks.attendance : '—'}
                                  </span>
                                )}
                              </td>

                              {/* Total CA (out of 30) */}
                              <td style={{ textAlign: 'center' }} className="col-highlight-total">
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>
                                  {s.ca.totalCA !== null ? s.ca.totalCA : '—'}
                                </span>
                                {s.ca.totalCA !== null && (
                                  <span style={{ fontSize: '0.72rem', color: '#047857', display: 'block' }}>/ 30</span>
                                )}
                              </td>

                              {/* Letter Grade */}
                              <td style={{ textAlign: 'center' }}>
                                <span className={`grade-badge ${s.ca.gradeClass}`}>
                                  {s.ca.grade}
                                </span>
                              </td>

                              {/* Position / Rank */}
                              <td style={{ textAlign: 'center' }}>
                                <span className={`rank-pill ${rankClass}`}>
                                  {rank === 1 && <Medal size={13} />}
                                  {formatOrdinal(rank)}
                                </span>
                              </td>

                              {/* Remarks */}
                              <td>
                                {isAssignedTeacher ? (
                                  <input
                                    type="text"
                                    placeholder="e.g. Excellent"
                                    value={s.marks.remarks}
                                    onChange={(e) => handleMarkChange(s.student_id, 'remarks', e.target.value)}
                                    className="ca-remark-input"
                                  />
                                ) : (
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    {s.marks.remarks || '—'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {isAssignedTeacher && computedStudents.length > 0 && (
                  <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      onClick={handleSaveMatrix}
                      disabled={isSavingMatrix}
                      className="btn btn-primary"
                    >
                      <Save size={16} /> {isSavingMatrix ? 'Committing Changes...' : 'Save All Assessment Marks'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* OPTION 2: LECTURE MATERIALS & SYLLABI */}
          {workspaceTab === 'materials' && (
            <section className="fade-in-up" style={{ display: 'grid', gridTemplateColumns: isAssignedTeacher ? '1fr 2fr' : '1fr', gap: '1.5rem' }}>
              {/* Material Upload Form (Only for Assigned Faculty) */}
              {isAssignedTeacher && (
                <div className="card">
                  <h3 className="card-title"><UploadCloud size={18} /> Upload Lecture Material</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Published notes and slides are immediately available to all enrolled students.
                  </p>

                  <form onSubmit={handleUploadMaterial}>
                    <div className="form-group">
                      <label className="form-label">Material Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Lecture 04: Normalization & BCNF"
                        value={materialForm.title}
                        onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Topic Description (Optional)</label>
                      <textarea
                        rows={3}
                        placeholder="Key points covered, problem sets, recommended reading..."
                        value={materialForm.description}
                        onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                        className="form-textarea"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Attach File (PDF, PPT, DOCX)</label>
                      <input
                        type="file"
                        onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] })}
                        className="form-input"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      <UploadCloud size={16} /> Publish Material
                    </button>
                  </form>
                </div>
              )}

              {/* Published Materials List */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title"><FileText size={18} /> Course Lecture Notes & Resources</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                      Verified learning materials published for {courseDetails?.course_code}.
                    </p>
                  </div>
                  <span className="badge badge-active">{materials.length} Published</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {materials.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No lecture materials published for this course yet.
                    </div>
                  ) : (
                    materials.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '1rem 1.25rem',
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{m.title}</div>
                          {m.description && (
                            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.25rem' }}>
                              {m.description}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                            By {m.uploader_name} • {new Date(m.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <a
                            href={m.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <Download size={14} /> Download
                          </a>
                          {isAssignedTeacher && (
                            <button
                              onClick={() => handleDeleteMaterial(m.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}
                              title="Delete Material"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* AI SMART MARKS AUTO-DETECT & AUTO-FILL MODAL */}
      {/* Accepts ANY file: PDF, Excel (.xlsx, .xls), CSV, or Text */}
      {/* ========================================================= */}
      {isAiModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '820px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#ffffff', borderRadius: '18px 18px 0 0', padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} style={{ color: '#fef08a' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    AI Multi-Format Assessment Mark Auto-Detector
                  </h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.85, margin: '0.15rem 0 0' }}>
                    Submit PDF, Excel, CSV or text files — AI maps student rolls and calculates Continuous Assessment automatically.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAiModalOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Scan State 1: In Progress */}
              {aiScanning && (
                <div className="ai-scanning-box">
                  <div className="ai-pulse-ring">
                    <Sparkles size={32} />
                  </div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>
                    AI is Analyzing Document Structure...
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '480px', margin: 0 }}>
                    Extracting student roll numbers, parsing marks for CT-1, CT-2, CT-3, and Attendance, and computing Best 2, Final CA (/30), Grade, and Positions...
                  </p>
                </div>
              )}

              {/* Scan State 2: Extracted Preview Results */}
              {!aiScanning && aiResult && (
                <div className="fade-in-up">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: '#ecfdf5', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #a7f3d0', marginBottom: '1.25rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle size={18} /> Successfully Detected: {aiResult.fileType} Document
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.2rem' }}>
                        Matched <strong>{aiResult.matchedCount} of {aiResult.totalEnrolled}</strong> enrolled students from <em>{aiResult.fileName}</em>.
                      </div>
                    </div>
                    <span className="badge" style={{ background: '#059669', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800 }}>
                      Continuous Assessment Computed
                    </span>
                  </div>

                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                    Detected Marks & Live Calculations Preview:
                  </div>

                  <div className="ai-preview-table-wrap">
                    <table className="ca-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Roll</th>
                          <th>Student Name</th>
                          <th style={{ textAlign: 'center' }}>CT-1</th>
                          <th style={{ textAlign: 'center' }}>CT-2</th>
                          <th style={{ textAlign: 'center' }}>CT-3</th>
                          <th style={{ textAlign: 'center' }} className="col-highlight-best">Best 2 (/20)</th>
                          <th style={{ textAlign: 'center' }}>Att (/10)</th>
                          <th style={{ textAlign: 'center' }} className="col-highlight-total">Final (/30)</th>
                          <th style={{ textAlign: 'center' }}>Grade</th>
                          <th style={{ textAlign: 'center' }}>Rank</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.results.map((r) => (
                          <tr key={r.studentId}>
                            <td style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{r.studentRoll}</td>
                            <td style={{ fontWeight: 600 }}>{r.studentName}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.ct1 !== '' ? r.ct1 : '—'}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.ct2 !== '' ? r.ct2 : '—'}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.ct3 !== '' ? r.ct3 : '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }} className="col-highlight-best">{r.best2}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.attendance !== '' ? r.attendance : '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800 }} className="col-highlight-total">{r.totalCA !== null ? r.totalCA : '—'}</td>
                            <td style={{ textAlign: 'center' }}><span className="grade-badge grade-aplus" style={{ fontSize: '0.72rem', minWidth: '36px', padding: '0.2rem 0.4rem' }}>{r.grade}</span></td>
                            <td style={{ textAlign: 'center' }}><span className="rank-pill rank-1" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>{formatOrdinal(r.position)}</span></td>
                            <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {aiResult.unmatched && aiResult.unmatched.length > 0 && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e' }}>
                      <strong>Notice:</strong> {aiResult.unmatched.length} rows in the file did not match any enrolled student in this course session.
                    </div>
                  )}
                </div>
              )}

              {/* Scan State 3: Upload / Paste Form */}
              {!aiScanning && !aiResult && (
                <div>
                  {/* Drag and Drop Zone */}
                  <div
                    className={`ai-dropzone ${isDragging ? 'drag-active' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0];
                        setAiFile(file);
                        handleAiAutoDetect(file, '');
                      }
                    }}
                    onClick={() => document.getElementById('ai-file-input').click()}
                  >
                    <input
                      id="ai-file-input"
                      type="file"
                      accept=".pdf, .xlsx, .xls, .csv, .tsv, .txt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setAiFile(file);
                          handleAiAutoDetect(file, '');
                        }
                      }}
                    />

                    <div style={{ width: '56px', height: '56px', margin: '0 auto 1rem', borderRadius: '16px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                      <UploadCloud size={28} />
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>
                      Drop your PDF, Excel, or CSV file here
                    </h4>
                    <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0 0 1rem' }}>
                      Or click to browse from your computer. The AI will automatically detect format and parse CT marks.
                    </p>

                    <div className="format-badges">
                      <span className="format-badge format-badge-pdf">PDF Document (.pdf)</span>
                      <span className="format-badge format-badge-excel">Excel Workbook (.xlsx, .xls)</span>
                      <span className="format-badge format-badge-csv">CSV Spreadsheet (.csv)</span>
                      <span className="format-badge format-badge-text">Tabular Text (.txt)</span>
                    </div>
                  </div>

                  {/* Alternative: Paste Tabular Text */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Table size={15} /> OR Paste Marks Table from Clipboard:
                    </div>
                    <textarea
                      rows={3}
                      placeholder={`Paste spreadsheet rows or text, e.g.:\nCSE-20230101 9.5 9.0 8.5 9.5 Good\nCSE-20230102 8.0 9.0 8.5 9.0 Very Good`}
                      value={aiRawText}
                      onChange={(e) => setAiRawText(e.target.value)}
                      className="form-textarea"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                    />
                    {aiRawText && (
                      <button
                        onClick={() => handleAiAutoDetect(null, aiRawText)}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '0.5rem' }}
                      >
                        <Zap size={14} /> Detect & Parse Pasted Text
                      </button>
                    )}
                  </div>

                  {/* Pre-filled template download helper */}
                  <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>Need an Official Pre-Populated Roster?</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Download a pre-filled student roll template for this course.</div>
                    </div>
                    <a
                      href={`/api/courses/${activeCourseId}/ct-marks/template`}
                      download
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      <Download size={14} /> Download Course Template
                    </a>
                  </div>

                  {aiError && (
                    <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: '0.825rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={16} /> {aiError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderRadius: '0 0 18px 18px' }}>
              <button 
                type="button" 
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiResult(null);
                  setAiError(null);
                }} 
                className="btn btn-secondary"
              >
                Close
              </button>

              {aiResult && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAiResult(null);
                      setAiFile(null);
                      setAiRawText('');
                    }}
                    className="btn btn-secondary"
                  >
                    Upload Another File
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyAiMarks(false)}
                    className="btn btn-secondary"
                    style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8', fontWeight: 700 }}
                  >
                    <Zap size={15} /> Apply & Auto-Fill Matrix
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyAiMarks(true)}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                  >
                    <Check size={16} /> Apply & Save to Database
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
