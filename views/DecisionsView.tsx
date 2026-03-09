import React, { useState, useEffect } from 'react';
import { Plus, X, List, Search, Trash2, Edit, UserPlus, Save, FileText, Calendar, Users, FileDown, GraduationCap, School, Paperclip, Upload, Printer, IdCard, FileSpreadsheet, History, Clock, ShieldCheck, ScrollText } from 'lucide-react';
import { Student } from '../types';
import { fetchCategory, createCategory, updateCategory, deleteCategory, COLLECTIONS, createLog } from '../services/api';
import ExcelJS from 'exceljs';

interface DecisionDetail {
  id: string;
  strapiId?: number;
  stt: number;
  fullName: string;
  gender: string;
  dob: string;
  cardNumber: string;
  studentCode: string;
  years: string;
  hometown: string;
  notes: string;
  documents?: { id: string; name: string; url: string; date: string; type: string }[];
  photo?: string;
}

interface DecisionRecord {
  id: string;
  strapiId?: number;
  stt: number;
  number: string;
  type: 'OPENING' | 'RECOGNITION';
  group: string;
  classCode: string;
  classId?: string;
  className: string;
  trainingCourse: string;
  signedDate: string;
  signer: string;
  location: string;
  company: string;
  classType: string;
  notes: string;
  students: DecisionDetail[];
  relatedOpeningId?: string;
}

const FIXED_LOCATION = "Trường Cao đẳng Hàng hải và Đường thủy I";

import { User, UserRole } from '../types';

interface DecisionsViewProps {
  mode?: 'OPENING' | 'RECOGNITION';
  currentUser?: User;
}

const DecisionsView: React.FC<DecisionsViewProps> = ({ mode, currentUser }) => {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [viewType, setViewType] = useState<'OPENING' | 'RECOGNITION'>(mode || 'OPENING');

  useEffect(() => {
    if (mode) setViewType(mode);
  }, [mode]);
  const [loading, setLoading] = useState(false);
  const [printTemplates, setPrintTemplates] = useState<any[]>([]);

  // Data State
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [examGrades, setExamGrades] = useState<any[]>([]);

  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mainSearchTerm, setMainSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<Set<string>>(new Set());
  const [tempStudents, setTempStudents] = useState<DecisionDetail[]>([]);
  const [viewingDocsStudentId, setViewingDocsStudentId] = useState<string | null>(null);

  // Audit Log State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadAuditLogs = async () => {
    // Fetch logs related to decisions if possible, or all logs
    // Currently, we'll fetch all and filter or just show top 50 recent
    const logs = await fetchCategory(`${COLLECTIONS.AUDIT_LOGS}?sort[0]=createdAt:desc&pagination[limit]=50`);
    if (logs) setAuditLogs(logs);
  };


  const [formData, setFormData] = useState({
    number: '',
    signedDate: new Date().toISOString().split('T')[0],
    signer: 'HIỆU TRƯỞNG',
    location: FIXED_LOCATION,
    company: '',
    classType: 'Lớp tự do',
    classCode: '',
    className: '',
    trainingCourse: '',
    notes: '',
    classId: '',
    relatedOpeningId: '',
    startIndex: '1'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadDecisions(),
        loadClasses(),
        loadStudents(),
        loadExamGrades(),
        loadTemplates()
      ]);
    } catch (e: any) {
      console.error("Load failed", e);
      setError("Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối.");
    } finally {
      setLoading(false);
    }
  };

  const loadDecisions = async () => {
    // We need deep populate to get students' documents within the decision
    // Note: Using explicit relation population (true) instead of * to avoid validation errors with deep nested relations
    const data = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?sort[0]=signed_date:desc&sort[1]=id:desc&populate[students][populate][0]=documents&populate[school_class]=true&populate[related_decision]=true`);
    if (data) {
      const mapped = data.map((d: any, index: number) => {
        const classData = d.school_class?.data || d.school_class;
        const studentsData = d.students?.data || d.students || [];

        return {
          id: String(d.documentId || d.id),
          strapiId: d.strapiId || d.id,
          stt: index + 1,
          number: d.decision_number || '',
          type: d.type || 'OPENING',
          trainingCourse: d.training_course || '',
          signedDate: d.signed_date || '',
          signer: d.signer_name || 'HIỆU TRƯỞNG',
          classId: String(classData?.documentId || classData?.id || ''),
          className: classData?.attributes?.name || classData?.name || '',
          classCode: classData?.attributes?.code || classData?.code || '',
          notes: d.notes || '',
          students: Array.isArray(studentsData) ? studentsData.map((s: any, sIdx: number) => {
            const item = s.attributes || s;
            return {
              id: String(s.documentId || s.id),
              strapiId: s.strapiId || s.id,
              stt: sIdx + 1,
              fullName: item.full_name || item.fullName || '',
              gender: item.gender || 'Nam',
              dob: item.dob || '',
              studentCode: item.student_code || item.studentCode || item.code || '',
              hometown: item.pob || '',
              cardNumber: item.card_number || item.id_number || '',
              years: '',
              notes: '',
              documents: (Array.isArray(item.documents) ? item.documents : item.documents?.data || []).map((doc: any) => ({
                id: doc.documentId || doc.id,
                name: doc.attributes?.name || doc.name,
                url: doc.attributes?.url || doc.url,
                type: doc.attributes?.mime || doc.type || 'application/pdf'
              })),
              photo: item.photo || null
            };
          }) : [],
          group: '',
          location: d.location || FIXED_LOCATION,
          company: d.company || '',
          classType: d.class_type || 'Lớp tự do',
          relatedOpeningId: (typeof d.related_decision === 'object')
            ? (d.related_decision?.documentId || d.related_decision?.id || d.related_decision?.data?.documentId || d.related_decision?.data?.id || '')
            : (String(d.related_decision || '')),
        } as DecisionRecord;
      });
      setDecisions(mapped);
    }
  };

  const loadClasses = async () => {
    // Fetch classes with subjects to valid grading requirements
    const data = await fetchCategory(`${COLLECTIONS.CLASSES}?populate=subjects`);
    if (data) setAvailableClasses(data);
  };

  const loadStudents = async () => {
    const data = await fetchCategory(COLLECTIONS.STUDENTS);
    if (data) {
      setAllStudents(data.map((d: any) => {
        const classData = d.school_class?.data || d.school_class;
        return {
          id: String(d.documentId || d.id),
          strapiId: d.strapiId || d.id,
          stt: d.stt || 0,
          studentCode: d.student_code || d.studentCode || '',
          fullName: d.full_name || d.fullName || '',
          firstName: d.first_name || '',
          lastName: d.last_name || '',
          dob: d.dob || '',
          pob: d.pob || '',
          gender: d.gender || '',
          idNumber: d.id_number || '',
          cardNumber: d.card_number || '',
          group: classData?.attributes?.name || classData?.name || d.group || '',
          className: classData?.attributes?.name || classData?.name || d.class_name || '',
          classCode: classData?.attributes?.code || classData?.code || d.class_code || '',
          classId: String(classData?.documentId || classData?.id || ''),
          isApproved: !!d.is_approved,
          documents: (Array.isArray(d.documents) ? d.documents : d.documents?.data || []).map((doc: any) => ({
            id: doc.documentId || doc.id,
            name: doc.attributes?.name || doc.name,
            url: doc.attributes?.url || doc.url,
            type: doc.attributes?.mime || doc.type || 'application/pdf'
          })),
          photo: d.photo || null
        } as Student;
      }));
    }
  };

  const loadTemplates = async () => {
    const data = await fetchCategory(COLLECTIONS.PRINT_TEMPLATES);
    if (data) setPrintTemplates(data);
  };

  const loadExamGrades = async () => {
    const data = await fetchCategory(COLLECTIONS.EXAM_GRADES);
    if (data) setExamGrades(data);
  };

  const filteredDecisions = decisions
    .filter(d =>
      d.type === viewType && (
        (d.number || '').toLowerCase().includes(mainSearchTerm.toLowerCase()) ||
        (d.className || '').toLowerCase().includes(mainSearchTerm.toLowerCase()) ||
        (d.trainingCourse || '').toLowerCase().includes(mainSearchTerm.toLowerCase())
      )
    )
    .map((d) => {
      // Enrichment logic for Recognition mode
      if (d.type === 'RECOGNITION' && d.relatedOpeningId) {
        const relatedOpening = decisions.find(o => String(o.id) === d.relatedOpeningId);
        if (relatedOpening) {
          const gradeRecord = examGrades.find(eg => {
            const did = eg.decision?.documentId || eg.decision?.id;
            return String(did) === String(relatedOpening.id);
          });

          if (gradeRecord && gradeRecord.grades) {
            const passingStudents: DecisionDetail[] = [];
            const subjectGrades = gradeRecord.grades;
            const classObj = availableClasses.find(c => String(c.id) === String(relatedOpening.classId));
            const requiredSubjects = classObj?.subjects || [];

            relatedOpening.students.forEach(s => {
              let hasAllGrades = true;
              if (requiredSubjects.length > 0) {
                if (subjectGrades && typeof subjectGrades === 'object') {
                  for (const subj of requiredSubjects) {
                    const subId = String(subj.strapiId || subj.id);
                    const sGrades = subjectGrades[subId]?.[s.studentCode];
                    if (sGrades === undefined || sGrades === null || sGrades === '') {
                      hasAllGrades = false;
                      break;
                    }
                  }
                } else {
                  hasAllGrades = false;
                }
              }
              if (hasAllGrades) passingStudents.push(s);
            });
            return { ...d, students: passingStudents };
          }
        }
      }
      return d;
    })
    .sort((a, b) => {
      const dateA = new Date(a.signedDate || 0).getTime();
      const dateB = new Date(b.signedDate || 0).getTime();

      // Secondary sort: If dates are identical, use strapiId (numeric) to ensure latest created is on top
      if (dateB === dateA) {
        return (b.strapiId || 0) - (a.strapiId || 0);
      }

      return dateB - dateA;
    })
    .map((d, index) => ({ ...d, stt: index + 1 }));

  const getDecisionsWithGrades = () => {
    const decisionIdsWithGrades = new Set<string>();
    examGrades.forEach(eg => {
      const did = eg.decision?.documentId || eg.decision?.id || eg.decision?.data?.id || eg.decision?.data?.documentId;
      if (did) decisionIdsWithGrades.add(String(did));
    });

    // Get IDs of all Opening decisions that are already linked to a Recognition decision
    const linkedOpeningIds = new Set(
      decisions
        .filter(d => d.type === 'RECOGNITION')
        .map(d => String(d.relatedOpeningId))
        .filter(id => id && id !== 'undefined' && id !== 'null' && id !== '')
    );

    // Filter Opening decisions:
    // 1. Must have exam grades
    // 2. Either not linked to ANY recognition decision,
    //    OR linked to the CURRENT decision we are editing.
    return decisions.filter(d => {
      if (d.type !== 'OPENING') return false;
      if (!decisionIdsWithGrades.has(String(d.id))) return false;

      const isUsedByAnother = linkedOpeningIds.has(String(d.id));

      // If we're creating new, it must not be used at all
      if (!editingId) return !isUsedByAnother;

      // If we're editing, let's see if THIS decision is the one using it
      const currentDecision = decisions.find(rd => rd.id === editingId);
      const usedByThisOne = currentDecision?.relatedOpeningId && String(currentDecision.relatedOpeningId) === String(d.id);

      return !isUsedByAnother || usedByThisOne;
    });
  };

  const assignedStudentIds = React.useMemo(() => {
    const ids = new Set<string>();
    decisions.forEach(d => {
      // Students assigned to any OPENING decision should be excluded from future openings
      if (d.type === 'OPENING' && d.students) {
        d.students.forEach(s => ids.add(s.id));
      }
    });
    return ids;
  }, [decisions]);

  const handleTypeLinkSelect = (selectedId: string) => {
    if (!selectedId) {
      setTempStudents([]);
      return;
    }

    if (viewType === 'OPENING') {
      const selectedClass = availableClasses.find(c => String(c.documentId || c.id) === selectedId);
      if (selectedClass) {
        setFormData({
          ...formData,
          className: selectedClass.name || selectedClass.attributes?.name || '',
          classCode: selectedClass.code || selectedClass.attributes?.code || '',
          classId: String(selectedClass.strapiId || selectedClass.id)
        });

        // Auto-populate students from this class, EXCLUDING already assigned students
        const classStudents = allStudents.filter(s =>
          (s as any).classId === selectedId && !assignedStudentIds.has(s.id)
        );
        const mappedStudents: DecisionDetail[] = classStudents.map((s, idx) => ({
          id: s.id,
          stt: idx + 1,
          fullName: s.fullName,
          dob: s.dob || '',
          cardNumber: s.cardNumber || s.idNumber || '',
          studentCode: s.studentCode,
          years: '',
          hometown: s.pob || '',
          notes: '',
          gender: s.gender || '',
          documents: s.documents || [],
          photo: s.photo,
        }));
        setTempStudents(mappedStudents);
      }
    } else {
      const openingDecision = decisions.find(d => String(d.id) === selectedId);
      if (openingDecision) {
        setFormData({
          ...formData,
          className: openingDecision.className,
          classCode: openingDecision.classCode,
          trainingCourse: openingDecision.trainingCourse,
          classId: openingDecision.classId || '',
          relatedOpeningId: String(openingDecision.id)
        });

        const gradeRecord = examGrades.find(eg => {
          const did = eg.decision?.documentId || eg.decision?.id;
          return String(did) === String(openingDecision.id);
        });

        if (gradeRecord && gradeRecord.grades) {
          const passingStudents: DecisionDetail[] = [];
          const subjectGrades = gradeRecord.grades;

          // Find the class to get the list of required subjects
          const classObj = availableClasses.find(c => String(c.id) === String(openingDecision.classId));
          const requiredSubjects = classObj?.subjects || []; // Array of subjects

          openingDecision.students.forEach(s => {
            // Check if student has grades for ALL required subjects
            let hasAllGrades = true;

            if (requiredSubjects.length === 0) {
              // If no subjects defined for class, fallback to "at least one grade" or permit all?
              // Let's permit all if no subjects are defined to avoid blocking in weird edge cases,
              // or strictly require 0 grades? 
              // Better to check if they have ANY grade if we can't determine subjects, 
              // BUT the requirement is "If 1 of the subjects... has no grade".
              // So if subjects exist, we must check all.
              // If no subjects exist, technically they satisfy "all 0 subjects".
              hasAllGrades = true;
            } else {
              if (subjectGrades && typeof subjectGrades === 'object') {
                for (const subj of requiredSubjects) {
                  const subId = String(subj.strapiId || subj.id);
                  const sGrades = subjectGrades[subId]?.[s.studentCode];
                  // Check if grade exists and is not empty/null
                  if (sGrades === undefined || sGrades === null || sGrades === '') {
                    hasAllGrades = false;
                    break;
                  }
                }
              } else {
                hasAllGrades = false;
              }
            }

            if (hasAllGrades) passingStudents.push(s);
          });
          setTempStudents(passingStudents);
        } else {
          setTempStudents([]);
        }
      }
    }
  };

  const checkIfLocked = (id: string | null) => {
    if (!id || viewType !== 'OPENING') return false;
    // Check if any RECOGNITION decision references this OPENING decision
    return decisions.some(d => d.type === 'RECOGNITION' && String(d.relatedOpeningId) === String(id));
  };

  const handleSaveDecision = async () => {
    if (editingId && checkIfLocked(editingId)) {
      alert("KHÔNG THỂ LƯU: Quyết định mở lớp này đã có Quyết định công nhận tương ứng. Vui lòng xóa Quyết định công nhận trước nếu cần thay đổi.");
      return;
    }
    if (!formData.number) {
      alert("Vui lòng nhập Số quyết định!");
      return;
    }

    // Validation: Check for duplicate training course codes within the same type
    if (formData.trainingCourse) {
      const isDuplicate = decisions.some(d =>
        d.type === viewType &&
        d.trainingCourse.trim().toLowerCase() === formData.trainingCourse.trim().toLowerCase() &&
        String(d.id) !== String(editingId)
      );

      if (isDuplicate) {
        alert(`Lỗi: Đợt/Khóa "${formData.trainingCourse}" đã tồn tại trong hệ thống quyết định ${viewType === 'OPENING' ? 'mở lớp' : 'công nhận'}. Vui lòng kiểm tra lại.`);
        return;
      }
    }

    // --- Validation: Check Duplicate Decision Number in the same YEAR ---
    if (formData.number && formData.signedDate) {
      const currentYear = new Date(formData.signedDate).getFullYear();
      const isDuplicateNumberInYear = decisions.some(d => {
        if (!d.number || !d.signedDate) return false;
        if (String(d.id) === String(editingId)) return false;

        const decYear = new Date(d.signedDate).getFullYear();
        return d.number.trim() === formData.number.trim() && decYear === currentYear;
      });

      if (isDuplicateNumberInYear) {
        alert("THÔNG BÁO: Bạn đã có số QĐ này trong năm nay rồi. Vui lòng kiểm tra lại.");
        return;
      }
    }
    // -------------------------------------------------------------------

    try {
      // Strapi v5 requires numeric IDs for relations, not documentId strings
      // Map classId (documentId) -> numeric strapiId
      let classNumericId: number | null = null;
      if (formData.classId) {
        const classObj = availableClasses.find(c =>
          String(c.id) === String(formData.classId) ||
          String(c.documentId) === String(formData.classId) ||
          String(c.strapiId) === String(formData.classId)
        );
        classNumericId = classObj ? Number(classObj.strapiId || classObj.id) : null;
      }

      // Map student documentIds -> numeric strapiIds
      const studentNumericIds = tempStudents.map((s: any) => {
        const stu = allStudents.find((st: any) =>
          String(st.id) === String(s.id) ||
          String(st.documentId) === String(s.id) ||
          String((st as any).strapiId) === String(s.id)
        );
        return stu ? Number((stu as any).strapiId || stu.id) : null;
      }).filter(Boolean);
      console.log('DEBUG: tempStudents', tempStudents);
      console.log('DEBUG: mapped studentNumericIds', studentNumericIds);


      const payload: any = {
        decision_number: formData.number,
        type: viewType,
        training_course: formData.trainingCourse,
        signed_date: formData.signedDate,
        signer_name: formData.signer,
        notes: formData.notes,
        school_class: classNumericId,
        students: studentNumericIds
      };

      if (viewType === 'RECOGNITION' && formData.relatedOpeningId) {
        // Map related_decision documentId -> numeric strapiId
        const relDec = decisions.find((d: any) =>
          String(d.id) === String(formData.relatedOpeningId) ||
          String(d.documentId) === String(formData.relatedOpeningId)
        );
        payload.related_decision = relDec ? Number(relDec.strapiId || relDec.id) : formData.relatedOpeningId;
      }

      if (editingId) {
        await updateCategory(COLLECTIONS.CLASS_DECISIONS, editingId, payload);
        await createLog(
          'UPDATE_DECISION',
          currentUser?.name || 'Unknown',
          `Cập nhật Quyết định ${viewType} số ${formData.number}`,
          editingId
        );
      } else {
        const newDec = await createCategory(COLLECTIONS.CLASS_DECISIONS, payload);
        await createLog(
          'CREATE_DECISION',
          currentUser?.name || 'Unknown',
          `Tạo mới Quyết định ${viewType} số ${formData.number}`,
          String(newDec?.id || newDec?.documentId || '')
        );
      }

      await loadDecisions();
      setIsFormOpen(false);
      alert("Đã lưu thành công!");
    } catch (e) {
      console.error("Save failed:", e);
      alert("Lỗi khi lưu dữ liệu. Vui lòng kiểm tra lại.");
    }
  };

  const removeStudentFromTemp = (id: string) => {
    setTempStudents(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, stt: idx + 1 })));
  };

  const handleAddStudentsToTemp = () => {
    const studentsToAdd = allStudents.filter(s => selectedStudentsToAdd.has(s.id));
    const existingIds = new Set(tempStudents.map(ts => ts.id));
    const newDetails = studentsToAdd.filter(s => !existingIds.has(s.id)).map((s, idx) => ({
      id: s.id,
      stt: tempStudents.length + idx + 1,
      fullName: s.fullName,
      dob: s.dob,
      cardNumber: s.cardNumber || s.idNumber,
      studentCode: s.studentCode,
      years: '',
      hometown: s.pob,
      notes: '',
      photo: s.photo,
    } as DecisionDetail));
    setTempStudents([...tempStudents, ...newDetails]);
    setIsAddStudentModalOpen(false);
    setSelectedStudentsToAdd(new Set());
  };

  const toggleStudentSelection = (id: string) => {
    const newSelection = new Set(selectedStudentsToAdd);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedStudentsToAdd(newSelection);
  };

  const handleDeleteDecision = async (id: string, e: React.MouseEvent) => {
    if (checkIfLocked(id)) {
      alert("KHÔNG THỂ XÓA: Quyết định mở lớp này đã có Quyết định công nhận tương ứng. Vui lòng xóa Quyết định công nhận trước nếu cần thay đổi.");
      return;
    }
    e.stopPropagation();
    if (window.confirm("Bạn có chắc chắn muốn xóa?")) {
      try {
        await deleteCategory(COLLECTIONS.CLASS_DECISIONS, id);

        // Find the decision to log its number
        const deletedDec = decisions.find(d => d.id === id);
        await createLog(
          'DELETE_DECISION',
          currentUser?.name || 'Unknown',
          `Xóa Quyết định ${deletedDec?.type || ''} số ${deletedDec?.number || 'Unknown'}`,
          id
        );

        loadDecisions();
      } catch (e) { alert("Xóa thất bại."); }
    }
  };

  // --- Printing Logic ---
  const DECISION_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc Mở lớp {{CLASS_NAME}}',
    subtext: '(Cập nhật Huấn luyện An toàn sinh mạng và trách nhiệm xã hội theo Nghị quyết MSC.560 (108) của IMO)',
    course: 'Khóa: {{TRAINING_COURSE}}',
    authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    preamble: `Căn cứ Quyết định số 1275/QĐ-BGDĐT ngày 12/5/2025 của Bộ trưởng Bộ Giáo dục và Đào tạo về việc sáp nhập Trường Cao đẳng Giao thông vận tải Đường thủy I vào Trường Cao đẳng Hàng hải I và đổi tên thành Trường Cao đẳng Hàng hải và Đường thủy I;\nCăn cứ Quyết định số 1878/QĐ-CĐHHĐTI ngày 31/12/2025 của Hiệu trưởng trường Cao đẳng Hàng hải và Đường thủy I về việc ban hành Quy chế Tổ chức, hoạt động của Trường Cao đẳng Hàng hải và Đường thủy I;\nCăn cứ Thông tư số 20/2023/TT-BGTVT ngày 30/06/2023 của Bộ trưởng Bộ GTVT về tiêu chuẩn chuyên môn, chứng chỉ chuyên môn của thuyền viên và định biên an toàn tối thiểu của tàu biển Việt Nam;\nCăn cứ Thông tư số 57/2023/TT-BGTVT ngày 31/12/2023 của Bộ trưởng Bộ GTVT về Chương trình đào tạo, huấn luyện thuyền viên, hoa tiêu hàng hải;\nCăn cứ Giấy chứng nhận số 03/GCN-CHHĐTVN ngày 12/09/2025 của Cục Hàng hải và Đường thủy Việt Nam về việc chứng nhận Trường Cao đẳng Hàng hải và Đường thủy I đủ điều kiện tổ chức các khóa đào tạo, huấn luyện thuyền viên hàng hải và cấp chứng chỉ huấn luyện;\nTheo đề nghị của Giám đốc Trung tâm Đào tạo Phát triển nguồn lực.`,
    article1: 'Mở lớp {{CLASS_NAME}}; Khóa: {{TRAINING_COURSE}} Theo Nghị quyết MSC.560(108) của IMO (U.BTC-K18/2026, có danh sách kèm theo) tại Trung tâm Đào tạo Phát triển nguồn lực, Trường Cao đẳng Hàng hải và Đường thủy I.',
    article2: 'Giao cho Trung tâm Đào tạo Phát triển nguồn lực chịu trách nhiệm tổ chức lớp huấn luyện; bố trí giảng viên, huấn luyện viên giảng dạy theo nội dung chương trình huấn luyện, đào tạo đã được phê duyệt.',
    article3: 'Giám đốc Trung tâm Đào tạo Phát triển nguồn lực, Trưởng các đơn vị có liên quan trong trường chịu trách nhiệm thi hành quyết định này.',
    signerTitle: 'KT. HIỆU TRƯỞNG\nPHÓ HIỆU TRƯỞNG',
    signerName: ' ĐỖ HỒNG HẢI',
    recipients: '- Báo cáo Hiệu trưởng;\n- Như điều 3;\n- Lưu: VT, TTĐT&PTNL.'
  };

  const RECOGNITION_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'QUYẾT ĐỊNH',
    subtitle: 'Về việc Công nhận tốt nghiệp {{CLASS_NAME}}',
    subtext: '',
    course: '',
    authority: 'HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    preamble: `Căn cứ Quyết định số 1275/QĐ-BGDĐT ngày 12/5/2025...;\nCăn cứ Quy chế đào tạo...;\nTheo đề nghị của Hội đồng xét tốt nghiệp.`,
    article1: 'Công nhận {{STUDENT_COUNT}} học viên lớp {{CLASS_NAME}} đã hoàn thành khóa học...',
    article2: 'Các học viên có tên trong danh sách được cấp chứng chỉ theo quy định...',
    article3: 'Giám đốc Trung tâm Đào tạo Phát triển nguồn lực, Trưởng các đơn vị có liên quan và các học viên có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này.',
    signerTitle: 'KT. HIỆU TRƯỞNG\nPHÓ HIỆU TRƯỞNG',
    signerName: 'ĐỖ HỒNG HẢI',
    recipients: '- Báo cáo Hiệu trưởng;\n- Như điều 3;\n- Lưu: VT, TTĐT&PTNL.'
  };

  const CERTIFICATE_LIST_DEFAULTS = {
    headerLine1: 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM',
    headerLine2: 'TRƯỜNG CAO ĐẲNG',
    headerLine3: 'HÀNG HẢI VÀ ĐƯỜNG THỦY I',
    nation: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    motto: 'Độc lập - Tự do - Hạnh phúc',
    title: 'DANH SÁCH',
    subtitle: 'Đề nghị cấp giấy chứng nhận huấn luyện nghiệp vụ',
    preamble: 'Lớp {{CLASS_NAME}}\nKhóa: {{TRAINING_COURSE}}',
    signerTitle: 'GIÁM ĐỐC TRUNG TÂM DT&PTNL',
    signerName: 'LÊ THẾ SƠN',
    signerTitle2: 'PHỤ TRÁCH LẬP BẢNG',
    signerName2: '...',
  };

  const handlePrintRequestList = () => {
    // 1. Get Template
    let template = CERTIFICATE_LIST_DEFAULTS;
    const serverTemplate = printTemplates.find(t => t.type === 'certificate_list');
    if (serverTemplate && serverTemplate.content) {
      template = { ...template, ...serverTemplate.content };
    }

    // 2. Replace Placeholders
    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': formData.className || '...',
      '{{TRAINING_COURSE}}': formData.trainingCourse || '...',
      '{{DATE}}': formData.signedDate ? `ngày ${new Date(formData.signedDate).getDate()} tháng ${new Date(formData.signedDate).getMonth() + 1} năm ${new Date(formData.signedDate).getFullYear()}` : '...',
    };

    let content: any = { ...template };
    Object.keys(content).forEach((k) => {
      if (typeof content[k] === 'string') {
        let text = content[k] as string;
        Object.keys(replaceMap).forEach(ph => {
          text = text.replace(new RegExp(ph, 'g'), replaceMap[ph]);
        });
        content[k] = text;
      }
    });

    // 3. Get Subjects and Grades
    const classObj = availableClasses.find(c => String(c.id) === String(formData.classId) || String(c.documentId) === String(formData.classId));
    const subjects = classObj?.subjects || [];

    const gradeRecord = examGrades.find(eg => {
      const did = eg.decision?.documentId || eg.decision?.id;
      return String(did) === String(formData.relatedOpeningId);
    });
    const subjectGrades = gradeRecord?.grades || {};

    // 4. Build Table content
    const subjectHeaders = subjects.map((subj: any) => `
      <th style="border:1px solid black;padding:4px;text-align:center;font-size:9pt;">${subj.name}</th>
    `).join('');

    const studentRows = tempStudents.map((s, i) => {
      const subjectCells = subjects.map((subj: any) => {
        const subId = String(subj.strapiId || subj.id);
        const gradeObj = subjectGrades[subId]?.[s.studentCode];
        let displayGrade = '';

        if (gradeObj) {
          if (typeof gradeObj === 'object') {
            displayGrade = (gradeObj.theory !== undefined && gradeObj.theory !== null && gradeObj.theory !== '') ? String(gradeObj.theory) : (gradeObj.practice !== undefined && gradeObj.practice !== null ? String(gradeObj.practice) : '');
          } else {
            displayGrade = String(gradeObj);
          }
        }

        return `<td style="border:1px solid black;padding:4px;text-align:center;">${displayGrade}</td>`;
      }).join('');

      return `
        <tr>
          <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid black;padding:4px;" class="uppercase bold">${s.fullName}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;">${s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : ''}</td>
          <td style="border:1px solid black;padding:4px;text-align:center;">${s.cardNumber || ''}</td>
          <td style="border:1px solid black;padding:4px;">${s.hometown || ''}</td>
          ${subjectCells}
          <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Danh sách đề nghị cấp GCN</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; }
             table.layout-grid { width: 100%; border: none; margin-bottom: 20px; }
             td.layout-cell { vertical-align: top; }
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 4px; }
             @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
             div.Section1 { page: Section1; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <table class="layout-grid">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 45%;">
                  <div class="uppercase">${content.headerLine1}</div>
                  <div class="bold uppercase">${content.headerLine2}</div>
                  <div class="bold uppercase">${content.headerLine3}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 55%;">
                  <div class="uppercase bold">${content.nation}</div>
                  <div class="bold">${content.motto}</div>
                  <div class="italic" style="margin-top:5px;">Hải Phòng, ${replaceMap['{{DATE}}']}</div>
                </td>
              </tr>
            </table>

            <div class="title">
              <div class="uppercase bold" style="font-size: 14pt;">${content.title}</div>
              <div class="uppercase bold" style="font-size: 12pt;">${content.subtitle}</div>
              <div class="bold" style="white-space: pre-line; margin-top: 5px;">${content.preamble}</div>
            </div>

            <table class="data-table">
              <thead>
                <tr style="background-color: #f2f2f2;">
                  <th style="width:30px;">STT</th>
                  <th>HỌ VÀ TÊN</th>
                  <th style="width:80px;">NGÀY SINH</th>
                  <th style="width:100px;">SỐ CCCD</th>
                  <th>NƠI SINH</th>
                  ${subjectHeaders}
                  <th style="width:80px;">GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                ${studentRows}
              </tbody>
            </table>

            <table class="layout-grid" style="margin-top: 30px;">
              <tr>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle2}</div>
                  <div class="uppercase bold">${content.signerName2}</div>
                </td>
                <td class="layout-cell" style="text-align: center; width: 50%;">
                  <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 60px;">${content.signerTitle}</div>
                  <div class="uppercase bold">${content.signerName}</div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DS_DeNghi_${formData.number || 'Draft'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintDecision = () => {
    // 1. Get Template
    let template = DECISION_DEFAULTS;
    let key = 'edumaster_decision_template';
    if (viewType === 'RECOGNITION') {
      template = RECOGNITION_DEFAULTS;
      key = 'edumaster_recognition_template';
    }

    const type = viewType === 'OPENING' ? 'decision' : 'recognition';
    const serverTemplate = printTemplates.find(t => t.type === type);
    if (serverTemplate && serverTemplate.content) {
      template = { ...template, ...serverTemplate.content };
    }

    // 2. Replace Placeholders
    const replaceMap: Record<string, string> = {
      '{{CLASS_NAME}}': formData.className || '...',
      '{{TRAINING_COURSE}}': formData.trainingCourse ? `Khóa: ${formData.trainingCourse}` : '',
      '{{STUDENT_COUNT}}': String(tempStudents.length),
      '{{DECISION_NUMBER}}': formData.number || '...',
      '{{DATE}}': formData.signedDate ? `ngày ${new Date(formData.signedDate).getDate()} tháng ${new Date(formData.signedDate).getMonth() + 1} năm ${new Date(formData.signedDate).getFullYear()}` : '...',
    };

    let content = { ...template };
    Object.keys(content).forEach((k) => {
      const fieldKey = k as keyof typeof template;
      if (typeof content[fieldKey] === 'string') {
        let text = content[fieldKey] as string;
        Object.keys(replaceMap).forEach(ph => {
          text = text.replace(new RegExp(ph, 'g'), replaceMap[ph]);
        });
        (content as any)[fieldKey] = text;
      }
    });

    // 3. Build HTML for Word Export
    const studentRows = tempStudents.map((s, i) => `
      <tr>
        <td style="border:1px solid black;padding:4px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid black;padding:4px;" class="uppercase bold">${s.fullName}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;">${s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : ''}</td>
        <td style="border:1px solid black;padding:4px;text-align:center;">${s.cardNumber || ''}</td>
        <td style="border:1px solid black;padding:4px;">${s.hometown || ''}</td>
        <td style="border:1px solid black;padding:4px;">${s.notes || ''}</td>
      </tr>
    `).join('');

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${viewType === 'OPENING' ? 'Quyết định Mở lớp' : 'Quyết định Công nhận'}</title>
          <style>
             body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.3; }
             .header { display: flex; justify-content: space-between; margin-bottom: 5px; }
             /* Tables for layout in Word since flexbox support is limited */
             table.layout-grid { width: 100%; border: none; }
             td.layout-cell { vertical-align: top; }
             
             .uppercase { text-transform: uppercase; }
             .bold { font-weight: bold; }
             .italic { font-style: italic; }
             .title { text-align: center; margin: 10px 0; }
             .content-block { text-align: justify; margin-bottom: 10px;} 
             .indent { text-indent: 25px; margin-bottom: 2px; }
             .footer { margin-top: 20px; }
             
             table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
             table.data-table td, table.data-table th { border: 1px solid black; padding: 2px 4px; }
             
             @page { size: A4; margin: 2.0cm 2.0cm 2.0cm 2.5cm; }
          </style>
        </head>
        <body>
          <!-- Header Table for Layout -->
          <table class="layout-grid">
            <tr>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase">${content.headerLine1}</div>
                <div class="uppercase bold">${content.headerLine2}</div>
                <div class="uppercase bold">${content.headerLine3}</div>
                <div style="margin-top:5px;">Số: ${formData.number || '...'}/QĐ-...</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 50%;">
                <div class="uppercase bold">${content.nation}</div>
                <div class="bold">${content.motto}</div>
                <div class="italic" style="margin-top:5px;">Hải Phòng, ${replaceMap['{{DATE}}']}</div>
              </td>
            </tr>
          </table>

          <div class="title">
            <div class="uppercase bold" style="font-size: 14pt; margin-bottom: 2px;">${content.title}</div>
            <div class="bold" style="font-size: 13pt; margin-bottom: 2px;">${content.subtitle}</div>
            ${content.subtext ? `<div style="font-size: 11pt; margin-bottom: 2px;">${content.subtext}</div>` : ''}
            ${content.course ? `<div class="bold" style="font-size: 12pt;">${content.course}</div>` : ''}
          </div>

          ${content.authority ? `<div class="uppercase bold" style="text-align:center; margin-bottom:15px; font-size:13pt;">${content.authority}</div>` : ''}

          <div class="content-block">
             ${content.preamble.split('\n').map((l: string) => `<div class="indent" style="font-size:11pt; margin-bottom: 4px;">${l}</div>`).join('')}
             
             <div style="text-align:center; font-weight:bold; font-size:13pt; margin: 15px 0;">QUYẾT ĐỊNH:</div>

             <div class="indent"><span class="bold">Điều 1.</span> ${content.article1?.replace(/\n/g, '<br/>')}</div>
             <div class="indent"><span class="bold">Điều 2.</span> ${content.article2}</div>
             <div class="indent"><span class="bold">Điều 3.</span> ${content.article3}</div>
          </div>

          <!-- Footer Table for Layout -->
           <table class="layout-grid" style="margin-top: 20px;">
            <tr>
              <td class="layout-cell" style="text-align: left; width: 45%; padding-left: 10px; font-size: 10pt;">
                 <div class="bold italic">Nơi nhận:</div>
                 <div class="italic" style="white-space: pre-line;">${content.recipients}</div>
              </td>
              <td class="layout-cell" style="text-align: center; width: 55%;">
                <div class="uppercase bold" style="white-space: pre-line; margin-bottom: 50px;">${content.signerTitle}</div>
                <div class="uppercase bold">${content.signerName}</div>
              </td>
            </tr>
          </table>

          <br clear="all" style="page-break-before:always" />
          
          <div style="text-align: center; margin-bottom: 10px;">
            <div class="uppercase bold" style="font-size: 11pt;">DANH SÁCH HỌC VIÊN</div>
            <div class="bold" style="font-size: 10pt;">${formData.className}</div>
            <div style="font-size: 9pt;">(Kèm theo Quyết định số ${formData.number} ngày ${replaceMap['{{DATE}}']})</div>
          </div>

          <table class="data-table">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="width:50px;">STT</th>
                <th>Họ và tên</th>
                <th style="width:100px;">Ngày sinh</th>
                <th style="width:120px;">Số CCCD</th>
                <th>Quê quán</th>
                <th style="width:100px;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${studentRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Create Blob and Download
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QuyetDinh_${formData.number || 'Draft'}.doc`; // .doc extension for Word
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintStudentCards = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const cardsHtml = tempStudents.map((s) => `
      <div class="card">
        <div class="card-header">
          <div class="school-name">TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I</div>
          <div class="center-name">TRUNG TÂM ĐÀO TẠO VÀ PHÁT TRIỂN NGUỒN LỰC</div>
        </div>
        <div class="card-body">
           <div class="photo-box">
             <img src="${s.photo || 'https://via.placeholder.com/100x120?text=Photo'}" alt="Photo" />
           </div>
           <div class="info-section">
             <div class="card-type">THẺ HỌC VIÊN</div>
             <div class="student-name">${s.fullName}</div>
             <div class="separator"></div>
             
             <div class="info-grid">
                <div class="info-row">
                    <span class="label">Mã HV:</span>
                    <span class="value">${s.studentCode || s.cardNumber || '...'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Lớp:</span>
                    <span class="value class-name">${formData.className || '...'}</span>
                </div>
                <div class="info-row">
                     <span class="label">Ngày sinh:</span>
                     <span class="value">${s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : '...'}</span>
                </div>
             </div>
           </div>
        </div>
      </div>
    `).join('');

    const html = `
      <html>
        <head>
          <title>In Thẻ Học Viên</title>
          <style>
             body { font-family: 'Arial', sans-serif; padding: 0; background: #fff; margin: 0; }
             
             .card-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 15px; 
                padding: 15px;
                max-width: 210mm; 
             }
             
             .card { 
                width: 340px; 
                height: 220px; 
                border: 1px solid #ccc; 
                border-radius: 12px;
                overflow: hidden;
                background: white;
                box-sizing: border-box;
                position: relative; 
                page-break-inside: avoid;
                margin: 0 auto;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
             }
             
             .card-header { 
                background-color: #15469e; 
                color: white; 
                text-align: center; 
                padding: 5px 4px;
                height: 40px;
                display: flex;
                flex-direction: column;
                justify-content: center;
             }
             
             .school-name { font-size: 9pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
             .center-name { font-size: 7.5pt; font-weight: normal; text-transform: uppercase; }
             
             .card-body { padding: 25px 12px 10px 12px; display: flex; gap: 12px; height: calc(100% - 40px); align-items: flex-start; }
             
             .photo-box { 
                width: 90px; 
                height: 110px; 
                border: 1px solid #e0e0e0; 
                background: #f8f9fa;
                flex-shrink: 0;
                margin-top: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
             }
             .photo-box img { width: 100%; height: 100%; object-fit: cover; }
             
             .info-section { flex: 1; display: flex; flex-direction: column; }
             
             .card-type { 
                color: #d32f2f; 
                font-weight: bold; 
                font-size: 13pt; 
                text-transform: uppercase; 
                margin-bottom: 2px;
             }
             
             .student-name { 
                color: #15469e; 
                font-weight: bold; 
                font-size: 12pt; 
                text-transform: uppercase; 
                line-height: 1.2;
                margin-bottom: 5px;
             }
             
             .separator { height: 1px; background-color: #a0c4ff; width: 100%; margin-bottom: 8px; }
             
             .info-grid { display: flex; flex-direction: column; gap: 4px; }
             
             .info-row { display: flex; font-size: 9pt; line-height: 1.3; }
             .label { color: #666; width: 65px; flex-shrink: 0; font-weight: normal; }
             .value { color: #000; font-weight: bold; flex: 1; }
             .class-name { 
                 display: -webkit-box;
                 -webkit-line-clamp: 3;
                 -webkit-box-orient: vertical;
                 overflow: hidden;
                 font-size: 9pt;
             }

             @media print {
               @page { size: A4 portrait; margin: 1cm; }
               body { margin: 0; -webkit-print-color-adjust: exact; }
               .card { border: 1px solid #ccc; box-shadow: none; break-inside: avoid; }
               .card-header { -webkit-print-color-adjust: exact; background-color: #15469e !important; color: white !important; }
               .student-name { color: #15469e !important; }
               .card-type { color: #d32f2f !important; }
             }
          </style>
        </head>
        <body>
          <div class="card-grid">
            ${cardsHtml}
          </div>
          <script>
             window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách học viên');

      // Define Columns
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Ảnh', key: 'photo', width: 12 }, // Image column
        { header: 'Họ và tên', key: 'fullName', width: 25 },
        { header: 'Ngày sinh', key: 'dob', width: 15 },
        { header: 'CCCD', key: 'cardNumber', width: 18 },
        { header: 'Lớp đào tạo', key: 'className', width: 30 },
      ];

      // Styling Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Process Data
      for (let i = 0; i < tempStudents.length; i++) {
        const s = tempStudents[i];
        const rowIndex = i + 2; // Data starts at row 2
        const row = worksheet.getRow(rowIndex);

        // Set row height to accommodate image (approx 80px -> 60 points)
        row.height = 60;
        row.alignment = { vertical: 'middle', horizontal: 'center' };

        // 1. STT
        worksheet.getCell(`A${rowIndex}`).value = i + 1;

        // 2. Photo (Handling)
        if (s.photo) {
          try {
            // Check if s.photo is base64 or url
            let imageBuffer: ArrayBuffer | null = null;
            let extension: 'png' | 'jpeg' = 'jpeg';

            if (s.photo.startsWith('data:image')) {
              // Extract base64
              const base64Data = s.photo.split(',')[1];
              const binaryString = window.atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let j = 0; j < len; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              imageBuffer = bytes.buffer;
              if (s.photo.includes('png')) extension = 'png';
            } else {
              // Fetch URL
              try {
                const response = await fetch(s.photo);
                if (response.ok) {
                  imageBuffer = await response.arrayBuffer();
                  const contentType = response.headers.get('content-type');
                  if (contentType?.includes('png')) extension = 'png';
                }
              } catch (err) {
                console.warn('Failed to fetch image url', s.photo);
              }
            }

            if (imageBuffer) {
              const imageId = workbook.addImage({
                buffer: imageBuffer,
                extension: extension,
              });

              worksheet.addImage(imageId, {
                tl: { col: 1.1, row: rowIndex - 1.1 }, // Column B (index 1), Row (0-based) - adjust slightly for padding
                ext: { width: 60, height: 80 },
                editAs: 'oneCell'
              });
            } else {
              worksheet.getCell(`B${rowIndex}`).value = '[Không tải được ảnh]';
            }
          } catch (err) {
            console.error('Error adding image for student', s.fullName, err);
            worksheet.getCell(`B${rowIndex}`).value = '[Lỗi xử lý ảnh]';
          }
        }

        // 3. Info
        worksheet.getCell(`C${rowIndex}`).value = s.fullName.toUpperCase();
        worksheet.getCell(`D${rowIndex}`).value = s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : '';
        worksheet.getCell(`E${rowIndex}`).value = s.cardNumber || s.studentCode || '';
        worksheet.getCell(`F${rowIndex}`).value = formData.className || '';

        // Style Borders
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
          worksheet.getCell(`${col}${rowIndex}`).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }

      // Generate Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DanhSachHocVien_${formData.number || 'Export'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Export failed:', e);
      alert('Có lỗi khi xuất Excel. Vui lòng thử lại. Chi tiết lỗi xem console.');
    }
  };

  const renderDecisionForm = () => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-7xl rounded-xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col h-[90vh]">
        <div className="bg-green-600 text-white px-6 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg">
            <FileText size={20} />
            <span>{viewType === 'OPENING' ? 'Quyết định Mở lớp' : 'Quyết định Công nhận'}</span>
          </div>
          <button onClick={() => setIsFormOpen(false)} className="hover:bg-green-700/50 p-1 rounded-full"><X size={24} /></button>
        </div>

        <div className="bg-white px-6 py-3 border-b flex justify-between items-center shrink-0">
          <div className="text-sm font-bold text-slate-500">
            {formData.number ? `Số QĐ: ${formData.number}` : 'Tạo mới quyết định'}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm hover:bg-emerald-700 transition-colors"><FileSpreadsheet size={16} /> Xuất Excel</button>
            <button onClick={handlePrintDecision} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors"><Printer size={16} /> Xuất QĐ</button>
            {viewType === 'RECOGNITION' ? (
              <button onClick={handlePrintRequestList} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 transition-colors"><ScrollText size={16} /> DS Đề nghị</button>
            ) : (
              <button onClick={handlePrintStudentCards} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 transition-colors"><IdCard size={16} /> In thẻ học viên</button>
            )}
            <button onClick={handleSaveDecision} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-bold text-sm"><Save size={16} /> Lưu</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50">
          <div className="relative bg-white p-6 rounded-xl border border-slate-200 shadow-sm pt-8">
            <div className="absolute -top-3 left-4 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm text-xs font-bold text-slate-500 uppercase font-mono tracking-wider">Thông tin chung</div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Số Quyết Định *</label>
                <input type="text" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{viewType === 'OPENING' ? 'Lớp Đào Tạo' : 'Dựa trên QĐ Mở lớp'} *</label>
                <select
                  value={viewType === 'OPENING' ? formData.classId : ''}
                  onChange={e => handleTypeLinkSelect(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-[13px] bg-white font-medium text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Chọn --</option>
                  {viewType === 'OPENING' ? (
                    availableClasses.map(c => <option key={c.id} value={c.id}>{c.name || c.attributes?.name}</option>)
                  ) : (
                    getDecisionsWithGrades().map(d => <option key={d.id} value={d.id}>{d.className} ({d.number})</option>)
                  )}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Đợt/Khóa</label>
                <input type="text" value={formData.trainingCourse} onChange={e => setFormData({ ...formData, trainingCourse: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ngày Ký</label>
                <input type="date" value={formData.signedDate} onChange={e => setFormData({ ...formData, signedDate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Người Ký</label>
                <input type="text" value={formData.signer} onChange={e => setFormData({ ...formData, signer: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          </div>

          <div className="relative bg-white p-6 rounded-xl border border-slate-200 shadow-sm pt-8 min-h-[400px] flex flex-col">
            <div className="absolute -top-3 left-4 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm text-xs font-bold text-slate-500 uppercase font-mono tracking-wider">Danh sách học viên ({tempStudents.length})</div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Danh sách chính thức</div>
              {currentUser?.role === UserRole.ADMIN && (
                <button onClick={() => setIsAddStudentModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Plus size={14} /> Thêm thủ công</button>
              )}
            </div>
            <div className="overflow-hidden border border-slate-200 rounded-lg flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="px-4 py-1.5 w-16 text-center">STT</th>
                    <th className="px-4 py-1.5 min-w-[150px]">Họ tên</th>
                    <th className="px-4 py-1.5 text-center">Số CCCD</th>
                    <th className="px-4 py-1.5 text-center">Ngày sinh</th>
                    <th className="px-4 py-1.5">Quê quán</th>
                    <th className="px-4 py-1.5 text-center">Hồ sơ</th>
                    <th className="px-4 py-1.5 w-16 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tempStudents.map((s, idx) => (
                    <tr key={s.id || `temp-${idx}`} className="hover:bg-slate-50 group">
                      <td className="px-4 py-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2 font-bold text-slate-700 uppercase leading-none">
                        {s.fullName}
                      </td>
                      <td className="px-4 py-2 text-center text-slate-500 font-medium">{s.cardNumber || '--'}</td>
                      <td className="px-4 py-2 text-center text-slate-500 font-medium">{s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : '--'}</td>
                      <td className="px-4 py-2 text-slate-600 text-[11px] font-medium">{s.hometown}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          {s.documents && s.documents.length > 0 ? (
                            <button
                              onClick={() => setViewingDocsStudentId(s.id)}
                              className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-1.5 py-0.5 rounded text-[10px] font-black border border-green-100 hover:bg-green-100 transition-colors shadow-sm"
                              title="Xem hồ sơ"
                            >
                              <Paperclip size={10} /> {s.documents.length}
                            </button>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => removeStudentFromTemp(s.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {tempStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 italic">Chưa có học viên nào trong danh sách.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddStudentModal = () => (
    <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold">Chọn học viên thêm vào quyết định</h2>
          <button onClick={() => setIsAddStudentModalOpen(false)} className="hover:bg-slate-700 p-1 rounded-full"><X /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Tìm tên, mã học viên..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 border-b font-bold text-slate-600">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = allStudents.map(s => s.id);
                        setSelectedStudentsToAdd(new Set(allIds));
                      } else {
                        setSelectedStudentsToAdd(new Set());
                      }
                    }} />
                  </th>
                  <th className="p-3">Họ tên</th>
                  <th className="p-3">Mã HV</th>
                  <th className="p-3">Ngày sinh</th>
                  <th className="p-3">Lớp hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allStudents.filter(s => {
                  const matchSearch = s.fullName.toLowerCase().includes(searchStudent.toLowerCase()) ||
                    s.studentCode.toLowerCase().includes(searchStudent.toLowerCase());
                  // In Opening mode, filter by selected class and EXCLUDE graduated students
                  // In Recognition, show all (or could filter differently)
                  const matchClass = viewType === 'OPENING'
                    ? (s.classId === formData.classId && !assignedStudentIds.has(s.id))
                    : true;
                  return matchSearch && matchClass;
                }).map(s => (
                  <tr key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedStudentsToAdd.has(s.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedStudentsToAdd.has(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                    </td>
                    <td className="p-3 font-bold text-slate-700 uppercase">{s.fullName}</td>
                    <td className="p-3 font-mono text-blue-600 font-medium">{s.studentCode}</td>
                    <td className="p-3 text-slate-500">{s.dob || '--'}</td>
                    <td className="p-3 text-slate-400">{s.className}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t bg-white flex justify-between items-center">
          <div className="text-sm font-medium text-slate-500">Đã chọn: <span className="text-blue-600 font-bold">{selectedStudentsToAdd.size}</span> học viên</div>
          <div className="flex gap-3">
            <button onClick={() => setIsAddStudentModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Hủy</button>
            <button onClick={handleAddStudentsToTemp} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">Thêm vào danh sách</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocsModal = () => {
    const student = tempStudents.find(s => s.id === viewingDocsStudentId);
    if (!student || !student.documents) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Hồ sơ đính kèm ({student.documents.length})</h3>
            <button onClick={() => setViewingDocsStudentId(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            <div className="space-y-2">
              {student.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md hover:border-blue-200 hover:shadow-sm group transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                      <span className="text-[10px] text-slate-400">{doc.date} • {doc.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                    </div>
                  </div>
                  <a href={doc.url} download={doc.name} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Tải xuống">
                    <Upload size={16} className="rotate-180" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
              <FileText size={28} className={viewType === 'OPENING' ? "text-blue-600" : "text-emerald-600"} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {viewType === 'OPENING' ? "Quản lý Quyết định Mở lớp" : "Quản lý Quyết định Công nhận"}
              </h1>
              <p className="text-sm text-slate-500">
                {viewType === 'OPENING'
                  ? "Quản lý các quyết định mở lớp đào tạo"
                  : "Quản lý các quyết định công nhận tốt nghiệp và cấp chứng chỉ"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setIsAuditModalOpen(true); loadAuditLogs(); }} className="bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold flex gap-2 shadow-sm transition-all">
            <History size={20} /> Lịch sử
          </button>
          <button onClick={() => {
            setEditingId(null);
            setFormData({
              number: '', signedDate: new Date().toISOString().split('T')[0], signer: 'HIỆU TRƯỞNG',
              location: FIXED_LOCATION, company: '', classType: '', classCode: '', className: '', trainingCourse: '', notes: '', classId: '', relatedOpeningId: '', startIndex: '1'
            });
            setTempStudents([]);
            setIsFormOpen(true);
          }} className={`${viewType === 'OPENING' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'} text-white px-5 py-2.5 rounded-xl font-bold flex gap-2 shadow-lg transition-all`}><Plus /> Tạo mới</button>
        </div>
      </div>

      {/* Tabs Control */}
      {
        !mode && (
          <div className="bg-white p-1.5 rounded-xl inline-flex mb-8 border border-slate-200 shadow-sm">
            <button
              onClick={() => setViewType('OPENING')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewType === 'OPENING' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <School size={18} /> Quyết định Mở lớp
            </button>
            <button
              onClick={() => setViewType('RECOGNITION')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewType === 'RECOGNITION' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <GraduationCap size={18} /> Quyết định Công nhận
            </button>
          </div>
        )
      }

      {
        error && (
          <div className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3 animate-pulse">
            <Search size={20} />
            <span className="font-medium">{error}</span>
          </div>
        )
      }

      <div className="mb-8 relative group">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input type="text" placeholder="Tìm theo số QĐ, tên lớp, khóa đào tạo..." value={mainSearchTerm} onChange={e => setMainSearchTerm(e.target.value)} className="pl-12 pr-4 py-4 w-full bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-4 focus:ring-blue-50 transition-all border-blue-100" />
      </div>

      {
        loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium tracking-wide">Đang tải dữ liệu...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Không tìm thấy quyết định nào.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden shadow-slate-200/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300 w-16 text-center">STT</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300">Số QĐ</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300">Lớp Đào Tạo</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300">Đợt/Khóa</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300">Ngày Ký</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300 text-center">Học Viên</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300">Người Ký</th>
                    <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-slate-300 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDecisions.map((d, index) => (
                    <tr
                      key={d.id}
                      className={`transition-all cursor-pointer group ${checkIfLocked(d.id) ? 'bg-slate-50/50 grayscale-[0.3]' : 'hover:bg-slate-50/80'}`}
                      onClick={() => {
                        if (checkIfLocked(d.id)) {
                          alert("Quyết định này đã bị khóa (Đã có QĐ Công nhận). Bạn chỉ có thể xem, không thể sửa.");
                        }
                        setEditingId(d.id);
                        setFormData({
                          number: d.number, signedDate: d.signedDate, signer: d.signer,
                          location: d.location, company: d.company, classType: d.classType,
                          classCode: d.classCode, className: d.className, trainingCourse: d.trainingCourse, notes: d.notes, classId: d.classId || '', relatedOpeningId: d.relatedOpeningId || '', startIndex: '1'
                        });
                        setTempStudents(d.students || []);
                        setIsFormOpen(true);
                      }}
                    >
                      <td className="px-6 py-5 text-sm font-bold text-slate-400 text-center">{index + 1}</td>
                      <td className="px-6 py-5">
                        <span className="inline-flex px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-black border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase tracking-tight">
                          {d.number}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors">
                        {d.className}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-500">
                        {d.trainingCourse || '---'}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                          <Calendar size={14} className="text-slate-300" />
                          {d.signedDate ? new Date(d.signedDate).toLocaleDateString('vi-VN') : '--'}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-black">
                          <Users size={12} />
                          {d.students ? d.students.length : 0}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-500 font-medium">
                        {d.signer}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {!checkIfLocked(d.id) && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(d.id);
                                  setFormData({
                                    number: d.number, signedDate: d.signedDate, signer: d.signer,
                                    location: d.location, company: d.company, classType: d.classType,
                                    classCode: d.classCode, className: d.className, trainingCourse: d.trainingCourse, notes: d.notes, classId: d.classId || '', relatedOpeningId: d.relatedOpeningId || '', startIndex: '1'
                                  });
                                  setTempStudents(d.students || []);
                                  setIsFormOpen(true);
                                }}
                                className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm shadow-blue-100"
                                title="Sửa quyết định"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteDecision(d.id, e)}
                                className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm shadow-red-100"
                                title="Xóa quyết định"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {checkIfLocked(d.id) && (
                            <div className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase rounded-lg border border-amber-100 flex items-center gap-1">
                              <ShieldCheck size={12} /> Đã khóa
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-black uppercase tracking-widest">
              <span>Tổng cộng: {filteredDecisions.length} quyết định</span>
              <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              </div>
            </div>
          </div>
        )
      }
      {isFormOpen && renderDecisionForm()}

      {isAddStudentModalOpen && renderAddStudentModal()}
      {renderDocsModal()}

      {/* Audit Log Modal */}
      {
        isAuditModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
              <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <History className="text-blue-400" />
                  <h2 className="text-lg font-bold">Lịch sử hoạt động</h2>
                </div>
                <button onClick={() => setIsAuditModalOpen(false)} className="hover:bg-slate-700 p-1 rounded-full"><X /></button>
              </div>

              <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b text-slate-500 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="px-6 py-3 w-40">Thời gian</th>
                      <th className="px-6 py-3 w-40">Người thực hiện</th>
                      <th className="px-6 py-3 w-32">Hành động</th>
                      <th className="px-6 py-3">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-500 font-medium">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            {new Date(log.createdAt || log.publishedAt).toLocaleString('vi-VN')}
                          </div>
                        </td>
                        <td className="px-6 py-3 font-bold text-slate-700">{log.actor}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${(log.action || '').includes('CREATE') ? 'bg-green-100 text-green-700' :
                            (log.action || '').includes('UPDATE') ? 'bg-blue-100 text-blue-700' :
                              (log.action || '').includes('DELETE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{log.details}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">Chưa có lịch sử hoạt động nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default DecisionsView;
