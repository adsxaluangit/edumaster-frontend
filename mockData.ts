import { Student, Teacher, Subject, ClassRoom } from './types';

// Static Data Constants

export const MOCK_NATIONS = [
  { id: 'n1', code: 'VN', name: 'Việt Nam', abbr: 'VN', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'n2', code: 'LAO', name: 'Lào', abbr: 'LAO', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'n3', code: 'KH', name: 'Campuchia', abbr: 'KH', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'n4', code: 'CN', name: 'Trung Quốc', abbr: 'CN', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'n5', code: 'JP', name: 'Nhật Bản', abbr: 'JP', status: 'active' as const, createdAt: '01/01/2025' },
];

export const MOCK_SUPPLIERS = [
  { id: 's1', code: 'DA', name: 'Nhà A', taxId: '', phone: '', email: '', address: 'Khu vực Trung tâm', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 's2', code: 'DB', name: 'Nhà B', taxId: '', phone: '', email: '', address: 'Khu vực Phía Tây', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 's3', code: 'DC', name: 'Nhà C', taxId: '', phone: '', email: '', address: 'Khu vực Phía Đông', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 's4', code: 'DD', name: 'Nhà D', taxId: '', phone: '', email: '', address: 'Khu xưởng thực hành', status: 'active' as const, createdAt: '01/01/2025' },
];

export const MOCK_CLASSROOMS = [
  { id: 'cr1', code: 'P101', name: 'Phòng Lý thuyết 101', capacity: 40, building: 'Nhà A', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr2', code: 'P102', name: 'Phòng Lý thuyết 102', capacity: 40, building: 'Nhà A', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr3', code: 'P201', name: 'Phòng Máy tính 01', capacity: 30, building: 'Nhà B', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr4', code: 'P202', name: 'Phòng Máy tính 02', capacity: 30, building: 'Nhà B', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr5', code: 'X1', name: 'Xưởng Thực hành Điện', capacity: 20, building: 'Nhà D', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr6', code: 'X2', name: 'Xưởng Thực hành Cơ khí', capacity: 20, building: 'Nhà D', status: 'active' as const, createdAt: '01/01/2025' },
  { id: 'cr7', code: 'H1', name: 'Hội trường lớn', capacity: 200, building: 'Nhà C', status: 'active' as const, createdAt: '01/01/2025' },
];

export const MOCK_SUBJECTS: Subject[] = [
  { id: 'sub1', code: 'MH001', name: 'An toàn vệ sinh lao động', sessions: 5, totalHours: 15, theoryHours: 5, practiceHours: 10, exerciseHours: 0, examHours: 2, notes: 'Môn bắt buộc', createdAt: '01/01/2025' },
  { id: 'sub2', code: 'MH002', name: 'Tin học cơ sở', sessions: 15, totalHours: 45, theoryHours: 15, practiceHours: 30, exerciseHours: 0, examHours: 2, notes: '', createdAt: '01/01/2025' },
  { id: 'sub3', code: 'MH003', name: 'Tiếng Anh chuyên ngành', sessions: 20, totalHours: 60, theoryHours: 30, practiceHours: 30, exerciseHours: 0, examHours: 2, notes: '', createdAt: '01/01/2025' },
  { id: 'sub4', code: 'MH004', name: 'Kỹ thuật điện cơ bản', sessions: 30, totalHours: 90, theoryHours: 30, practiceHours: 60, exerciseHours: 0, examHours: 4, notes: '', createdAt: '01/01/2025' },
  { id: 'sub5', code: 'MH005', name: 'Vẽ kỹ thuật', sessions: 15, totalHours: 45, theoryHours: 15, practiceHours: 30, exerciseHours: 0, examHours: 2, notes: '', createdAt: '01/01/2025' },
  { id: 'sub6', code: 'MH006', name: 'Kỹ năng giao tiếp', sessions: 5, totalHours: 15, theoryHours: 5, practiceHours: 10, exerciseHours: 0, examHours: 1, notes: '', createdAt: '01/01/2025' },
  { id: 'sub7', code: 'MH007', name: 'Pháp luật đại cương', sessions: 10, totalHours: 30, theoryHours: 30, practiceHours: 0, exerciseHours: 0, examHours: 2, notes: '', createdAt: '01/01/2025' },
  { id: 'sub8', code: 'MH008', name: 'Giáo dục thể chất', sessions: 10, totalHours: 30, theoryHours: 0, practiceHours: 30, exerciseHours: 0, examHours: 0, notes: '', createdAt: '01/01/2025' },
  { id: 'sub9', code: 'SQAN01', name: 'Sỹ quan an ninh tàu biển', sessions: 5, totalHours: 15, theoryHours: 5, practiceHours: 10, exerciseHours: 0, examHours: 1, notes: 'Môn chuyên ngành', createdAt: '01/01/2025' },
];

export const MOCK_TEACHERS: Teacher[] = [
  { id: 't1', code: 'GV001', name: 'Nguyễn Văn An', specialization: 'Kỹ thuật Điện', phone: '0912345678', email: 'an.nv@edumaster.vn', subjectIds: ['sub1', 'sub4'] },
  { id: 't2', code: 'GV002', name: 'Trần Thị Bình', specialization: 'Công nghệ thông tin', phone: '0987654321', email: 'binh.tt@edumaster.vn', subjectIds: ['sub2'] },
  { id: 't3', code: 'GV003', name: 'Lê Hoàng Cường', specialization: 'Ngoại ngữ', phone: '0901122334', email: 'cuong.lh@edumaster.vn', subjectIds: ['sub3'] },
  { id: 't4', code: 'GV004', name: 'Phạm Minh Dung', specialization: 'Cơ khí', phone: '0977889900', email: 'dung.pm@edumaster.vn', subjectIds: ['sub5'] },
  { id: 't5', code: 'GV005', name: 'Hoàng Văn Em', specialization: 'Kỹ năng', phone: '0933445566', email: 'em.hv@edumaster.vn', subjectIds: ['sub6', 'sub7'] },
];

export const MOCK_CLASSES: ClassRoom[] = [
  { id: 'cls1', code: 'K25-CNTT', name: 'Lớp Công nghệ thông tin K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub2', 'sub3', 'sub6'], startDate: '15/09/2024', endDate: '15/06/2025', studentCount: 0, createdAt: '01/01/2025' },
  { id: 'cls2', code: 'K25-DIEN', name: 'Lớp Điện Công nghiệp K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub1', 'sub4', 'sub5'], startDate: '15/09/2024', endDate: '15/06/2025', studentCount: 0, createdAt: '01/01/2025' },
  { id: 'cls3', code: 'K25-CK', name: 'Lớp Cơ khí K25', notes: 'Lớp chính quy', status: 'OPENING', subjectIds: ['sub1', 'sub5'], startDate: '15/09/2024', endDate: '15/06/2025', studentCount: 0, createdAt: '01/01/2025' },
  { id: 'cls4', code: 'K24-CNTT', name: 'Lớp Công nghệ thông tin K24', notes: 'Năm cuối', status: 'OPENING', subjectIds: ['sub2', 'sub3'], startDate: '05/09/2023', endDate: '30/05/2026', studentCount: 0, createdAt: '01/01/2025' },
  { id: 'cls5', code: 'SQAN-K1', name: 'SỸ QUAN AN NINH TÀU BIỂN', notes: 'Lớp ngắn hạn', status: 'OPENING', subjectIds: ['sub9', 'sub1'], startDate: '01/02/2025', endDate: '01/05/2025', studentCount: 0, createdAt: '01/02/2025' },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 'std1', stt: 1, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', cardNumber: 'SV001', studentCode: '25001', idNumber: '001099000001', firstName: 'NAM', lastName: 'NGUYỄN VĂN', fullName: 'NGUYỄN VĂN NAM', gender: 'Nam', dob: '15/05/2005', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Hoàn Kiếm, Hà Nội', score: '', photo: null },
  { id: 'std2', stt: 2, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', cardNumber: 'SV002', studentCode: '25002', idNumber: '001099000002', firstName: 'HƯƠNG', lastName: 'TRẦN THỊ', fullName: 'TRẦN THỊ HƯƠNG', gender: 'Nữ', dob: '20/10/2005', pob: 'Hải Phòng', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Lê Chân, Hải Phòng', score: '', photo: null },
  { id: 'std3', stt: 3, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', cardNumber: 'SV003', studentCode: '25003', idNumber: '001099000003', firstName: 'TUẤN', lastName: 'LÊ MINH', fullName: 'LÊ MINH TUẤN', gender: 'Nam', dob: '01/01/2005', pob: 'Nam Định', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Soft', address: 'TP Nam Định', score: '', photo: null },
  { id: 'std4', stt: 4, group: 'Lớp Điện Công nghiệp K25', classCode: 'K25-DIEN', className: 'Lớp Điện Công nghiệp K25', cardNumber: 'SV004', studentCode: '25004', idNumber: '001099000004', firstName: 'HÙNG', lastName: 'PHẠM VĂN', fullName: 'PHẠM VĂN HÙNG', gender: 'Nam', dob: '12/12/2004', pob: 'Nghệ An', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Điện lực', address: 'Vinh, Nghệ An', score: '', photo: null },
  { id: 'std5', stt: 5, group: 'Lớp Điện Công nghiệp K25', classCode: 'K25-DIEN', className: 'Lớp Điện Công nghiệp K25', cardNumber: 'SV005', studentCode: '25005', idNumber: '001099000005', firstName: 'LAN', lastName: 'HOÀNG THỊ', fullName: 'HOÀNG THỊ LAN', gender: 'Nữ', dob: '08/03/2005', pob: 'Thanh Hóa', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Điện lực', address: 'TP Thanh Hóa', score: '', photo: null },
  { id: 'std6', stt: 6, group: 'Lớp Cơ khí K25', classCode: 'K25-CK', className: 'Lớp Cơ khí K25', cardNumber: 'SV006', studentCode: '25006', idNumber: '001099000006', firstName: 'DŨNG', lastName: 'VŨ TIẾN', fullName: 'VŨ TIẾN DŨNG', gender: 'Nam', dob: '02/09/2004', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Cơ khí A', address: 'Cầu Giấy, Hà Nội', score: '', photo: null },
  { id: 'std7', stt: 7, group: 'Lớp Cơ khí K25', classCode: 'K25-CK', className: 'Lớp Cơ khí K25', cardNumber: 'SV007', studentCode: '25007', idNumber: '001099000007', firstName: 'LONG', lastName: 'ĐẶNG VĂN', fullName: 'ĐẶNG VĂN LONG', gender: 'Nam', dob: '15/08/2004', pob: 'Bắc Ninh', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Cơ khí B', address: 'Từ Sơn, Bắc Ninh', score: '', photo: null },
  {
    id: 'std8', stt: 8, group: 'Lớp Công nghệ thông tin K24', classCode: 'K24-CNTT', className: 'Lớp Công nghệ thông tin K24', cardNumber: 'SV008', studentCode: '24001', idNumber: '001099000008', firstName: 'TRANG', lastName: 'NGUYỄN THU', fullName: 'NGUYỄN THU TRANG', gender: 'Nữ', dob: '20/11/2003', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'FPT', address: 'Ba Đình, Hà Nội', score: '', photo: null,
    documents: [
      { id: 'doc1', name: 'Sơ yếu lý lịch.pdf', url: '#', date: '01/01/2025', type: 'SYLL' },
      { id: 'doc2', name: 'Giấy khám sức khỏe.pdf', url: '#', date: '01/01/2025', type: 'GKSK' }
    ]
  },
  {
    id: 'std9', stt: 9, group: 'Lớp Công nghệ thông tin K24', classCode: 'K24-CNTT', className: 'Lớp Công nghệ thông tin K24', cardNumber: 'SV009', studentCode: '24002', idNumber: '001099000009', firstName: 'KHOA', lastName: 'LÊ ĐĂNG', fullName: 'LÊ ĐĂNG KHOA', gender: 'Nam', dob: '05/05/2003', pob: 'Đà Nẵng', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'FPT', address: 'Hải Châu, Đà Nẵng', score: '', photo: null,
    documents: [
      { id: 'doc3', name: 'Đơn xin học.docx', url: '#', date: '01/01/2025', type: 'DXH' }
    ]
  },
  { id: 'std10', stt: 10, group: 'Lớp Công nghệ thông tin K25', classCode: 'K25-CNTT', className: 'Lớp Công nghệ thông tin K25', cardNumber: 'SV010', studentCode: '25008', idNumber: '001099000010', firstName: 'QUÂN', lastName: 'BÙI ANH', fullName: 'BÙI ANH QUÂN', gender: 'Nam', dob: '10/10/2005', pob: 'Hà Nội', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Công ty Tech', address: 'Long Biên, Hà Nội', score: '', photo: null },
  { id: 'std11', stt: 11, group: 'SỸ QUAN AN NINH TÀU BIỂN', classCode: 'SQAN-K1', className: 'SỸ QUAN AN NINH TÀU BIỂN', cardNumber: 'SQ001', studentCode: 'SQ001', idNumber: '031090001234', firstName: 'MINH', lastName: 'LÊ VĂN', fullName: 'LÊ VĂN MINH', gender: 'Nam', dob: '10/10/1990', pob: 'Hải Phòng', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Cảng Hải Phòng', address: 'Ngô Quyền, Hải Phòng', score: '', photo: null },
  { id: 'std12', stt: 12, group: 'SỸ QUAN AN NINH TÀU BIỂN', classCode: 'SQAN-K1', className: 'SỸ QUAN AN NINH TÀU BIỂN', cardNumber: 'SQ002', studentCode: 'SQ002', idNumber: '031090005678', firstName: 'HÙNG', lastName: 'TRẦN VĂN', fullName: 'TRẦN VĂN HÙNG', gender: 'Nam', dob: '15/05/1992', pob: 'Quảng Ninh', ethnicity: 'Kinh', nationality: 'Việt Nam', company: 'Vận tải biển', address: 'Hạ Long, Quảng Ninh', score: '', photo: null },
];

export const INITIAL_DECISIONS = [
  {
    id: 'd1',
    number: '123/QĐ-CĐHH',
    type: 'OPENING',
    className: 'Lớp Công nghệ thông tin K25',
    trainingCourse: 'K25',
    signedDate: '2024-09-01',
    students: []
  }
];
