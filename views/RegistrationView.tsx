
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Upload, Save, CheckCircle, LogIn, Lock, User, ChevronDown } from 'lucide-react';
import { Student } from '../types';
import { MOCK_STUDENTS, MOCK_NATIONS, MOCK_CLASSES } from '../mockData';
import { fetchCategory, createCategory, COLLECTIONS } from '../services/api';

interface RegistrationViewProps {
    onLoginSuccess: () => void;
    initialData?: any;
}

const RegistrationView: React.FC<RegistrationViewProps> = ({ onLoginSuccess, initialData }) => {
    const [isSuccess, setIsSuccess] = useState(false);
    const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
    const [isCameraLive, setIsCameraLive] = useState(false);
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [formData, setFormData] = useState({
        fullName: '',
        dob: '',
        pob: '',
        ethnicity: 'Kinh',
        phone: '',
        idNumber: '',
        gender: 'Nam',
        address: '',
        email: '',
        parentName: '',
        parentPhone: '',
        classCode: '' // Add classCode to state
    });

    // Login State
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Pre-fill form if initialData is provided
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                fullName: initialData.fullName || '',
                dob: initialData.dob || '',
                pob: initialData.pob || '',
                idNumber: initialData.idNumber || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                gender: initialData.gender || 'Nam',
            }));
            if (initialData.photo) {
                setStudentPhoto(initialData.photo);
            }
        }
    }, [initialData]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');

        if (!username || !password) {
            setLoginError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
            return;
        }

        // Mock Login Logic
        // In a real app, this would call an API
        console.log('Logging in with:', username);

        // Simple success simulation
        onLoginSuccess(); // Navigate to Dashboard
        setShowLoginModal(false);
    };

    // Load available classes from API
    useEffect(() => {
        const loadClasses = async () => {
            try {
                const classes = await fetchCategory(COLLECTIONS.CLASSES);
                if (classes && classes.length > 0) {
                    setAvailableClasses(classes);
                } else {
                    // Fallback to mock if API returns nothing (or remove fallback if strict)
                    setAvailableClasses(MOCK_CLASSES);
                }
            } catch (error) {
                console.error("Failed to load classes", error);
                setAvailableClasses(MOCK_CLASSES);
            }
        };
        loadClasses();
    }, []);

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
                canvas.width = 600;
                canvas.height = 800;
                const video = videoRef.current;
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const targetRatio = 3 / 4;
                let sX = 0, sY = 0, sW = videoWidth, sH = videoHeight;

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone || !formData.idNumber || !formData.pob) {
            alert('Vui lòng điền đầy đủ các trường bắt buộc (Họ tên, SĐT, CCCD, Nơi sinh)!');
            return;
        }
        
        if (formData.idNumber.length !== 12) {
            alert('Vui lòng nhập chính xác 12 số CCCD/CMND!');
            return;
        }

        const nameParts = formData.fullName.trim().split(' ');
        const firstName = nameParts.length > 1 ? nameParts.pop() || '' : formData.fullName;
        const lastName = nameParts.length > 0 ? nameParts.join(' ') : '';

        // Find selected class
        const selectedClass = availableClasses.find(c => c.code === formData.classCode);

        // Payload matching Strapi schema (snake_case)
        const newStudentData = {
            stt: 0, // Backend or logic should handle this, setting 0 for now as 'pending'
            class_code: selectedClass ? selectedClass.code : 'PENDING',
            class_name: selectedClass ? selectedClass.name : 'Lớp chờ xếp lớp',

            // Relation: school_class
            school_class: selectedClass ? (selectedClass.strapiId || selectedClass.id) : null,

            student_code: formData.idNumber, // Use CCCD as Student Code
            id_number: formData.idNumber,
            card_number: '', // Can be filled later

            first_name: firstName.toUpperCase(),
            last_name: lastName.toUpperCase(),
            full_name: formData.fullName.toUpperCase(),

            gender: formData.gender,
            dob: formData.dob,
            pob: formData.pob,
            ethnicity: formData.ethnicity,
            nationality: 'Việt Nam',
            phone: formData.phone,
            address: formData.address,

            photo: studentPhoto, // Base64 string

            is_approved: false // Default to unapproved/pending
        };

        try {
            await createCategory(COLLECTIONS.STUDENTS, newStudentData);
            setIsSuccess(true);
        } catch (error) {
            console.error("Failed to register student", error);
            alert("Đã có lỗi xảy ra khi gửi đăng ký. Vui lòng thử lại sau.");
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Đăng ký thành công!</h2>
                    <p className="text-slate-600 mb-8">
                        Hồ sơ của bạn đã được gửi thành công. Nhà trường sẽ liên hệ với bạn trong thời gian sớm nhất.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded hover:bg-slate-200 transition-colors"
                        >
                            Đăng ký mới
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 font-sans text-slate-700">
            {/* Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">E</div>
                        <span className="font-bold text-xl text-slate-800 tracking-tight">EduMaster<span className="text-blue-600">Pro</span></span>
                    </div>
                    <button onClick={() => setShowLoginModal(true)} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-2 px-3 py-1.5 border border-transparent hover:border-blue-100 rounded transition-all">
                        <LogIn size={16} /> Đăng nhập hệ thống
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 md:p-8">
                <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="bg-blue-600 p-6 text-white text-center">
                        <h1 className="text-2xl font-bold mb-2">Phiếu Đăng Ký Học</h1>
                        <p className="text-blue-100">Vui lòng điền đầy đủ thông tin bên dưới để hoàn tất thủ tục đăng ký</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Photo Upload Section */}
                            <div className="md:col-span-1 flex flex-col items-center">
                                <div className="w-full aspect-[3/4] max-w-[180px] bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-colors"
                                    onClick={isCameraLive ? undefined : startCamera}>

                                    {isCameraLive ? (
                                        <>
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 flex items-end justify-center pb-4 bg-gradient-to-t from-black/50 to-transparent">
                                                <button type="button" onClick={capturePhoto} className="p-3 bg-white text-blue-600 rounded-full shadow hover:scale-110 transition-transform"><Camera size={20} /></button>
                                            </div>
                                        </>
                                    ) : studentPhoto ? (
                                        <img src={studentPhoto} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-4">
                                            <Camera size={32} className="mx-auto text-slate-300 mb-2" />
                                            <span className="text-xs text-slate-400 font-bold">CHỤP ẢNH 3x4</span>
                                        </div>
                                    )}

                                    {!isCameraLive && (
                                        <div className="absolute bottom-2 right-2 flex gap-2">
                                            {studentPhoto && <button type="button" onClick={(e) => { e.stopPropagation(); setStudentPhoto(null); }} className="p-1.5 bg-white/80 rounded-full text-red-500 hover:bg-white"><X size={14} /></button>}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 w-full flex flex-col gap-2 max-w-[180px]">
                                    <button type="button" onClick={isCameraLive ? stopCamera : startCamera} className="w-full py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded border border-blue-200 hover:bg-blue-100 flex items-center justify-center gap-2">
                                        <Camera size={14} /> {isCameraLive ? 'Hủy chụp' : 'Chụp trực tiếp'}
                                    </button>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-white text-slate-600 text-xs font-bold rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2">
                                        <Upload size={14} /> Tải ảnh lên
                                    </button>
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
                                <canvas ref={canvasRef} className="hidden" />
                            </div>

                            {/* Form Fields */}
                            <div className="md:col-span-2 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Họ và tên thí sinh <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase font-bold"
                                        placeholder="NGUYỄN VĂN A"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Ngày sinh</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[0] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${e.target.value},${parts[1] || ''},${parts[2] || ''}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Ngày</option>
                                                {Array.from({ length: 31 }, (_, i) => {
                                                    const day = (i + 1).toString().padStart(2, '0');
                                                    return <option key={day} value={day}>{day}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                        
                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[1] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${parts[0] || ''},${e.target.value},${parts[2] || ''}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Tháng</option>
                                                {Array.from({ length: 12 }, (_, i) => {
                                                    const month = (i + 1).toString().padStart(2, '0');
                                                    return <option key={month} value={month}>Tháng {month}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <select
                                                value={formData.dob.split(',')[2] || ''}
                                                onChange={e => {
                                                    const parts = formData.dob.split(',');
                                                    setFormData({ ...formData, dob: `${parts[0] || ''},${parts[1] || ''},${e.target.value}` });
                                                }}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-medium text-slate-700 appearance-none transition-all shadow-sm hover:border-blue-400 cursor-pointer"
                                            >
                                                <option value="" disabled className="text-slate-400">Năm</option>
                                                {Array.from({ length: 100 }, (_, i) => {
                                                    const year = (new Date().getFullYear() - i).toString();
                                                    return <option key={year} value={year}>{year}</option>
                                                })}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Giới tính</label>
                                    <div className="flex gap-6 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="gender" value="Nam" checked={formData.gender === 'Nam'} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                            <span className="group-hover:text-blue-600 transition-colors">Nam</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" name="gender" value="Nữ" checked={formData.gender === 'Nữ'} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                                            <span className="group-hover:text-blue-600 transition-colors">Nữ</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">CMND/CCCD <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={12}
                                            value={formData.idNumber}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= 12) setFormData({ ...formData, idNumber: val });
                                            }}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Nhập 12 số CCCD"
                                        />
                                    </div>
                                </div>


                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nơi sinh (Tỉnh/TP) <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        value={formData.pob}
                                        onChange={e => setFormData({ ...formData, pob: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Chọn tỉnh/thành phố --</option>
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

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                                    <textarea
                                        rows={2}
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Đăng ký lớp học</label>
                                    <select
                                        value={formData.classCode}
                                        onChange={e => setFormData({ ...formData, classCode: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Chọn lớp muốn học --</option>
                                        {availableClasses.map(cls => (
                                            <option key={cls.id} value={cls.code}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all text-sm flex items-center gap-2"
                            >
                                <Save size={18} /> GỬI ĐĂNG KÝ
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center mt-8 text-slate-400 text-sm">
                    &copy; 2026 Cao đẳng Hàng hải và Đường thủy I All rights reserved.
                </div>
            </div>

            {/* Login Modal */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-blue-600 p-6 text-white text-center relative">
                            <button
                                onClick={() => setShowLoginModal(false)}
                                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                                <LogIn size={32} />
                            </div>
                            <h2 className="text-2xl font-bold">Đăng Nhập Hệ Thống</h2>
                            <p className="text-blue-100 text-sm mt-1">Vui lòng đăng nhập để truy cập quản trị</p>
                        </div>

                        <form onSubmit={handleLogin} className="p-8 space-y-6">
                            {loginError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                    {loginError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">Tên đăng nhập</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Nhập tên đăng nhập"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">Mật khẩu</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Nhập mật khẩu"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                >
                                    <LogIn size={20} /> ĐĂNG NHẬP
                                </button>
                            </div>

                            <div className="text-center">
                                <a href="#" className="text-sm text-slate-500 hover:text-blue-600 hover:underline">Quên mật khẩu?</a>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistrationView;
