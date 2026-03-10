import React, { useState, useEffect } from 'react';
import {
    ClipboardCheck,
    Search,
    BookOpen,
    Users,
    ChevronRight,
    School,
    CheckCircle2,
    X,
    Printer,
    FileSpreadsheet,
    Layout,
    AlertCircle,
    Calendar,
    FileText,
    GraduationCap
} from 'lucide-react';
import { fetchCategory, createCategory, updateCategory, fetchItem, COLLECTIONS } from '../services/api';

const API_BASE_URL = process.env.API_URL ? process.env.API_URL.replace(/\/api\/?$/, '') : ''; // Use relative base for images

// Interface for Decision
interface DecisionRecord {
    id: string; // Used internally in React as documentId
    strapiId?: number;
    documentId?: string;
    number: string;
    decisionNumber: string;
    classCode: string;
    className: string;
    trainingCourse: string;
    signedDate: string;
    classId: string; // school-class documentId
    studentCount: number;
    students?: any[]; // Raw students data
}

interface Student {
    id: string;
    studentCode: string;
    fullName: string;
    dob: string;
    gender: string;
    photo?: string;
}

interface Subject {
    id: string;
    strapiId?: number;
    code: string;
    name: string;
    hasTheory?: boolean;
    hasPractice?: boolean;
}

interface ApprovalRecord {
    practicePass: boolean;
    theoryApproved: boolean;
}

const ExamApprovalView: React.FC = () => {
    // Data State
    const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'decision_list' | 'approval_detail'>('decision_list');

    // Approval State: Map<subjectId, Map<studentCode, ApprovalRecord>>
    // We store approvals for the SELECTED decision only
    const [approvals, setApprovals] = useState<Record<string, Record<string, ApprovalRecord>>>({});
    const [currentApprovalId, setCurrentApprovalId] = useState<string | null>(null); // documentId of exam-approval record

    // Students for current decision
    const [decisionStudents, setDecisionStudents] = useState<Student[]>([]);
    // Subjects for current decision
    const [decisionSubjects, setDecisionSubjects] = useState<Subject[]>([]);

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [decisionsData, subjectsData] = await Promise.all([
                fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?populate[school_class]=true&populate[related_decision]=true&populate[students]=true`),
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

            // 2. Filter valid decisions: must be OPENING, have a class, and not be finalized
            const validDecisions = (decisionsData || []).filter((d: any) => {
                const isOpening = d.type === 'OPENING';
                const classData = d.school_class?.data || d.school_class;
                const isNotFinalized = !finalizedOpeningIds.has(String(d.documentId || d.id));
                return isOpening && !!classData && isNotFinalized;
            }).map((d: any) => ({
                id: d.documentId || d.id,
                strapiId: d.id,
                documentId: d.documentId,
                number: d.decision_number,
                decisionNumber: d.decision_number,
                trainingCourse: d.training_course,
                signedDate: d.signed_date,
                className: (d.school_class?.data?.attributes?.name || d.school_class?.name || d.school_class?.attributes?.name),
                classCode: (d.school_class?.data?.attributes?.code || d.school_class?.code || d.school_class?.attributes?.code || 'NO-CODE'),
                classId: (d.school_class?.data?.documentId || d.school_class?.documentId || d.school_class?.data?.id || d.school_class?.id),
                studentCount: (d.students?.data?.length || d.students?.length || 0),
                students: d.students // Keep raw reference
            }));

            setDecisions(validDecisions);

            // Map subjects
            const mappedSubjects = (subjectsData || []).map((s: any) => ({
                id: String(s.id),
                strapiId: s.strapiId,
                code: s.code,
                name: s.name,
                hasTheory: s.has_theory !== false, // Default to true
                hasPractice: s.has_practice === true // Default to false
            }));
            setSubjects(mappedSubjects);

        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Decisions
    const filteredDecisions = decisions.filter(d =>
        (d.number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.className || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.classCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Initial Load for Decision Detail
    const handleDecisionSelect = async (decision: DecisionRecord) => {
        setLoading(true);

        try {
            // 0. Fetch Full Decision Details (Deep Populate) to ensure we get photos
            // We use 'fetchItem' pattern but need valid endpoint.
            // decision.documentId is preferred in v5, id in v4.
            const decisionId = decision.documentId || decision.id;

            // Re-fetch decision with deep populate for students
            // Note: populate[students][populate]=* ensures we get all fields of students
            const fullDecisionRaw = await fetchCategory(`${COLLECTIONS.CLASS_DECISIONS}?filters[documentId][$eq]=${decisionId}&populate[students][populate]=*`);

            let fullDecision = decision;
            let rawStudents: any[] = [];

            if (fullDecisionRaw && fullDecisionRaw.length > 0) {
                const fd = fullDecisionRaw[0];
                // Update local decision object if needed, or just extract students
                if (fd.students) {
                    if (Array.isArray(fd.students)) rawStudents = fd.students;
                    else if (fd.students.data) rawStudents = fd.students.data;
                }
                console.log('Fetched Full Decision Students:', rawStudents);
            } else {
                // Fallback to existing
                if (Array.isArray(decision.students)) rawStudents = decision.students || [];
            }

            setSelectedDecision(decision);

            // 1. Fetch Class Details -> Subjects
            let classSubs: Subject[] = [];
            if (decision.classId) {
                try {
                    const classDetail = await fetchItem(COLLECTIONS.CLASSES, decision.classId);
                    let rawSubs: any[] = [];

                    if (classDetail) {
                        if (Array.isArray(classDetail.subjects)) rawSubs = classDetail.subjects;
                        else if (classDetail.subjects?.data) rawSubs = classDetail.subjects.data;
                        else if (classDetail.data?.attributes?.subjects?.data) rawSubs = classDetail.data.attributes.subjects.data;
                    }

                    classSubs = rawSubs.map((s: any) => ({
                        id: String(s.id),
                        strapiId: s.strapiId,
                        code: s.code,
                        name: s.name,
                        hasTheory: s.has_theory !== false,
                        hasPractice: s.has_practice === true
                    }));
                } catch (e) {
                    console.warn("Could not fetch class subjects", e);
                }
            }
            // Fallback to all subjects if none found? No, better show empty or all
            if (classSubs.length === 0) classSubs = subjects; // Fallback
            setDecisionSubjects(classSubs);

            // 2. Process Students
            const mappedStudents: Student[] = rawStudents.map((s: any) => ({
                id: s.id,
                studentCode: s.student_code || s.code || s.studentCode || '',
                fullName: s.full_name || s.name || s.fullName || '',
                dob: s.dob || s.date_of_birth || '',
                gender: s.gender || '',
                photo: s.photo || s.attributes?.photo || '' // Check both levels just in case
            })).sort((a, b) => {
                const nameA = a.fullName.split(' ').pop() || '';
                const nameB = b.fullName.split(' ').pop() || '';
                return nameA.localeCompare(nameB);
            });
            setDecisionStudents(mappedStudents);

            // 3. Fetch Existing Approval Record
            await loadExistingApproval(decision.documentId || decision.id);

            setSelectedSubjectId(null);
            setViewMode('approval_detail');
        } catch (e) {
            console.error("Error opening decision:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadExistingApproval = async (decisionId: string) => {
        setApprovals({});
        setCurrentApprovalId(null);

        try {
            // Filter by decision documentId
            const query = `${COLLECTIONS.EXAM_APPROVALS}?filters[decision][documentId][$eq]=${decisionId}`;
            const res = await fetchCategory(query);

            if (res && res.length > 0) {
                const record = res[0];
                setCurrentApprovalId(record.documentId || record.id);
                if (record.approvals) {
                    // Backward compatibility: Convert array to object if needed
                    const rawApprovals = record.approvals;
                    const normalized: Record<string, Record<string, ApprovalRecord>> = {};

                    Object.keys(rawApprovals).forEach(subId => {
                        const val = rawApprovals[subId];
                        normalized[subId] = {};
                        if (Array.isArray(val)) {
                            // Legacy format: array of codes
                            val.forEach((code: string) => {
                                normalized[subId][code] = { practicePass: true, theoryApproved: true };
                            });
                        } else {
                            // New format: object
                            normalized[subId] = val;
                        }
                    });
                    setApprovals(normalized);
                }
            }
        } catch (e) {
            console.warn("Failed to load existing approvals", e);
        }
    };

    // Handlers
    const handleSubjectSelect = (subId: string) => {
        setSelectedSubjectId(subId);
    };

    const handleToggleStudent = (code: string) => {
        if (!selectedSubjectId) return;
        const currentSub = decisionSubjects.find(s => s.id === selectedSubjectId);
        const subKey = String(currentSub?.strapiId || selectedSubjectId);
        const subApprovals = { ...(approvals[subKey] || {}) };

        let record = subApprovals[code] || { practicePass: !currentSub?.hasPractice, theoryApproved: false };

        // Toggle logic: If they are approved, unapprove them.
        // If they are not approved, check if they passed practice (if subject has practice)
        if (record.theoryApproved) {
            record.theoryApproved = false;
        } else {
            // Must pass practice to be approved for theory
            if (currentSub?.hasPractice && !record.practicePass) {
                alert("Học viên chưa đạt thực hành, không thể duyệt thi lý thuyết.");
                return;
            }
            record.theoryApproved = true;
        }

        const nextApprovals = { ...approvals };
        nextApprovals[subKey] = { ...subApprovals, [code]: record };
        setApprovals(nextApprovals);
    };

    const handleTogglePractice = (code: string, pass: boolean) => {
        if (!selectedSubjectId) return;
        const currentSub = decisionSubjects.find(s => s.id === selectedSubjectId);
        const subKey = String(currentSub?.strapiId || selectedSubjectId);
        const subApprovals = { ...(approvals[subKey] || {}) };
        let record = subApprovals[code] || { practicePass: false, theoryApproved: false };

        record.practicePass = pass;
        // If they fail practice, they must be unapproved for theory
        if (!pass) {
            record.theoryApproved = false;
        }

        const nextApprovals = { ...approvals };
        nextApprovals[subKey] = { ...subApprovals, [code]: record };
        setApprovals(nextApprovals);
    };

    const handleToggleAll = () => {
        if (!selectedSubjectId) return;
        const currentSub = decisionSubjects.find(s => s.id === selectedSubjectId);
        const subKey = String(currentSub?.strapiId || selectedSubjectId);

        const subApprovals = { ...(approvals[subKey] || {}) };
        const allAlreadyApproved = decisionStudents.every(s => subApprovals[s.studentCode]?.theoryApproved);

        const nextSubApprovals = { ...subApprovals };
        decisionStudents.forEach(s => {
            if (allAlreadyApproved) {
                if (nextSubApprovals[s.studentCode]) {
                    nextSubApprovals[s.studentCode].theoryApproved = false;
                }
            } else {
                let record = nextSubApprovals[s.studentCode] || { practicePass: !currentSub?.hasPractice, theoryApproved: false };
                // Only approve if they passed practice or subject has no practice
                if (!currentSub?.hasPractice || record.practicePass) {
                    record.theoryApproved = true;
                    nextSubApprovals[s.studentCode] = record;
                }
            }
        });

        const nextApprovals = { ...approvals };
        nextApprovals[subKey] = nextSubApprovals;
        setApprovals(nextApprovals);
    };

    const handleSaveApproval = async () => {
        if (!selectedDecision || !selectedSubjectId) return;

        // Prepare Payload
        const payload = {
            decision: selectedDecision.strapiId || selectedDecision.id,
            approvals: approvals
        };

        try {
            if (currentApprovalId) {
                await updateCategory(COLLECTIONS.EXAM_APPROVALS, currentApprovalId, payload);
            } else {
                const newRecord = await createCategory(COLLECTIONS.EXAM_APPROVALS, payload);
                if (newRecord) setCurrentApprovalId(newRecord.documentId || newRecord.id);
            }

            const subName = decisionSubjects.find(s => s.id === selectedSubjectId)?.name;
            alert(`Đã lưu danh sách duyệt thi cho môn: ${subName}`);
        } catch (e) {
            console.error("Save failed", e);
            alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
        }
    };

    // Helper
    const formatDateVN = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const handlePrintList = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const currentSub = decisionSubjects.find(s => String(s.id) === String(selectedSubjectId));
        const currentSubjectName = currentSub?.name || '';
        const subKey = String(currentSub?.strapiId || selectedSubjectId);
        const subApprovals = approvals[subKey] || {};
        const approvedList = decisionStudents.filter(s => subApprovals[s.studentCode]?.theoryApproved);

        console.log('Approved List for Print:', approvedList);
        approvedList.forEach(s => console.log(`Student ${s.studentCode} photo:`, s.photo));

        const getPhotoUrl = (url: string) => {
            if (!url) return '';
            if (url.startsWith('http') || url.startsWith('data:')) return url;
            return `${API_BASE_URL}${url}`;
        };

        const html = `
            <html>
            <head>
                <title>Danh sách thi - ${selectedDecision?.className}</title>
                <style>
                    body { font-family: 'Times New Roman'; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid black; padding: 5px; text-align: left; vertical-align: middle; }
                    th { text-align: center; background: #f0f0f0; }
                    .center { text-align: center; }
                    h1, h2, h3 { text-align: center; margin: 10px 0; }
                    .photo-cell { text-align: center; padding: 5px; }
                    .photo-img { width: 80px; height: 100px; object-fit: cover; border: 1px solid #ccc; display: inline-block; }
                </style>
            </head>
            <body>
                <h1>DANH SÁCH DỰ THI</h1>
                <h2>Lớp: ${selectedDecision?.className} - Khóa: ${selectedDecision?.trainingCourse || ''}</h2>
                <h3>Môn: ${currentSubjectName}</h3>
                <table>
                    <thead>
                        <tr>
                            <th width="40">STT</th>
                            <th width="100">Ảnh</th>
                            <th>Họ và Tên</th>
                            <th width="100">Ngày sinh</th>
                            <th width="140">CCCD</th>
                            <th width="1" style="white-space: nowrap;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${approvedList.map((s, idx) => `
                            <tr>
                                <td class="center">${idx + 1}</td>
                                <td class="photo-cell">
                                    ${s.photo ? `<img src="${getPhotoUrl(s.photo)}" class="photo-img" />` : ''}
                                </td>
                                <td style="text-transform: uppercase; font-size: 1.1em;"><b>${s.fullName}</b></td>
                                <td class="center">${formatDateVN(s.dob)}</td>
                                <td class="center">${s.studentCode}</td>
                                <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>window.print();</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintScoreSheet = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const currentSub = decisionSubjects.find(s => String(s.id) === String(selectedSubjectId));
        const currentSubjectName = currentSub?.name || '';
        const hasPractice = currentSub?.hasPractice === true;
        const subKey = String(currentSub?.strapiId || selectedSubjectId);
        const subApprovals = approvals[subKey] || {};
        const approvedList = decisionStudents.filter(s => subApprovals[s.studentCode]?.theoryApproved);

        const html = `
            <html>
            <head>
                <title>Kết quả thi - ${selectedDecision?.className}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 30px; }
                    .header-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .header-left, .header-right { text-align: center; width: 48%; }
                    .header-left p, .header-right p { margin: 2px 0; }
                    .bold { font-weight: bold; }
                    .uppercase { text-transform: uppercase; }
                    
                    h1 { text-align: center; font-size: 22px; margin: 20px 0 5px 0; text-transform: uppercase; }
                    .subtitle { text-align: center; font-style: italic; margin-bottom: 20px; }
                    
                    .info-section { margin-bottom: 15px; font-size: 14px; }
                    .info-row { margin: 5px 0; }
                    .proctor-row { display: flex; }
                    .proctor-label { width: 220px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                    th, td { border: 1px solid black; padding: 5px; text-align: center; vertical-align: middle; }
                    th { background: #fff; font-weight: bold; height: 40px; }
                    .text-left { text-align: left !important; padding-left: 8px; }
                    
                    .footer-container { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; align-items: flex-end; }
                    .footer-left { text-align: center; margin-left: 40px; }
                    .footer-right { text-align: center; margin-right: 40px; }
                    .footer-right p { margin: 5px 0; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-left">
                        <p class="uppercase">Trường Cao Đẳng Hàng Hải I</p>
                        <p class="bold uppercase">Trung Tâm Đào Tạo Phát Triển Nguồn Lực</p>
                    </div>
                    <div class="header-right">
                        <p class="bold uppercase">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</p>
                        <p class="bold">Độc lập - Tự do - Hạnh phúc</p>
                    </div>
                </div>

                <div class="info-section">
                    <h1>KẾT QUẢ THI HẾT MÔN</h1>
                    <p class="subtitle uppercase">Lớp: ${selectedDecision?.className} - Khóa: ${selectedDecision?.trainingCourse || '...'}</p>
                    
                    <div style="margin-top: 20px; padding-left: 20px;">
                        <div class="info-row">Ngày thi kiểm tra: ........................................................................................</div>
                        <div class="info-row">Môn học: <span class="bold">${currentSubjectName}</span></div>
                        <div class="proctor-row info-row">
                            <div class="proctor-label">Họ và tên giáo viên coi thi:</div>
                            <div>
                                <div>1: ........................................................................................</div>
                                <div style="margin-top: 5px;">2: ........................................................................................</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th rowspan="2" width="40">STT</th>
                            <th rowspan="2">Họ và Tên</th>
                            <th rowspan="2" width="90">Ngày sinh</th>
                            <th rowspan="2" width="100">CCCD</th>
                            ${hasPractice
                ? `<th colspan="2">Điểm thi</th>`
                : `<th rowspan="2" width="80">Điểm thi</th>`
            }
                            <th rowspan="2" width="80">Số phiếu</th>
                            <th rowspan="2" width="80">Chữ ký HV</th>
                            <th rowspan="2" width="80">Ghi chú</th>
                        </tr>
                        <tr>
                            ${hasPractice ? `
                                <th width="60">Lý thuyết</th>
                                <th width="60">Thực hành</th>
                            ` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${approvedList.map((s, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td class="text-left" style="text-transform: uppercase;"><b>${s.fullName}</b></td>
                                <td>${formatDateVN(s.dob)}</td>
                                <td>${s.studentCode}</td>
                                <td></td>
                                ${hasPractice ? '<td></td>' : ''}
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer-container">
                    <div class="footer-left">
                        <p class="bold uppercase">Trung Tâm Đào Tạo Phát Triển Nguồn Lực</p>
                    </div>
                    <div class="footer-right">
                        <p><i>Ngày ...... tháng ...... năm 20......</i></p>
                        <p class="bold uppercase">Giáo Viên Coi Chấm Thi</p>
                    </div>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };


    // RENDERERS

    const renderDecisionList = () => (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                        <ClipboardCheck size={28} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Duyệt thi</h1>
                        <p className="text-slate-500">Chọn Quyết định mở lớp để duyệt danh sách thi</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 relative">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm theo số quyết định, tên lớp..."
                    className="pl-10 pr-4 py-3 w-full bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500">Đang tải dữ liệu...</div>
            ) : filteredDecisions.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed rounded-xl">
                    <AlertCircle className="mx-auto mb-2 text-slate-400" size={32} />
                    <p className="text-slate-500">Không tìm thấy quyết định mở lớp nào.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDecisions.map(d => (
                        <div key={d.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex flex-col h-full" onClick={() => handleDecisionSelect(d)}>
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <School size={24} />
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wider bg-slate-100 text-slate-600`}>
                                        {d.classCode}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 min-h-[56px]">{d.className}</h3>

                                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <FileText size={14} className="text-slate-400" />
                                        <span className="font-medium text-slate-700">QĐ: {d.number}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span>Ngày ký: {d.signedDate ? new Date(d.signedDate).toLocaleDateString('vi-VN') : '--'}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <GraduationCap size={14} className="text-slate-400" />
                                        <span>Khóa: {d.trainingCourse || '---'}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <Users size={14} className="text-slate-400" />
                                        <span>Học viên: {d.studentCount}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0">
                                <span className="text-xs font-bold text-blue-600 group-hover:underline">Duyệt thi lớp này</span>
                                <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderApprovalDetail = () => {
        if (!selectedDecision) return null;

        return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-300">
                    {/* Header */}
                    <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-slate-700 rounded-lg">
                                <School size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{selectedDecision.className}</h2>
                                <p className="text-sm text-slate-300 flex items-center gap-2">
                                    <span className="font-mono bg-slate-600 px-1 rounded text-xs">{selectedDecision.number}</span>
                                    <span className="mx-1">•</span>
                                    <Users size={14} />
                                    {decisionStudents.length} học viên
                                    <span className="mx-1">•</span>
                                    <BookOpen size={14} />
                                    {decisionSubjects.length} môn học
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handlePrintList} disabled={!selectedSubjectId || !Object.values(approvals[selectedSubjectId || ''] || {}).some(a => a.theoryApproved)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg border border-slate-600 flex items-center gap-2 disabled:opacity-50 transition-colors">
                                <Printer size={18} /> In danh sách
                            </button>
                            <button onClick={handlePrintScoreSheet} disabled={!selectedSubjectId || !Object.values(approvals[selectedSubjectId || ''] || {}).some(a => a.theoryApproved)} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg border border-orange-600 flex items-center gap-2 disabled:opacity-50 transition-colors">
                                <FileSpreadsheet size={18} /> Phiếu điểm
                            </button>
                            <button onClick={handleSaveApproval} disabled={!selectedSubjectId} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/50 transition-colors">
                                <CheckCircle2 size={18} /> Lưu duyệt thi ({
                                    (() => {
                                        const sub = decisionSubjects.find(s => s.id === selectedSubjectId);
                                        const subKey = String(sub?.strapiId || selectedSubjectId);
                                        return Object.values(approvals[subKey] || {}).filter(a => a.theoryApproved).length;
                                    })()
                                })
                            </button>
                            <div className="w-px h-8 bg-slate-700 mx-2"></div>
                            <button onClick={() => setViewMode('decision_list')} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white" title="Đóng">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex">
                        {/* Sidebar: Subjects */}
                        <div className="w-1/4 bg-slate-50 border-r border-slate-200 overflow-y-auto flex flex-col">
                            <div className="p-4 border-b border-slate-200 bg-white">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <Layout size={18} /> Môn học / Học phần
                                </h3>
                            </div>
                            <div className="p-3 space-y-2">
                                {decisionSubjects.map(sub => {
                                    const subKey = String(sub.strapiId || sub.id);
                                    const subApprovals = approvals[subKey] || {};
                                    const count = Object.values(subApprovals).filter(a => a.theoryApproved).length;
                                    const isSelected = String(selectedSubjectId) === String(sub.id);
                                    return (
                                        <div
                                            key={sub.id}
                                            onClick={() => handleSubjectSelect(sub.id)}
                                            className={`p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-md' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}
                                        >
                                            <div className="font-bold text-slate-800 text-sm mb-1">{sub.name}</div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sub.code}</span>
                                                {count > 0 && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> {count} đã duyệt
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {decisionSubjects.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 italic text-sm">
                                        Không tìm thấy môn học nào.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main: Student List */}
                        <div className="flex-1 bg-white overflow-y-auto p-0 relative">
                            {!selectedSubjectId ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <BookOpen size={40} className="text-slate-300" />
                                    </div>
                                    <p className="text-lg font-medium text-slate-600">Vui lòng chọn môn học bên trái</p>
                                    <p className="text-sm">Chọn môn học để hiển thị danh sách duyệt thi</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                                        <div>
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                                <BookOpen size={20} className="text-blue-600" />
                                                {decisionSubjects.find(s => s.id === selectedSubjectId)?.name}
                                            </h3>
                                        </div>
                                        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold border border-blue-100">
                                            Đã duyệt: {
                                                (() => {
                                                    const sub = decisionSubjects.find(s => s.id === selectedSubjectId);
                                                    const subKey = String(sub?.strapiId || selectedSubjectId);
                                                    return Object.values(approvals[subKey] || {}).filter(a => a.theoryApproved).length;
                                                })()
                                            }
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200 sticky top-0 z-0">
                                                <tr>
                                                    <th className="px-6 py-4 w-10 text-center bg-slate-50">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            checked={decisionStudents.length > 0 && decisionStudents.every(s => {
                                                                const sub = decisionSubjects.find(sub => sub.id === selectedSubjectId);
                                                                const subKey = String(sub?.strapiId || selectedSubjectId);
                                                                return (approvals[subKey] || {})[s.studentCode]?.theoryApproved;
                                                            })}
                                                            onChange={handleToggleAll}
                                                        />
                                                    </th>
                                                    <th className="px-4 py-4 w-16 text-center bg-slate-50">STT</th>
                                                    <th className="px-6 py-4 bg-slate-50">Mã HV</th>
                                                    <th className="px-6 py-4 bg-slate-50">Họ và tên</th>
                                                    <th className="px-6 py-4 text-center bg-slate-50">Ngày sinh</th>
                                                    <th className="px-6 py-4 text-center bg-slate-50">Giới tính</th>
                                                    {decisionSubjects.find(s => s.id === selectedSubjectId)?.hasPractice && (
                                                        <th className="px-6 py-4 text-center bg-slate-50 text-orange-600">Thực hành</th>
                                                    )}
                                                    <th className="px-6 py-4 text-center bg-slate-50">Duyệt thi LT</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {decisionStudents.map((s, idx) => {
                                                    const sub = decisionSubjects.find(sub => sub.id === selectedSubjectId);
                                                    const subKey = String(sub?.strapiId || selectedSubjectId);
                                                    const record = (approvals[subKey] || {})[s.studentCode] || { practicePass: !sub?.hasPractice, theoryApproved: false };
                                                    const isApproved = record.theoryApproved;

                                                    return (
                                                        <tr key={s.id || idx} className={`hover:bg-blue-50 transition-colors cursor-pointer ${isApproved ? 'bg-blue-50/60' : ''}`} onClick={() => handleToggleStudent(s.studentCode)}>
                                                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                    checked={isApproved}
                                                                    onChange={() => handleToggleStudent(s.studentCode)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                                                            <td className="px-6 py-4 font-mono text-blue-600 font-bold">{s.studentCode}</td>
                                                            <td className="px-6 py-4 font-bold text-slate-700 uppercase">{s.fullName}</td>
                                                            <td className="px-6 py-4 text-center text-slate-600">{formatDateVN(s.dob)}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.gender === 'Nam' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                                                    {s.gender || '--'}
                                                                </span>
                                                            </td>
                                                            {sub?.hasPractice && (
                                                                <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={() => handleTogglePractice(s.studentCode, true)}
                                                                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${record.practicePass ? 'bg-green-600 text-white border-green-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-green-300'}`}
                                                                        >
                                                                            Đạt
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleTogglePractice(s.studentCode, false)}
                                                                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${!record.practicePass ? 'bg-red-600 text-white border-red-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-red-300'}`}
                                                                        >
                                                                            K.Đạt
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4 text-center">
                                                                {isApproved ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 shadow-sm">
                                                                        <CheckCircle2 size={12} /> Duyệt thi
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs font-medium">Chưa duyệt</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {decisionStudents.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <Users size={32} className="text-slate-300" />
                                                                <p>Lớp này chưa có danh sách học viên.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return viewMode === 'decision_list' ? renderDecisionList() : renderApprovalDetail();
};

export default ExamApprovalView;
