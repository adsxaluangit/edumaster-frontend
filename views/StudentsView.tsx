
import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Trash2, Plus, Search, Filter, ChevronDown, X, Camera, Save, Calendar, User, Upload, Check, Phone, MapPin, Briefcase, Flag, School, Edit3, Image as ImageIcon, FileText, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { Student } from '../types';
import { MOCK_STUDENTS, MOCK_NATIONS, MOCK_CLASSES } from '../mockData';
import { fetchCategory, createCategory, updateCategory, deleteCategory, COLLECTIONS } from '../services/api';

// MOCK_STUDENTS loaded from mockData.ts

// INITIAL_NATIONS loaded from mockData.ts

const StudentsView: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nations, setNations] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allDecisions, setAllDecisions] = useState<any[]>([]);

  // Photo states
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [isCameraLive, setIsCameraLive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Document Upload State
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);
  const [viewingDocsStudentId, setViewingDocsStudentId] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    studentCode: '',
    fullName: '',
    dob: '',
    pob: '',
    ethnicity: '',
    phone: '',
    idNumber: '',
    group: '',
    classCode: '',
    classId: '', // Added for Relation
    nationality: 'Việt Nam',
    address: '',
    gender: 'Nam',
    cardNumber: ''
  });



  // Helper: Map API Response (snake_case) to Frontend Model (camelCase)
  const mapStudentFromApi = (data: any): Student => {
    // Handle school_class relation (could be object or wrapper)
    const classRel = data.school_class?.data || data.school_class;
    const classObj = classRel?.attributes ? { id: classRel.id, ...classRel.attributes } : classRel;

    return {
      id: String(data.documentId || data.id), // Prefer Document ID in v5
      strapiId: data.strapiId || data.id, // Store numeric ID for relations
      stt: data.stt || 0,
      studentCode: data.student_code || '',
      // ... (rest preserved internally)
      full_name: data.full_name || '', // Note: fullName property is below
      fullName: data.full_name || '',
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      dob: data.dob || '',
      pob: data.pob || '',
      gender: data.gender || 'Nam',
      idNumber: data.id_number || '', // CCCD
      ethnicity: data.ethnicity || '',
      nationality: data.nationality || 'Việt Nam',
      address: data.address || '',
      phone: data.phone || '',
      photo: data.photo || null,
      group: classObj?.name || data.group || '', // Prefer relation name
      classCode: classObj?.code || data.class_code || '',
      className: classObj?.name || data.class_name || '',
      classId: classObj?.documentId || classObj?.id || '',
      cardNumber: data.card_number || '', // If used
      isApproved: data.is_approved || false, // Maps boolean from API
      documents: (Array.isArray(data.documents) ? data.documents : data.documents?.data || []).map((d: any) => ({
        id: d.documentId || d.id,
        name: d.attributes?.name || d.name,
        url: d.attributes?.url || d.url,
        type: d.attributes?.mime || d.type || 'application/pdf',
        date: d.attributes?.createdAt || d.createdAt ? new Date(d.attributes?.createdAt || d.createdAt).toLocaleDateString('vi-VN') : ''
      })) || []
    } as any; // Cast as any to avoid strict type error if type not updated yet
  };

  // Load nations and classes from API
  const loadData = async () => {
    setLoading(true);
    try {
      // Load Classes
      const classesData = await fetchCategory(COLLECTIONS.CLASSES);
      if (classesData) setAvailableClasses(classesData);
      else setAvailableClasses(MOCK_CLASSES);

      // Load Nations
      const nationsData = await fetchCategory(COLLECTIONS.NATIONS);
      if (nationsData) setNations(nationsData);
      else setNations(MOCK_NATIONS);

      // Load Students (and Map)
      const [studentsRaw, decisionsRaw] = await Promise.all([
        fetchCategory(COLLECTIONS.STUDENTS),
        fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[students]=true&populate[school_class]=true`)
      ]);

      if (decisionsRaw) setAllDecisions(decisionsRaw);

      if (studentsRaw) {
        console.log('[DEBUG] Students Raw Sample:', studentsRaw[0]);
        const mappedStudents = studentsRaw.map(mapStudentFromApi);

        // Identify students who have been assigned to an OPENING decision
        const assignedStudentIds = new Set<string>();
        if (decisionsRaw) {
          decisionsRaw
            .filter((d: any) => d.type === 'OPENING')
            .forEach((d: any) => {
              const studentsInDec = d.students?.data || d.students || [];
              studentsInDec.forEach((s: any) => {
                assignedStudentIds.add(String(s.documentId || s.id));
              });
            });
        }

        // Hide assigned students from active management
        const activeStudents = mappedStudents.filter(s => !assignedStudentIds.has(s.id));
        setStudents(activeStudents);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isFormOpen]);

  const [loading, setLoading] = useState(false);



  // Filtered Students
  const filteredStudents = students.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = s.fullName ? s.fullName.toLowerCase() : '';
    const studentCode = s.studentCode ? s.studentCode.toLowerCase() : '';
    const groupName = s.group ? s.group.toLowerCase() : '';

    const matchesSearch = fullName.includes(searchLower) ||
      studentCode.includes(searchLower) ||
      groupName.includes(searchLower);

    const matchesClass = selectedClassFilter ? s.group === selectedClassFilter : true;

    // --- Visibility Rule: Hide if Graduated < 5 Years ---
    const isRestricted = allDecisions.some((d: any) => {
      // Check if decision is RECOGNITION
      if (d.type !== 'RECOGNITION') return false;

      // Check if decision is for the student's current class
      const decClass = d.school_class?.data || d.school_class;
      const decClassName = (decClass?.attributes?.name || decClass?.name || d.class_name || '').trim().toLowerCase();
      if (decClassName !== (s.group || '').trim().toLowerCase()) return false;

      // Check if student is in this decision
      const studentsInDec = d.students?.data || d.students || [];
      const isStudentInDecision = studentsInDec.some((sDec: any) =>
        (sDec.attributes?.student_code || sDec.student_code) === s.studentCode ||
        (sDec.attributes?.id_number || sDec.id_number) === s.studentCode
      );

      if (!isStudentInDecision) return false;

      // Check Time Constraint (< 5 Years)
      const signedDateStr = d.signed_date || d.signedDate;
      if (!signedDateStr) return false;

      const signedDate = new Date(signedDateStr);
      const now = new Date();
      const diffYears = (now.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

      return diffYears < 5;
    });

    if (isRestricted) return false;
    // ----------------------------------------------------

    // Debug logging for specific missing case
    if (!matchesSearch && !matchesClass) {
      // console.log(`Hidden: ${s.fullName} - Class: ${s.group}`);
    }

    return matchesSearch && matchesClass;
  });

  // Handle class selection change
  const handleClassChange = (className: string) => {
    const selectedClass = availableClasses.find(c => c.name === className);
    setFormData({
      ...formData,
      group: className,
      classCode: selectedClass ? selectedClass.code : '',
      classId: selectedClass ? (selectedClass.strapiId || selectedClass.id) : ''
    });
  };

  // Handle ID Number change (syncs with studentCode)
  const handleIdNumberChange = (val: string) => {
    setFormData({
      ...formData,
      idNumber: val,
      studentCode: val
    });
  };

  const startCamera = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraLive(true);
      }
    } catch (err) {
      alert("Không thể truy cập Camera. Vui lòng kiểm tra quyền trình duyệt.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraLive(false);
  };

  const capturePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        // Định dạng ảnh chuẩn 3x4 (300px x 400px hoặc 600px x 800px)
        canvas.width = 600;
        canvas.height = 800;
        const video = videoRef.current;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const targetRatio = 3 / 4;

        let sX = 0, sY = 0, sW = videoWidth, sH = videoHeight;

        // Cắt ảnh từ trung tâm video theo tỉ lệ 3:4
        if (videoWidth / videoHeight > targetRatio) {
          sW = videoHeight * targetRatio;
          sX = (videoWidth - sW) / 2;
        } else {
          sH = videoWidth / targetRatio;
          sY = (videoHeight - sH) / 2;
        }

        context.drawImage(video, sX, sY, sW, sH, 0, 0, 600, 800);
        setStudentPhoto(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
      }
    }
  };

  const handleEdit = (student: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(student.id);
    setFormData({
      studentCode: student.studentCode || '',
      fullName: student.fullName || '',
      dob: student.dob ? (student.dob.includes('-') ? student.dob.split('-').reverse().join(',') : student.dob) : '',
      pob: student.pob || '',
      ethnicity: student.ethnicity || '',
      phone: student.phone || '',
      idNumber: student.idNumber || '',
      group: student.group || '',
      classCode: student.classCode || '',
      // Find class ID based on name if editing existing student
      classId: availableClasses.find(c => c.name === student.group)?.strapiId || availableClasses.find(c => c.name === student.group)?.id || '',
      nationality: student.nationality || 'Việt Nam',
      address: student.address || '',
      gender: student.gender || 'Nam',
      cardNumber: student.cardNumber || ''
    });
    setStudentPhoto(student.photo || null);
    setIsFormOpen(true);
  };

  const handleDobChange = (dob: string) => {
    setFormData(prev => ({ ...prev, dob }));
    if (!dob) return;

    const parts = dob.split(',');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 16) {
        alert("Bạn chưa đủ 16 tuổi.");
      }
    }
  };

  const handleSave = () => {
    if (!formData.fullName || !formData.group || !formData.idNumber || !formData.dob) {
      alert('Vui lòng nhập đầy đủ: Họ tên, Ngày sinh, Lớp học và Số CMND/CCCD!');
      return;
    }

    // Age validation check on save
    const parts = formData.dob.split(',');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      alert('Vui lòng chọn đầy đủ ngày tháng năm sinh!');
      return;
    }
    const birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 16) {
      alert("Bạn chưa đủ 16 tuổi.");
      return;
    }

    // --- Validation: Check 5-Year Re-registration Rule ---
    const currentClassId = formData.classId;
    const currentClassName = formData.group.trim().toLowerCase();
    const currentIdNumber = formData.idNumber.trim();

    // 1. Check if already enrolled in the ACTIVE students list for THIS class
    if (!editingId) {
      const isAlreadyInActive = students.some(s =>
        (s.studentCode === currentIdNumber || s.idNumber === currentIdNumber) &&
        (s.classId === currentClassId || s.group.trim().toLowerCase() === currentClassName)
      );
      if (isAlreadyInActive) {
        alert("THÔNG BÁO: Học viên này hiện đang có tên trong danh sách lớp này rồi!");
        return;
      }
    }

    // 2. Check 5-year rule from previous recognition decisions
    const conflictingDecision = allDecisions.find((d: any) => {
      if (d.type !== 'RECOGNITION') return false;

      const decClass = d.school_class?.data || d.school_class;
      const decClassId = String(decClass?.documentId || decClass?.id || '');
      const decClassName = (decClass?.name || d.class_name || '').trim().toLowerCase();

      // Match class by ID (preferred) or Name
      const isSameClass = (currentClassId && decClassId === currentClassId) || (decClassName === currentClassName);
      if (!isSameClass) return false;

      const studentsInDec = d.students?.data || d.students || [];
      return studentsInDec.some((s: any) =>
        s.student_code === currentIdNumber ||
        s.id_number === currentIdNumber ||
        s.card_number === currentIdNumber
      );
    });

    if (conflictingDecision) {
      const signedDateStr = conflictingDecision.signed_date || conflictingDecision.signedDate;
      if (signedDateStr) {
        const signedDate = new Date(signedDateStr);
        const now = new Date();
        const diffYears = (now.getTime() - signedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

        if (diffYears < 5) {
          const proceed = window.confirm(`THÔNG BÁO: Học viên này ĐÃ CÓ CHỨNG CHỈ NÀY RỒI.\n(Được cấp theo Quyết định số ${conflictingDecision.decision_number || conflictingDecision.number} ngày ${signedDateStr})\n\nBạn có chắc chắn muốn đăng ký cho học viên này học lại lớp này (trong vòng 5 năm) không?`);
          if (!proceed) return;
        }
      }
    }
    // -----------------------------------------------------

    // Prepare Payload
    const nameParts = formData.fullName.trim().split(' ');
    const firstName = nameParts.length > 1 ? nameParts.pop() || '' : formData.fullName;
    const lastName = nameParts.length > 0 ? nameParts.join(' ') : '';

    // Payload for Strapi (snake_case)
    const payload = {
      student_code: formData.studentCode,
      full_name: formData.fullName.toUpperCase(),
      first_name: firstName.toUpperCase(),
      last_name: lastName.toUpperCase(),
      dob: formData.dob,
      pob: formData.pob,
      gender: formData.gender,
      id_number: formData.idNumber, // CCCD
      ethnicity: formData.ethnicity,
      nationality: formData.nationality,
      address: formData.address,
      phone: formData.phone,
      photo: studentPhoto,

      // Relations
      school_class: formData.classId || null,
      // Strapi v5 uses documentId (string) for relations. 
      // Safe to pass as-is.

      // Redundant String Fields (Optional, keep for now if needed by other views)
      group: formData.group,
      class_code: formData.classCode,
      class_name: formData.group,
      card_number: formData.idNumber // Usually same as CCCD
    };

    // Clean Payload remove empty strings if necessary or rely on API handling
    if (!payload.school_class) delete payload.school_class;

    const saveToApi = async () => {
      try {
        if (editingId) {
          await updateCategory(COLLECTIONS.STUDENTS, editingId, payload);
        } else {
          await createCategory(COLLECTIONS.STUDENTS, payload);
        }
        alert(editingId ? 'Cập nhật thành công!' : 'Thêm mới thành công!');
        setIsFormOpen(false);
        setEditingId(null);
        // Re-fetch handled by useEffect dependency [isFormOpen]
      } catch (e) {
        console.error(e);
        alert("Có lỗi xảy ra khi lưu dữ liệu!");
      }
    };
    saveToApi();
  };

  const handleDeleteRow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xóa học viên này? (Hành động này sẽ xóa trên hệ thống)')) {
      try {
        await deleteCategory(COLLECTIONS.STUDENTS, id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        alert("đã xóa thành công!");
      } catch (err) {
        console.error(err);
        alert("Lỗi khi xóa học viên!");
      }
    }
  };

  const handleTriggerUpload = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingStudentId(studentId);
    docInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingStudentId) {
      // Create a capture of the current ID to avoid state race conditions
      const studentId = uploadingStudentId;
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const studentObj = students.find(s => s.id === studentId);
          const payload = {
            name: file.name,
            type: file.type,
            date: new Date().toLocaleDateString('vi-VN'),
            url: reader.result as string,
            student: studentObj?.strapiId || studentId // Use numeric ID for relation
          };

          const savedDoc = await createCategory(COLLECTIONS.STUDENT_DOCUMENTS, payload);

          if (savedDoc) {
            setStudents(prev => prev.map(s => {
              if (s.id === studentId) {
                return { ...s, documents: [...(s.documents || []), savedDoc] };
              }
              return s;
            }));
            alert('Đã tải lên và lưu hồ sơ thành công!');
          }
        } catch (err) {
          console.error("Upload failed:", err);
          alert('Lỗi khi lưu hồ sơ vào hệ thống!');
        } finally {
          setUploadingStudentId(null);
          if (docInputRef.current) docInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleApproval = async (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
      const newStatus = !student.isApproved;
      // Optimistic update
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return { ...s, isApproved: newStatus };
        }
        return s;
      }));

      await updateCategory(COLLECTIONS.STUDENTS, studentId, { is_approved: newStatus });
    } catch (err) {
      console.error("Failed to toggle approval:", err);
      // Revert if failed
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return { ...s, isApproved: !student.isApproved };
        }
        return s;
      }));
      alert("Lỗi khi cập nhật trạng thái duyệt!");
    }
  };

  const renderStudentForm = () => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[1400px] rounded shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200">
        <div className="bg-[#3498db] text-white px-3 py-1.5 flex justify-between items-center text-sm font-bold">
          <span>{editingId ? 'Cập nhật thông tin học viên' : 'Thêm mới học viên'}</span>
          <button onClick={() => { stopCamera(); setIsFormOpen(false); }} className="hover:bg-white/20 p-1 rounded"><X size={18} /></button>
        </div>

        <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={handleSave} className="px-5 py-1 bg-[#54a0ff] text-white rounded border border-[#2e86de] text-[12px] font-bold shadow-sm hover:brightness-105 flex items-center gap-1.5"><Save size={14} /> Lưu</button>
          <button onClick={() => { stopCamera(); setIsFormOpen(false); }} className="px-5 py-1 bg-white text-slate-700 rounded border border-slate-300 text-[12px] font-bold shadow-sm">Đóng</button>
        </div>

        <div className="p-6 bg-white overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-9 space-y-4 h-full overflow-y-auto pr-2">

              {/* Section 1: Thông tin cá nhân */}
              <div className="border border-slate-200 rounded p-4 relative pt-6 bg-slate-50/50 mt-2">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
                  1. Thông tin cá nhân
                </span>
                <div className="grid grid-cols-4 gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-36 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Mã học viên:</label>
                    <input
                      type="text"
                      value={formData.studentCode}
                      readOnly
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] bg-slate-100 text-slate-500 font-mono"
                      placeholder="Tự động tạo từ CCCD"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-24 text-right text-[12px] text-slate-600 font-medium whitespace-nowrap">Họ và tên HV<span className="text-red-500">*</span>:</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all"
                      placeholder="NHẬP HỌ VÀ TÊN"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-1">
                    <label className="w-36 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Ngày sinh<span className="text-red-500">*</span>:</label>
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[0] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${e.target.value},${parts[1] || ''},${parts[2] || ''}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Ngày</option>
                          {Array.from({ length: 31 }, (_, i) => {
                            const day = (i + 1).toString().padStart(2, '0');
                            return <option key={day} value={day}>{day}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                      
                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[1] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${parts[0] || ''},${e.target.value},${parts[2] || ''}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Tháng</option>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = (i + 1).toString().padStart(2, '0');
                            return <option key={month} value={month}>{month}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>

                      <div className="relative">
                        <select
                          value={formData.dob.split(',')[2] || ''}
                          onChange={e => {
                            const parts = formData.dob.split(',');
                            handleDobChange(`${parts[0] || ''},${parts[1] || ''},${e.target.value}`);
                          }}
                          className="w-full border border-slate-300 rounded-sm pl-2 pr-6 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white appearance-none hover:border-blue-400 transition-colors text-slate-700 shadow-sm cursor-pointer"
                        >
                          <option value="" disabled className="text-slate-400">Năm</option>
                          {Array.from({ length: 100 }, (_, i) => {
                            const year = (new Date().getFullYear() - i).toString();
                            return <option key={year} value={year}>{year}</option>
                          })}
                        </select>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-20 text-right text-[12px] text-slate-600 font-medium whitespace-nowrap">Nơi sinh:</label>
                    <select
                      value={formData.pob}
                      onChange={e => setFormData({ ...formData, pob: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">--Chọn nơi sinh--</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Thành phố Huế">Thành phố Huế</option>
                      <option value="Lai Châu">Lai Châu</option>
                      <option value="Điện Biên">Điện Biên</option>
                      <option value="Sơn La">Sơn La</option>
                      <option value="Lạng Sơn">Lạng Sơn</option>
                      <option value="Quảng Ninh">Quảng Ninh</option>
                      <option value="Thanh Hoá">Thanh Hoá</option>
                      <option value="Nghệ An">Nghệ An</option>
                      <option value="Hà Tĩnh">Hà Tĩnh</option>
                      <option value="Cao Bằng">Cao Bằng</option>
                      <option value="Tuyên Quang">Tuyên Quang</option>
                      <option value="Lào Cai">Lào Cai</option>
                      <option value="Thái Nguyên">Thái Nguyên</option>
                      <option value="Phú Thọ">Phú Thọ</option>
                      <option value="Bắc Ninh">Bắc Ninh</option>
                      <option value="Hưng Yên">Hưng Yên</option>
                      <option value="Thành phố Hải Phòng">Thành phố Hải Phòng</option>
                      <option value="Ninh Bình">Ninh Bình</option>
                      <option value="Quảng Trị">Quảng Trị</option>
                      <option value="Thành phố Đà Nẵng">Thành phố Đà Nẵng</option>
                      <option value="Quảng Ngãi">Quảng Ngãi</option>
                      <option value="Gia Lai">Gia Lai</option>
                      <option value="Khánh Hòa">Khánh Hòa</option>
                      <option value="Lâm Đồng">Lâm Đồng</option>
                      <option value="Đắk Lắk">Đắk Lắk</option>
                      <option value="Thành phố Hồ Chí Minh">Thành phố Hồ Chí Minh</option>
                      <option value="Đồng Nai">Đồng Nai</option>
                      <option value="Tây Ninh">Tây Ninh</option>
                      <option value="Thành phố Cần Thơ">Thành phố Cần Thơ</option>
                      <option value="Vĩnh Long">Vĩnh Long</option>
                      <option value="Đồng Tháp">Đồng Tháp</option>
                      <option value="Cà Mau">Cà Mau</option>
                      <option value="An Giang">An Giang</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 col-span-1">
                    <label className="w-24 text-right text-[12px] text-slate-600 font-medium whitespace-nowrap">Giới tính:</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>

                  {/* Row 3: ID, Ethnicity, Nationality */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-36 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Số CMND/CCCD<span className="text-red-500">*</span>:</label>
                    <input
                      type="text"
                      value={formData.idNumber}
                      onChange={e => handleIdNumberChange(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none font-mono"
                      placeholder="Nhập số CCCD/CMND"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-1">
                    <label className="w-24 text-right text-[12px] text-slate-600 font-medium whitespace-nowrap">Dân tộc:</label>
                    <input
                      type="text"
                      value={formData.ethnicity}
                      onChange={e => setFormData({ ...formData, ethnicity: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 col-span-1">
                    <label className="w-24 text-right text-[12px] text-slate-600 font-medium whitespace-nowrap">Quốc tịch:</label>
                    <select
                      value={formData.nationality}
                      onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white"
                    >
                      {nations.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                    </select>
                  </div>

                  {/* Row 4: Class */}
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-36 text-left pl-4 text-[12px] text-slate-600 font-medium whitespace-nowrap">Lớp học<span className="text-red-500">*</span>:</label>
                    <select
                      value={formData.group}
                      onChange={e => handleClassChange(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none bg-white font-medium text-blue-700"
                    >
                      <option value="">--Chọn lớp học--</option>
                      {availableClasses.map(cls => <option key={cls.id} value={cls.name}>{cls.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Liên lạc (Contact) */}
              <div className="border border-slate-200 rounded p-4 relative pt-6 bg-slate-50/50">
                <span className="absolute -top-3 left-4 bg-white px-2 text-[12px] font-bold text-blue-600 border border-blue-100 rounded shadow-sm">
                  2. Thông tin liên lạc
                </span>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="flex items-center gap-2 col-span-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium">Địa chỉ thường trú:</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-32 text-right text-[12px] text-slate-600 font-medium">Điện thoại:</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 border border-slate-300 rounded-sm px-2 py-1.5 text-[12px] focus:border-blue-500 outline-none"
                      placeholder="Số điện thoại liên hệ"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Photo & Score */}
            <div className="col-span-3 space-y-6">
              <div className="flex flex-col items-center">
                <span className="text-[12px] font-bold text-slate-600 mb-2 w-full text-center">Ảnh thẻ 3x4</span>
                <div
                  onClick={isCameraLive ? undefined : startCamera}
                  className="w-[150px] h-[200px] border-2 border-slate-300 rounded-sm bg-white flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group cursor-pointer shadow-md hover:border-blue-400 transition-all"
                  title={isCameraLive ? "" : "Click để mở Webcam"}
                >
                  {isCameraLive ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale-[0.2]" />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-full h-full border-[20px] border-black/40"></div>
                        <div className="absolute inset-0 border-2 border-dashed border-white/50 m-2"></div>
                      </div>
                    </>
                  ) : studentPhoto ? (
                    <img src={studentPhoto} className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                  )}

                  {!isCameraLive && (
                    <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="bg-white/90 p-3 rounded-full shadow-lg">
                        <Camera size={28} className="text-blue-600" />
                      </div>
                    </div>
                  )}

                  {isCameraLive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 gap-2 bg-gradient-to-t from-black/60 via-transparent to-transparent animate-in fade-in duration-300">
                      <div className="flex gap-4">
                        <button
                          onClick={capturePhoto}
                          className="p-3 bg-white rounded-full text-blue-600 shadow-xl hover:scale-110 active:scale-95 transition-all pointer-events-auto"
                          title="Chụp ảnh ngay"
                        >
                          <Camera size={24} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                          className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white shadow hover:bg-red-600 transition-all pointer-events-auto"
                          title="Hủy chụp"
                        >
                          <X size={24} />
                        </button>
                      </div>
                      <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Căn giữa khuôn mặt</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 w-full max-w-[150px]">
                  <button
                    onClick={isCameraLive ? stopCamera : startCamera}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold transition-all border shadow-sm ${isCameraLive
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                      }`}
                  >
                    <Camera size={14} />
                    {isCameraLive ? 'Hủy bỏ' : 'Chụp ảnh 3x4'}
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded border border-slate-200 text-[11px] font-bold hover:bg-slate-100 transition-all shadow-sm"
                  >
                    <Upload size={14} />
                    Tải ảnh lên
                  </button>
                </div>

                <input type="file" ref={fileInputRef} hidden onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const r = new FileReader();
                    r.onload = () => {
                      setStudentPhoto(r.result as string);
                      stopCamera();
                    };
                    r.readAsDataURL(file);
                  }
                }} />
              </div>


            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div >
  );

  const renderDocsModal = () => {
    const student = students.find(s => s.id === viewingDocsStudentId);
    if (!student || !student.documents) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Hồ sơ đính kèm ({student.documents.length})</h3>
            <button onClick={() => setViewingDocsStudentId(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {student.documents.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-xs italic">Chưa có hồ sơ nào</p>
            ) : (
              <div className="space-y-2">
                {student.documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-md hover:border-blue-200 hover:shadow-sm group transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-slate-700 truncate" title={doc.name}>{doc.name}</span>
                        <span className="text-[10px] text-slate-400">{doc.date} • {doc.type?.split('/')?.[1]?.toUpperCase() || 'FILE'}</span>
                      </div>
                    </div>
                    <a href={doc.url} download={doc.name} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Tải xuống">
                      <Upload size={16} className="rotate-180" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-end">
            <button onClick={() => setViewingDocsStudentId(null)} className="px-4 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-100">Đóng</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="bg-[#4a5568] text-white px-3 py-1.5 flex justify-between items-center text-xs font-bold">
        <div className="flex items-center gap-2"><span>Quản lý học viên (v1.1 - Unfiltered)</span><X size={14} className="cursor-pointer hover:bg-white/10" /></div>
      </div>

      {isFormOpen && renderStudentForm()}
      {viewingDocsStudentId && renderDocsModal()}

      <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center gap-2">
        <div className="relative flex-1 max-w-md ml-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo Tên, Mã học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 ring-blue-500/20"
          />
        </div>
        <div className="w-[180px]">
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 ring-blue-500/20 bg-white"
          >
            <option value="">-- Tất cả lớp --</option>
            {availableClasses.map((cls: any) => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mr-2">
          <button className="px-4 py-1.5 bg-slate-50 text-slate-700 rounded border border-slate-300 hover:bg-slate-100 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><FileSpreadsheet size={16} /> Export Excel</button>
          <button onClick={loadData} className="px-4 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] hover:brightness-105 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><RefreshCw size={16} /> Tải lại</button>
          <button onClick={() => { setEditingId(null); setFormData({ studentCode: '', fullName: '', dob: '', pob: '', ethnicity: '', phone: '', idNumber: '', group: '', classCode: '', classId: '', nationality: 'Việt Nam', address: '', gender: 'Nam', cardNumber: '' }); setStudentPhoto(null); setIsFormOpen(true); }} className="px-4 py-1.5 bg-[#54a0ff] text-white rounded border border-[#2e86de] hover:brightness-105 transition-all flex items-center gap-2 text-[12px] font-bold shadow-sm"><Plus size={16} /> Thêm mới</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#f8f9fa]">
        <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
          <thead className="bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200 bg-white">
              <th className="w-10 border-r px-2 py-2 text-center"><Filter size={14} className="text-slate-400 mx-auto" /></th>
              <th className="w-10 border-r px-2 py-2 text-center"><input type="checkbox" onChange={e => e.target.checked ? setSelectedIds(new Set(filteredStudents.map(s => s.id))) : setSelectedIds(new Set())} checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0} /></th>
              <th className="w-12 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">STT</th>
              <th className="w-16 border-r px-2 py-2 text-center text-[12px] font-bold text-slate-700">Ảnh (3x4)</th>
              <th className="w-32 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Mã HV (CCCD)</th>
              <th className="w-48 border-r px-3 py-2 text-[12px] font-bold text-slate-700">Họ và Tên</th>
              <th className="w-32 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Ngày sinh</th>
              <th className="w-24 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Giới tính</th>
              <th className="w-48 border-r px-3 py-2 text-[12px] font-bold text-slate-700">Lớp học</th>

              <th className="w-32 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Điện thoại</th>
              <th className="w-24 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Hồ sơ HV</th>
              <th className="w-28 border-r px-3 py-2 text-center text-[12px] font-bold text-slate-700">Trạng thái</th>
              <th className="w-24 px-3 py-2 text-center text-[12px] font-bold text-slate-700">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredStudents.map((s) => (
              <tr key={s.id} className={`border-b hover:bg-[#e3f2fd] transition-colors text-[12px] ${selectedIds.has(s.id) ? 'bg-[#bbdefb]' : ''}`} onClick={() => setSelectedIds(prev => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; })}>
                <td className="border-r px-2 py-1.5 text-center"><ChevronDown size={14} className="text-slate-400 mx-auto -rotate-90" /></td>
                <td className="border-r px-2 py-1.5 text-center"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={e => { e.stopPropagation(); setSelectedIds(prev => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; }); }} /></td>
                <td className="border-r px-3 py-1.5 text-center text-slate-500">{s.stt}</td>
                <td className="border-r px-2 py-1.5 text-center">
                  <div className="w-[36px] h-[48px] mx-auto rounded overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
                    {s.photo ? (
                      <img src={s.photo} alt={s.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-slate-300" />
                    )}
                  </div>
                </td>
                <td className="border-r px-3 py-1.5 font-medium text-blue-700 text-center">{s.studentCode}</td>
                <td className="border-r px-3 py-1.5 font-bold uppercase truncate">{s.fullName}</td>
                <td className="border-r px-3 py-1.5 text-center">
                  {s.dob ? new Date(s.dob).toLocaleDateString('vi-VN') : '--'}
                </td>
                <td className="border-r px-3 py-1.5 text-center">{s.gender}</td>
                <td className="border-r px-3 py-1.5 font-medium text-indigo-700 truncate">{s.group}</td>

                <td className="border-r px-3 py-1.5 text-center">{s.phone || '--'}</td>
                <td className="border-r px-3 py-1.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={(e) => handleTriggerUpload(s.id, e)} className="text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 p-1.5 rounded-full hover:bg-blue-50" title="Tải hồ sơ lên">
                      <Upload size={14} className="mx-auto" />
                    </button>
                    {s.documents && s.documents.length > 0 && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); setViewingDocsStudentId(s.id); }}>
                        {s.documents.length} file
                      </span>
                    )}
                  </div>
                </td>
                <td className="border-r px-3 py-1.5 text-center">
                  <button
                    onClick={(e) => toggleApproval(s.id, e)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border transition-all shadow-sm mx-auto ${s.isApproved
                      ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                      : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'}`}
                    title={s.isApproved ? "Click để hủy duyệt" : "Click để duyệt hồ sơ"}
                  >
                    {s.isApproved ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                    {s.isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                  </button>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex justify-center gap-2">
                    <button onClick={(e) => handleEdit(s, e)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Sửa"><Edit3 size={16} /></button>
                    <button onClick={(e) => handleDeleteRow(s.id, e)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Xóa"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={11} className="py-20 text-center text-slate-400 italic">Không tìm thấy học viên nào phù hợp với từ khóa "{searchTerm}"</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 border-t px-4 py-1.5 flex justify-between items-center text-[11px] text-slate-500 font-medium">
        <div>Hiển thị {filteredStudents.length} / {students.length} học viên</div>
        <div>{selectedIds.size > 0 && <span className="text-blue-600 font-bold mr-4">Đang chọn: {selectedIds.size}</span>}Trang 1 / 1</div>
      </div>
      <input type="file" ref={docInputRef} hidden onChange={handleFileChange} />
    </div>
  );
};

export default StudentsView;
