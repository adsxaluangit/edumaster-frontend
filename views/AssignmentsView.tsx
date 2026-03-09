import React, { useState, useEffect } from 'react';
import { fetchCategory, fetchItem, createCategory, updateCategory, COLLECTIONS } from '../services/api';
import { Calendar, Save, Printer, UserCheck, BookOpen, Clock, FileSpreadsheet, ChevronRight, CheckCircle2, Info, X, Edit, Users, RefreshCw, ClipboardList } from 'lucide-react';
import ExcelJS from 'exceljs';

interface DetailedAssignmentRow {
  subjectId: string;
  subjectName: string;
  date: string;
  shift: 'Sáng' | 'Chiều' | 'Tối';
  teacherId: string;
  teacherName: string;
  notes: string;
}

const AssignmentsView: React.FC = () => {
  const [classDecisions, setClassDecisions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // State for Modal Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<any>(null); // Store full decision object
  const [currentClassName, setCurrentClassName] = useState('');
  const [currentDecisionNumber, setCurrentDecisionNumber] = useState('');
  const [assignmentRows, setAssignmentRows] = useState<DetailedAssignmentRow[]>([]);

  /* State to track existing assignment ID in Strapi */
  const [existingAssignmentId, setExistingAssignmentId] = useState<string | null>(null);
  const [autoStartDate, setAutoStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalOccupancy, setGlobalOccupancy] = useState<Record<string, Record<string, Record<string, boolean>>>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [decisionsData, teachersData, subjectsData] = await Promise.all([
        fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students]=true`),
        fetchCategory(COLLECTIONS.TEACHERS),
        fetchCategory(COLLECTIONS.SUBJECTS)
      ]);

      // 1. Identify IDs of Opening decisions that already have a Recognition decision
      const finalizedOpeningIds = new Set(
        (decisionsData || [])
          .filter((d: any) => d.type === 'RECOGNITION')
          .map((d: any) => {
            const rel = d.related_decision?.data || d.related_decision;
            return String(rel?.documentId || rel?.id || '');
          })
          .filter((id: string) => id !== '')
      );

      // 2. Filter valid decisions: must be OPENING and not finalized
      const validDecisions = (decisionsData || [])
        .filter((d: any) => {
          const isOpening = d.type === 'OPENING';
          const classData = d.school_class?.data || d.school_class;
          const isNotFinalized = !finalizedOpeningIds.has(String(d.documentId || d.id));
          return isOpening && !!classData && isNotFinalized;
        }).map((d: any) => ({
          id: d.id,
          documentId: d.documentId,
          decisionNumber: d.decision_number,
          trainingCourse: d.training_course,
          className: (d.school_class?.data?.attributes?.name || d.school_class?.name || d.school_class?.attributes?.name),
          classId: String(d.school_class?.documentId || d.school_class?.data?.documentId || d.school_class?.id || d.school_class?.data?.id || ''),
          signedDate: d.signed_date,
          studentCount: (d.students?.data?.length || d.students?.length || 0),
          students: (d.students?.data || d.students || []), // Preserve students list
          _debug_school_class: d.school_class // Add this for debugging
        }));

      console.log("Decisions Data for Debugging:", validDecisions);

      // Fetch subjects for each class to ensure we have the correct count
      const enrichedDecisions = await Promise.all(validDecisions.map(async (d: any) => {
        if (d.classId) {
          try {
            // Fetch class details with populate=* to get subjects
            const classDetail = await fetchItem(COLLECTIONS.CLASSES, d.classId);
            if (classDetail) {
              // Handle both Strapi v4 structure (data.attributes) and flat structure
              // Sometimes it's classDetail.subjects (array), sometimes classDetail.subjects.data (array wrapper)
              let subjectsData = [];
              if (Array.isArray(classDetail.subjects)) {
                subjectsData = classDetail.subjects;
              } else if (classDetail.subjects && Array.isArray(classDetail.subjects.data)) {
                subjectsData = classDetail.subjects.data;
              } else if (classDetail.data?.attributes?.subjects?.data) {
                subjectsData = classDetail.data?.attributes?.subjects?.data;
              } else if (classDetail.attributes?.subjects?.data) {
                subjectsData = classDetail.attributes?.subjects?.data;
              }

              return { ...d, subjects: subjectsData };
            }
          } catch (err) {
            console.warn(`Failed to fetch class details for ${d.className}`, err);
          }
        }
        return d;
      }));

      setClassDecisions(enrichedDecisions);
      setTeachers(teachersData || []);
      setSubjects(subjectsData || []);

    } catch (e) {
      console.error("Failed to load initial data", e);
    }
  };

  const refreshGlobalOccupancy = async (excludeAssignmentId?: string | null) => {
    try {
      const allAssignments = await fetchCategory(COLLECTIONS.TRAINING_ASSIGNMENTS);
      const occupancy: Record<string, Record<string, Record<string, boolean>>> = {};

      (allAssignments || []).forEach((assign: any) => {
        const assignId = String(assign.documentId || assign.id);
        if (excludeAssignmentId && assignId === String(excludeAssignmentId)) return;

        if (assign.schedule && Array.isArray(assign.schedule)) {
          assign.schedule.forEach((row: any) => {
            if (row.date && row.shift && row.teacherId) {
              const d = row.date;
              const s = row.shift;
              const tId = String(row.teacherId);

              if (!occupancy[d]) occupancy[d] = {};
              if (!occupancy[d][s]) occupancy[d][s] = {};
              occupancy[d][s][tId] = true;
            }
          });
        }
      });
      setGlobalOccupancy(occupancy);
      return occupancy;
    } catch (e) {
      console.warn("Failed to refresh global occupancy", e);
      return {};
    }
  };

  const openAssignmentForm = async (decision: any) => {
    setSelectedClassId(decision.strapiId || decision.id);
    setSelectedDecision(decision);
    setCurrentClassName(decision.className);
    setCurrentDecisionNumber(decision.decisionNumber);

    // Load assignment data
    await loadAssignmentForClass(decision);
    await refreshGlobalOccupancy(null);

    setIsFormOpen(true);
  };

  const loadAssignmentForClass = async (decision: any, forceReset: boolean = false, startDate?: string) => {
    const decisionId = decision.id;

    // Try multiple keys for finding assignments (Strapi v4 filter syntax)
    // We want to find an assignment where decision.id === decisionId
    try {
      setExistingAssignmentId(null);

      // Fetch existing assignments for this decision
      // Filter: filters[decision][documentId][$eq]=decisionId
      const query = `${COLLECTIONS.TRAINING_ASSIGNMENTS}?filters[decision][documentId][$eq]=${decisionId}`;
      const existingAssignments = await fetchCategory(query);

      if (existingAssignments && existingAssignments.length > 0) {
        const assignment = existingAssignments[0];
        if (assignment.schedule) {
          setAssignmentRows(assignment.schedule);
          const assignId = assignment.documentId || assignment.id;
          setExistingAssignmentId(assignId);
          await refreshGlobalOccupancy(assignId);

          if (!forceReset) return; // If loaded and not forced reset, we are done
        }
      }
    } catch (e) {
      console.warn("Failed to fetch existing assignments", e);
    }

    // Fallback: If no assignment found OR forceReset is true, generate new
    console.log("Generating auto-schedule for:", decision.className);

    let classSubjects: any[] = [];

    // Initial check from decision object
    if (Array.isArray(decision.subjects)) {
      classSubjects = decision.subjects;
    } else if (decision.subjects?.data) {
      classSubjects = decision.subjects.data;
    }

    // If empty, force fetch again from API to be absolutely sure
    if (classSubjects.length === 0 && decision.classId) {
      try {
        // Try fetching class directly
        const classDetail = await fetchItem(COLLECTIONS.CLASSES, decision.classId);
        console.log("Forced fetch class details:", classDetail);

        if (classDetail) {
          if (Array.isArray(classDetail.subjects)) {
            classSubjects = classDetail.subjects;
          } else if (classDetail.subjects?.data) {
            classSubjects = classDetail.subjects.data;
          } else if (classDetail.data?.attributes?.subjects?.data) {
            classSubjects = classDetail.data?.attributes?.subjects?.data;
          }
        }
      } catch (e) {
        console.warn("Could not fetch class details for subjects", e);
      }
    }

    // If classSubjects is empty after all attempts, show placeholder
    if (classSubjects.length === 0) {
      setAssignmentRows([{
        subjectId: 'temp',
        subjectName: 'Chưa có môn học trong chương trình đào tạo',
        date: new Date().toISOString().split('T')[0],
        shift: 'Sáng',
        teacherId: '',
        teacherName: '',
        notes: ''
      }]);
      return;
    }

    // --- AUTO SCHEDULING ALGORITHM ---
    // Rules:
    // 1. Each teacher teaches only 1 subject per course
    // 2. Priority: Morning -> Afternoon -> Evening (only when no teacher available)
    // 3. No duplicate day: if teacher is teaching on a date (any shift), skip entire day
    // 4. Manual dropdown: hide teachers busy on that date+shift

    let initialRows: DetailedAssignmentRow[] = [];

    // 1. Prepare session queue
    const sessionQueue: { subId: string, subName: string }[] = [];

    classSubjects.forEach((subRef: any) => {
      const subId = String(subRef.documentId || subRef.id);
      const sub = subjects.find(s => String(s.id) === subId || String(s.documentId) === subId) || subRef;
      const subName = sub.attributes?.name || sub.name || "Môn học";
      const totalHours = sub.attributes?.total_hours || sub.total_hours || sub.totalHours || 4;

      const sessions = Math.ceil(totalHours / 4);
      for (let i = 0; i < sessions; i++) {
        sessionQueue.push({ subId, subName });
      }
    });

    if (sessionQueue.length === 0) {
      setAssignmentRows([{
        subjectId: 'temp',
        subjectName: 'Chưa có môn học trong chương trình đào tạo',
        date: new Date().toISOString().split('T')[0],
        shift: 'Sáng',
        teacherId: '',
        teacherName: '',
        notes: ''
      }]);
      return;
    }

    // 2. Schedule sessions
    let currentDate = startDate ? new Date(startDate) : new Date();
    const MAX_DAYS = 365;
    const getYMD = (d: Date) => d.toISOString().split('T')[0];

    // --- Build global occupancy from ALL OTHER existing assignments ---
    // globalDateTeacher[date] = Set<teacherId> - teacher is busy on this entire date
    const globalDateTeacher: Record<string, Set<string>> = {};
    // globalShiftTeacher[date][shift] = Set<teacherId>
    const globalShiftTeacher: Record<string, Record<string, Set<string>>> = {};

    try {
      const allAssignments = await fetchCategory(COLLECTIONS.TRAINING_ASSIGNMENTS);
      (allAssignments || []).forEach((assign: any) => {
        if (String(assign.id) === String(existingAssignmentId) || String(assign.documentId) === String(existingAssignmentId)) return;

        if (assign.schedule && Array.isArray(assign.schedule)) {
          assign.schedule.forEach((row: any) => {
            if (row.date && row.shift && row.teacherId) {
              const d = row.date;
              const s = row.shift;
              const tId = String(row.teacherId);

              if (!globalDateTeacher[d]) globalDateTeacher[d] = new Set();
              globalDateTeacher[d].add(tId);

              if (!globalShiftTeacher[d]) globalShiftTeacher[d] = {};
              if (!globalShiftTeacher[d][s]) globalShiftTeacher[d][s] = new Set();
              globalShiftTeacher[d][s].add(tId);
            }
          });
        }
      });
    } catch (e) {
      console.warn("Global conflict detection failed", e);
    }

    // Track within THIS course
    const courseTeacherSubject: Record<string, string> = {}; // teacherId -> subjectId (1 GV = 1 Môn)
    const courseDateTeacher: Record<string, Set<string>> = {}; // date -> Set<teacherId>

    // Helper: can teacher teach this subject?
    const canTeachSubject = (teacher: any, subId: string): boolean => {
      const tSubjects = teacher.subjects || teacher.data?.attributes?.subjects?.data || [];
      return tSubjects.some((ts: any) => String(ts.documentId || ts.id) === subId);
    };

    // Helper: is teacher available on this date for this subject?
    const isAvailable = (tId: string, dateStr: string, subId: string): boolean => {
      // Rule 1: 1 GV = 1 Môn per course
      if (courseTeacherSubject[tId] && courseTeacherSubject[tId] !== subId) return false;
      // Rule 3: No duplicate day within THIS course
      if (courseDateTeacher[dateStr]?.has(tId)) return false;
      // Busy in OTHER courses on this date
      if (globalDateTeacher[dateStr]?.has(tId)) return false;
      return true;
    };

    // Helper: find best teacher for subject on date
    const findBestTeacher = (subId: string, dateStr: string): any | null => {
      const qualified = teachers.filter((t: any) => canTeachSubject(t, subId));
      if (qualified.length === 0) return null;

      const available = qualified.filter((t: any) => isAvailable(String(t.id), dateStr, subId));
      if (available.length === 0) return null;

      // Sort: prefer continuity (same teacher for same subject)
      available.sort((a: any, b: any) => {
        const aStarted = courseTeacherSubject[String(a.id)] === subId;
        const bStarted = courseTeacherSubject[String(b.id)] === subId;
        if (aStarted && !bStarted) return -1;
        if (!aStarted && bStarted) return 1;
        const aAssigned = !!courseTeacherSubject[String(a.id)];
        const bAssigned = !!courseTeacherSubject[String(b.id)];
        if (!aAssigned && bAssigned) return -1;
        if (aAssigned && !bAssigned) return 1;
        return 0;
      });

      return available[0];
    };

    // Mark teacher as used
    const markUsed = (tId: string, dateStr: string, shift: string, subId: string) => {
      courseTeacherSubject[tId] = subId;
      if (!courseDateTeacher[dateStr]) courseDateTeacher[dateStr] = new Set();
      courseDateTeacher[dateStr].add(tId);
      if (!globalDateTeacher[dateStr]) globalDateTeacher[dateStr] = new Set();
      globalDateTeacher[dateStr].add(tId);
      if (!globalShiftTeacher[dateStr]) globalShiftTeacher[dateStr] = {};
      if (!globalShiftTeacher[dateStr][shift]) globalShiftTeacher[dateStr][shift] = new Set();
      globalShiftTeacher[dateStr][shift].add(tId);
    };

    let dayOffset = 0;

    // --- PASS 1: Morning & Afternoon only ---
    const pass1Queue = [...sessionQueue];
    const remainingForEvening: typeof sessionQueue = [];

    while (pass1Queue.length > 0 && dayOffset < MAX_DAYS) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = getYMD(date);

      const priorityShifts: ('Sáng' | 'Chiều')[] = ['Sáng', 'Chiều'];

      for (const shift of priorityShifts) {
        if (pass1Queue.length === 0) break;

        const candidateIndex = pass1Queue.findIndex(session => findBestTeacher(session.subId, dateStr) !== null);

        if (candidateIndex !== -1) {
          const session = pass1Queue[candidateIndex];
          const teacher = findBestTeacher(session.subId, dateStr);

          pass1Queue.splice(candidateIndex, 1);

          if (teacher) {
            markUsed(String(teacher.id), dateStr, shift, session.subId);
          }

          initialRows.push({
            subjectId: session.subId,
            subjectName: session.subName,
            date: dateStr,
            shift: shift,
            teacherId: teacher ? teacher.id : '',
            teacherName: teacher ? (teacher.full_name || teacher.name) : '',
            notes: ''
          });
        }
      }
      dayOffset++;
    }

    remainingForEvening.push(...pass1Queue);

    // --- PASS 2: Evening fallback ---
    if (remainingForEvening.length > 0) {
      console.log("Evening fallback for", remainingForEvening.length, "sessions");
      dayOffset = 0;
      while (remainingForEvening.length > 0 && dayOffset < MAX_DAYS) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = getYMD(date);
        const shift = 'Tối';

        const candidateIndex = remainingForEvening.findIndex(session => findBestTeacher(session.subId, dateStr) !== null);

        if (candidateIndex !== -1) {
          const session = remainingForEvening[candidateIndex];
          const teacher = findBestTeacher(session.subId, dateStr);

          remainingForEvening.splice(candidateIndex, 1);

          if (teacher) {
            markUsed(String(teacher.id), dateStr, shift, session.subId);
          }

          initialRows.push({
            subjectId: session.subId,
            subjectName: session.subName,
            date: dateStr,
            shift: 'Tối',
            teacherId: teacher ? teacher.id : '',
            teacherName: teacher ? (teacher.full_name || teacher.name) : '',
            notes: 'Ca tối (không còn GV rảnh sáng/chiều)'
          });
        } else {
          dayOffset++;
        }
      }
    }

    // Sort by date then shift
    initialRows.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      const shiftOrder: Record<string, number> = { 'Sáng': 0, 'Chiều': 1, 'Tối': 2 };
      return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
    });

    // Update globalOccupancy state for dropdown filtering
    const newOccupancy: Record<string, Record<string, Record<string, boolean>>> = {};
    for (const d of Object.keys(globalShiftTeacher)) {
      if (!newOccupancy[d]) newOccupancy[d] = {};
      for (const s of Object.keys(globalShiftTeacher[d])) {
        if (!newOccupancy[d][s]) newOccupancy[d][s] = {};
        globalShiftTeacher[d][s].forEach(tId => {
          newOccupancy[d][s][tId] = true;
        });
      }
    }
    setGlobalOccupancy(newOccupancy);

    setAssignmentRows(initialRows);
  };

  const handleResetSchedule = async () => {
    if (confirm("Bạn có chắc chắn muốn tải lại Chương trình đào tạo và đặt lại lịch học? Dữ liệu hiện tại sẽ bị mất.")) {
      await loadAssignmentForClass(selectedDecision, true);
    }
  };

  const handleAutoArrange = async () => {
    await loadAssignmentForClass(selectedDecision, true, autoStartDate);
  };

  const handleSave = async () => {
    if (!selectedClassId) return;

    // Prepare load
    // We store the array of rows in 'schedule' JSON field and link 'decision'
    const payload = {
      schedule: assignmentRows,
      decision: selectedClassId // Link to Decision ID
    };

    try {
      if (existingAssignmentId) {
        // Update
        await updateCategory(COLLECTIONS.TRAINING_ASSIGNMENTS, existingAssignmentId, payload);
      } else {
        // Create
        const newAssignment = await createCategory(COLLECTIONS.TRAINING_ASSIGNMENTS, payload);
        if (newAssignment && (newAssignment.id || newAssignment.documentId)) {
          setExistingAssignmentId(newAssignment.documentId || newAssignment.id);
        }
      }
      alert("Đã lưu bảng phân công thành công vào hệ thống!");
      setIsFormOpen(false);
    } catch (e) {
      console.error("Failed to save assignment", e);
      alert("Lỗi khi lưu bảng phân công. Vui lòng thử lại.");
    }
  };

  const handleExportAllAssignments = async () => {
    try {
      // 1. Fetch all training assignments for status verification
      const allAssignments = await fetchCategory(COLLECTIONS.TRAINING_ASSIGNMENTS);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bảng Tổng Hợp Huấn Luyện');

      // Setup Columns
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Số Quyết định', key: 'number', width: 20 },
        { header: 'Lớp Đào Tạo', key: 'className', width: 35 },
        { header: 'Khóa/Đợt', key: 'trainingCourse', width: 20 },
        { header: 'Ngày Ký QĐ', key: 'signedDate', width: 15 },
        { header: 'Số HV', key: 'studentCount', width: 10 },
        { header: 'Số Môn', key: 'subjectCount', width: 10 },
        { header: 'Trạng Thái Lập Lịch', key: 'status', width: 25 },
      ];

      // Styling Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF333333' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Populate Data
      classDecisions.forEach((d, index) => {
        const matchingAssignment = allAssignments.find((a: any) => {
          const decRel = a.decision?.data || a.decision;
          const decId = String(decRel?.documentId || decRel?.id);
          const dId = String(d.documentId || d.id);
          return decId === dId;
        });

        const statusText = (matchingAssignment && matchingAssignment.schedule?.length > 0)
          ? `Đã lập lịch (${matchingAssignment.schedule.length} buổi)`
          : 'Chưa lập lịch';

        const rowContent = {
          stt: index + 1,
          number: d.decisionNumber,
          className: d.className,
          trainingCourse: d.trainingCourse || '---',
          signedDate: d.signedDate ? new Date(d.signedDate).toLocaleDateString('vi-VN') : '--',
          studentCount: d.studentCount || 0,
          subjectCount: d.subjects?.length || 0,
          status: statusText
        };

        const row = worksheet.addRow(rowContent);

        // Cell Borders & Alignment
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if ([1, 2, 4, 5, 6, 7].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });

      // Write to Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TongHop_HuanLuyen_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Export all failed", e);
      alert("Lỗi khi xuất dữ liệu tổng hợp.");
    }
  };

  const updateRow = (index: number, field: keyof DetailedAssignmentRow, value: string) => {
    const newRows = [...assignmentRows];
    newRows[index] = { ...newRows[index], [field]: value };

    if (field === 'teacherId') {
      const t = teachers.find(tea => String(tea.id) === value);
      if (t) newRows[index].teacherName = t.full_name || t.name;
    }

    setAssignmentRows(newRows);
  };

  /* Helper */
  const formatDateVN = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Phân công huấn luyện');

      // Define Columns
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Chương trình đào tạo', key: 'subjectName', width: 40 },
        { header: 'Ngày học', key: 'date', width: 15 },
        { header: 'Buổi', key: 'shift', width: 10 },
        { header: 'Giáo viên', key: 'teacherName', width: 25 },
        { header: 'Ghi chú', key: 'notes', width: 20 },
      ];

      // Styling Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Process Data
      assignmentRows.forEach((row, i) => {
        const rowIndex = i + 2;
        const excelRow = worksheet.getRow(rowIndex);

        worksheet.getCell(`A${rowIndex}`).value = i + 1;
        worksheet.getCell(`B${rowIndex}`).value = row.subjectName;
        // Format date as dd/MM/yyyy explicitly
        worksheet.getCell(`C${rowIndex}`).value = formatDateVN(row.date);
        worksheet.getCell(`D${rowIndex}`).value = row.shift;
        worksheet.getCell(`E${rowIndex}`).value = row.teacherName;
        worksheet.getCell(`F${rowIndex}`).value = row.notes;

        // Borders
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
          const cell = worksheet.getCell(`${col}${rowIndex}`);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (col === 'A' || col === 'C' || col === 'D') {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }
        });
      });

      // Generate Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const dateString = `${day}${month}${year}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PhanCong_${currentClassName}_${dateString}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Export failed:', e);
      alert('Có lỗi khi xuất Excel. Vui lòng thử lại.');
    }
  };

  const removeRow = (index: number) => {
    setAssignmentRows(assignmentRows.filter((_, i) => i !== index));
  };

  const handlePrintAttendance = async () => {
    if (!selectedDecision) return;

    // 1. Fetch latest accurate student list (Deep Populate)
    let students: any[] = [];
    try {
      const decisionId = selectedDecision.id || selectedDecision.documentId;
      // Fetch specific decision with deep populate for students
      const fullDecisionRaw = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decisionId}&populate[students][populate]=*`);

      let rawStudents: any[] = [];
      if (fullDecisionRaw && fullDecisionRaw.length > 0) {
        const fd = fullDecisionRaw[0];
        // Handle different Strapi response structures
        if (fd.students) {
          if (Array.isArray(fd.students)) rawStudents = fd.students;
          else if (fd.students.data) rawStudents = fd.students.data;
        }
      } else {
        // Fallback
        if (Array.isArray(selectedDecision.students)) rawStudents = selectedDecision.students;
        else if (selectedDecision.students?.data) rawStudents = selectedDecision.students.data;
      }

      students = rawStudents.map((s: any) => ({
        fullName: s.full_name || s.fullName || s.attributes?.full_name || s.attributes?.name || '',
        studentCode: s.student_code || s.studentCode || s.attributes?.student_code || s.attributes?.code || '',
        dob: s.dob || s.date_of_birth || s.attributes?.dob || s.attributes?.date_of_birth || ''
      }));

    } catch (e) {
      console.error("Fetch students failed", e);
      alert("Không thể tải danh sách học viên. Vui lòng kiểm tra lại kết nối.");
      return;
    }

    if (students.length === 0) {
      alert("Lớp chưa có học viên nào để điểm danh.");
      return;
    }

    // Sort students by Name
    students.sort((a: any, b: any) => {
      const nameA = a.fullName.split(' ').pop() || '';
      const nameB = b.fullName.split(' ').pop() || '';
      return nameA.localeCompare(nameB);
    });

    // 2. Group Rows by Subject
    // We want to print one set of tables PER SUBJECT
    const subjectsMap: Record<string, typeof assignmentRows> = {};

    assignmentRows.forEach(row => {
      if (!subjectsMap[row.subjectName]) {
        subjectsMap[row.subjectName] = [];
      }
      subjectsMap[row.subjectName].push(row);
    });

    // 3. Generate HTML Pages
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let allPagesHtml = '';

    Object.keys(subjectsMap).forEach((subjectName, subjIdx) => {
      const subjectRows = subjectsMap[subjectName];

      // Get Unique Sessions for this Object
      const sessions = subjectRows
        .map(r => ({ date: r.date, shift: r.shift }))
        .filter((v, i, a) => a.findIndex(t => t.date === v.date && t.shift === v.shift) === i)
        .sort((a, b) => {
          if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
          const shiftOrder = { 'Sáng': 0, 'Chiều': 1, 'Tối': 2 };
          return (shiftOrder[a.shift] || 0) - (shiftOrder[b.shift] || 0);
        });

      if (sessions.length === 0) return;

      // Chunk sessions (7 per page)
      const CHUNK_SIZE = 7;
      const sessionChunks = [];
      for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
        sessionChunks.push(sessions.slice(i, i + CHUNK_SIZE));
      }

      // Generate pages for this subject
      const subjectPages = sessionChunks.map((chunk, chunkIdx) => `
            <div class="page-container" style="${(subjIdx > 0 || chunkIdx > 0) ? 'page-break-before: always;' : ''}">
                <div class="header">
                    <h1>DANH SÁCH ĐIỂM DANH</h1>
                    <h2>Lớp: ${currentClassName}</h2>
                    <h3>Môn học: <span style="text-transform: uppercase;">${subjectName}</span></h3>
                    <p style="text-align: center; margin: 0; font-size: 12px; font-style: italic;">(Trang ${chunkIdx + 1}/${sessionChunks.length})</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th rowspan="2" style="width: 40px;">STT</th>
                            <th rowspan="2" class="name-col">Họ và Tên</th>
                            <th rowspan="2" style="width: 80px;">Ngày sinh</th>
                            <th rowspan="2" style="width: 80px;">Mã HV</th>
                            <th colspan="${CHUNK_SIZE}">Các buổi học</th>
                            <th rowspan="2">Ghi chú</th>
                        </tr>
                        <tr>
                            ${chunk.map(s => `
                                <th>
                                    <div>${formatDateVN(s.date).split('/').slice(0, 2).join('/')}</div>
                                    <div style="font-size: 10px;">${s.shift}</div>
                                </th>
                            `).join('')}
                            ${chunk.length < CHUNK_SIZE ? Array(CHUNK_SIZE - chunk.length).fill('<th></th>').join('') : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map((s: any, idx: number) => `
                            <tr>
                                <td class="center">${idx + 1}</td>
                                <td class="text-left" style="text-transform: uppercase;"><b>${s.fullName}</b></td>
                                <td class="center">${formatDateVN(s.dob)}</td>
                                <td class="center">${s.studentCode}</td>
                                ${chunk.map(() => `<td></td>`).join('')}
                                ${chunk.length < CHUNK_SIZE ? Array(CHUNK_SIZE - chunk.length).fill('<td></td>').join('') : ''}
                                <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer-sign">
                    <div style="text-align: center; width: 40%;">
                        <p><b>Giáo viên</b></p>
                        <p><i>(Ký và ghi rõ họ tên)</i></p>
                    </div>
                    <div style="text-align: center; width: 40%;">
                        <p><b>Người lập biểu</b></p>
                        <p><i>(Ký và ghi rõ họ tên)</i></p>
                    </div>
                </div>
            </div>
        `).join('');

      allPagesHtml += subjectPages;
    });

    const html = `
        <html>
        <head>
            <title>Điểm danh - ${currentClassName}</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 13px; margin: 0; }
                .page-container { width: 100%; height: 100%; position: relative; padding-bottom: 50px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
                th, td { border: 1px solid black; padding: 4px; text-align: center; vertical-align: middle; word-wrap: break-word; }
                th { background: #f0f0f0; font-weight: bold; height: 40px; }
                .text-left { text-align: left !important; padding-left: 8px; }
                .center { text-align: center; }
                .name-col { width: 180px; }
                
                h1, h2, h3 { text-align: center; margin: 5px 0; }
                h1 { font-size: 18px; text-transform: uppercase; }
                h2 { font-size: 16px; font-weight: normal; }
                h3 { font-size: 14px; font-weight: bold; margin-bottom: 10px; }

                .footer-sign { display: flex; justify-content: space-between; margin-top: 30px; }

                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            ${allPagesHtml}
            <script>window.print();</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const renderAssignmentForm = () => {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col h-screen w-screen overflow-hidden print:static print:h-auto print:w-auto print:overflow-visible print:block">
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 10mm; }
              html, body, #root { height: auto !important; overflow: visible !important; }
              body { padding: 0; margin: 0; }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              input, select { border: none !important; appearance: none; -webkit-appearance: none; padding: 0 !important; background: transparent !important; }
              /* Hide Notes Column in Print */
              .col-notes { display: none !important; }
              /* Ensure Subject Name shows fully */
              /* Ensure Subject Name shows fully */
              .col-subject input { white-space: normal; overflow: visible; }
              /* Make borders darker for print */
              table, th, td { border: 1px solid #000 !important; border-collapse: collapse !important; }
            }
          `}
        </style>

        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center shrink-0 no-print">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar size={24} /> Phân công Huấn luyện
            </h2>
            <div className="text-blue-100 text-sm mt-1 flex gap-4">
              <span className="font-bold uppercase">{currentClassName}</span>
              <span className="opacity-80">|</span>
              <span>QĐ: {currentDecisionNumber}</span>
            </div>
          </div>
          <button onClick={() => setIsFormOpen(false)} className="hover:bg-blue-700 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center shrink-0 no-print">
          <div className="text-sm text-slate-500 italic">
            Điều chỉnh thời gian và giáo viên giảng dạy cho từng môn học.
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Ngày bắt đầu:</span>
              <input
                type="date"
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-blue-600 outline-none p-0 w-32"
                value={autoStartDate}
                onChange={(e) => setAutoStartDate(e.target.value)}
              />
            </div>
            <button onClick={handleAutoArrange} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-md flex items-center gap-2">
              <RefreshCw size={16} /> Tự động sắp xếp
            </button>
            <div className="h-8 w-px bg-slate-300 mx-2"></div>
            <button onClick={handleResetSchedule} className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">
              <RefreshCw size={16} /> Tải lại CTĐT
            </button>
            <div className="h-8 w-px bg-slate-300 mx-2"></div>
            <button onClick={handleExportExcel} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">
              <FileSpreadsheet size={16} /> Xuất Excel
            </button>
            <button onClick={handlePrintAttendance} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">
              <ClipboardList size={16} /> In Điểm danh
            </button>
            <button onClick={() => window.print()} className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
              <Printer size={16} /> In
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
              <Save size={16} /> Lưu bảng
            </button>
          </div>
        </div>

        {/* Print Header (Only visible when printing) */}
        <div className="hidden print-only mb-4" style={{ marginTop: '-10mm' }}>
          <div className="text-center">
            <h1 className="text-2xl font-bold uppercase mb-2">Lịch Phân Công Huấn Luyện</h1>
            <div className="text-lg font-bold mb-1">{currentClassName}</div>
            <div className="text-sm">Quyết định số: {currentDecisionNumber}</div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100 print:bg-white print:p-0 print:overflow-visible print:h-auto">
          <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden print:shadow-none print:border-none">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm print:shadow-none print:bg-white print:text-black">
                <tr className="print:border-b-2 print:border-black">
                  <th className="px-4 py-3 w-12 text-center bg-slate-50 print:bg-white border text-center">#</th>
                  <th className="px-4 py-3 bg-slate-50 print:bg-white border w-auto">Chương trình đào tạo</th>
                  <th className="px-4 py-3 w-32 bg-slate-50 print:bg-white border text-center">Ngày học</th>
                  <th className="px-4 py-3 w-24 bg-slate-50 print:bg-white border text-center">Buổi</th>
                  <th className="px-4 py-3 w-48 bg-slate-50 print:bg-white border">Giáo viên</th>
                  <th className="px-4 py-3 bg-slate-50 print:bg-white border col-notes no-print">Ghi chú</th>
                  <th className="px-4 py-3 w-10 bg-slate-50 print:bg-white border no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-black">
                {assignmentRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group print:hover:bg-transparent">
                    <td className="px-4 py-3 text-center text-slate-400 print:text-black border">{idx + 1}</td>
                    <td className="px-4 py-3 border col-subject">
                      <input
                        type="text"
                        className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-700 p-0 print:hidden"
                        value={row.subjectName}
                        onChange={(e) => updateRow(idx, 'subjectName', e.target.value)}
                        placeholder="Nhập tên môn..."
                      />
                      <div className="hidden print:block whitespace-pre-wrap">{row.subjectName}</div>
                    </td>
                    <td className="px-4 py-3 border text-center">
                      <input
                        type="date"
                        className="w-full border border-slate-200 rounded px-2 py-1 text-slate-600 focus:border-blue-500 focus:outline-none text-center print:text-black"
                        value={row.date}
                        onChange={(e) => updateRow(idx, 'date', e.target.value)}
                      />
                      <span className="hidden print:inline">{formatDateVN(row.date)}</span>
                      <style>{`@media print { input[type="date"] { display: none; } }`}</style>
                    </td>
                    <td className="px-4 py-3 border text-center">
                      <select
                        className="w-full border border-slate-200 rounded px-2 py-1 text-slate-600 focus:border-blue-500 focus:outline-none print:hidden"
                        value={row.shift}
                        onChange={(e) => updateRow(idx, 'shift', e.target.value as any)}
                      >
                        <option value="Sáng">Sáng</option>
                        <option value="Chiều">Chiều</option>
                        <option value="Tối">Tối</option>
                      </select>
                      <span className="hidden print:inline">{row.shift}</span>
                    </td>
                    <td className="px-4 py-3 border">
                      <select
                        className="w-full border border-slate-200 rounded px-2 py-1 text-slate-600 focus:border-blue-500 focus:outline-none print:hidden"
                        value={row.teacherId}
                        onChange={(e) => updateRow(idx, 'teacherId', e.target.value)}
                      >
                        <option value="">-- Chọn GV --</option>
                        {teachers.map(t => {
                          const tId = String(t.id);
                          const isCurrentlySelected = String(row.teacherId) === tId;

                          // Rule: Only show teachers qualified for this subject
                          const tSubjects = t.subjects || t.data?.attributes?.subjects?.data || [];
                          const isQualified = tSubjects.some((ts: any) => String(ts.documentId || ts.id) === String(row.subjectId));

                          // Rule: Busy in OTHER courses on this date (ANY shift)
                          const isBusyGlobalDay = globalOccupancy[row.date] && Object.values(globalOccupancy[row.date]).some((shiftTeachers: any) => shiftTeachers[tId]);

                          // Rule: Already assigned to a DIFFERENT subject in THIS course on the same date
                          const assignedOtherSubjectSameDay = assignmentRows.some((r, i) =>
                            i !== idx &&
                            r.date === row.date &&
                            String(r.teacherId) === tId &&
                            String(r.subjectId) !== String(row.subjectId)
                          );

                          // Rule: Already assigned to a different subject in THIS course (1 GV = 1 Môn)
                          const assignedDiffSubject = assignmentRows.some(r =>
                            String(r.teacherId) === tId && r.teacherId !== '' && String(r.subjectId) !== String(row.subjectId)
                          );

                          // Filter: If fails any rule and not currently selected, hide
                          if ((!isQualified || isBusyGlobalDay || assignedOtherSubjectSameDay || assignedDiffSubject) && !isCurrentlySelected) return null;

                          return (
                            <option key={t.id} value={t.id}>
                              {t.full_name || t.name}
                            </option>
                          );
                        })}
                      </select>
                      <span className="hidden print:inline">{row.teacherName}</span>
                    </td>
                    <td className="px-4 py-3 border col-notes no-print">
                      <input
                        type="text"
                        className="w-full bg-transparent border-none focus:ring-0 text-slate-500 p-0"
                        value={row.notes}
                        onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                        placeholder="..."
                      />
                    </td>
                    <td className="px-4 py-3 text-center border no-print">
                      <button
                        onClick={() => removeRow(idx)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <UserCheck size={16} className="rotate-45" />
                      </button>
                    </td>
                  </tr>
                ))}
                {assignmentRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic border">
                      Chưa có lịch học nào. Nhấn "+ Thêm buổi" để bắt đầu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50">
      <div className="mb-8 print:hidden flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Phân công Huấn luyện</h1>
          <p className="text-slate-500">Danh sách các lớp đang hoạt động theo Quyết định.</p>
        </div>
        <button
          onClick={handleExportAllAssignments}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
        >
          <FileSpreadsheet size={20} /> Xuất Excel tổng hợp
        </button>
      </div>

      {isFormOpen && renderAssignmentForm()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classDecisions.length === 0 ? (
          <div className="col-span-3 text-center p-12 bg-white rounded-xl border border-dashed border-slate-300">
            <div className="text-slate-400 mb-2"><BookOpen size={48} className="mx-auto" /></div>
            <p className="text-slate-500 font-medium">Chưa có lớp nào được mở theo Quyết định.</p>
            <p className="text-slate-400 text-sm">Vui lòng sang mục "Quyết định mở lớp" để tạo mới.</p>
          </div>
        ) : (
          classDecisions.map(d => (
            <div
              key={d.id}
              onClick={() => openAssignmentForm(d)}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Calendar size={24} />
                </div>
                <div className="flex flex-col items-end">
                  <div className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-500 mb-1">
                    QĐ: {d.decisionNumber}
                  </div>
                  {d.signedDate && (
                    <div className="text-[10px] text-slate-400 mb-1">
                      Ngày ký: {formatDateVN(d.signedDate)}
                    </div>
                  )}
                  {d.trainingCourse && (
                    <div className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold uppercase">
                      Khóa: {d.trainingCourse}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">
                {d.className}
              </h3>

              <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BookOpen size={16} className="text-slate-400" />
                  <span>{d.subjects?.length || 0} môn học trong CTĐT</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users size={16} className="text-slate-400" />
                  <span>{d.studentCount} học viên</span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <span className="text-sm font-bold text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Lập lịch <ChevronRight size={16} />
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AssignmentsView;
