
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import { User, UserRole, CategoryItem, Decision, ClassRoom, Student } from './types';
import Dashboard from './views/Dashboard';
import AdminView from './views/AdminView';
import CategoriesView from './views/CategoriesView';
import AssignmentsView from './views/AssignmentsView';
import DecisionsView from './views/DecisionsView';

import StudentsView from './views/StudentsView';
import RegistrationView from './views/RegistrationView';
import PrintTemplatesView from './views/PrintTemplatesView';
import ExamApprovalView from './views/ExamApprovalView';
import GradeEntryView from './views/GradeEntryView';
import LookupView from './views/LookupView';
import StatisticsView from './views/StatisticsView';

const MOCK_USER: User = {
  id: '1',
  name: 'Nguyễn Thành Dương',
  email: 'admin@edumaster.vn',
  role: UserRole.ADMIN
};

const App: React.FC = () => {
  const [activePath, setActivePath] = useState('public-register');
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USER);
  const [prefilledStudent, setPrefilledStudent] = useState<any>(null);

  // One-time Cleanup of obsolete LocalStorage data
  useEffect(() => {
    const isCleaned = localStorage.getItem('edumaster_v2_cleaned');
    if (!isCleaned) {
      const keysToKeep = ['edumaster_path'];
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (!keysToKeep.includes(k) && k.startsWith('edumaster_')) {
          localStorage.removeItem(k);
        }
      });
      localStorage.setItem('edumaster_v2_cleaned', 'true');
      console.log('Obsolete local data cleaned up.');
    }

    const saved = localStorage.getItem('edumaster_path');
    if (saved) setActivePath(saved);
  }, []);

  const handleNavigate = (path: string) => {
    setActivePath(path);
    localStorage.setItem('edumaster_path', path);
  };

  const handleLogout = () => {
    // alert('Đăng xuất thành công!'); // Removed alert for smoother flow
    localStorage.setItem('edumaster_path', 'public-register');
    setActivePath('public-register');
    setPrefilledStudent(null);
  };

  const handleRegisterAnother = (student: any) => {
    setPrefilledStudent(student);
    handleNavigate('public-register');
  };

  const renderContent = () => {
    switch (activePath) {
      case 'dashboard': return <Dashboard />;
      case 'statistics': return <StatisticsView />;
      case 'admin': return <AdminView />;
      case 'categories': return <CategoriesView />;
      case 'print-templates': return <PrintTemplatesView />;
      case 'students': return <StudentsView />;
      case 'assignments': return <AssignmentsView />;
      case 'decisions': return <DecisionsView mode="OPENING" currentUser={currentUser} />;
      case 'exam-approval': return <ExamApprovalView />;
      case 'grade-entry': return <GradeEntryView />;
      case 'recognition-decisions': return <DecisionsView mode="RECOGNITION" currentUser={currentUser} />;

      case 'lookup': return <LookupView onRegisterAnother={handleRegisterAnother} />;
      case 'public-register': return <RegistrationView onLoginSuccess={() => handleNavigate('dashboard')} initialData={prefilledStudent} />;
      default: return <Dashboard />;
    }
  };

  if (activePath === 'public-register') {
    return <RegistrationView onLoginSuccess={() => handleNavigate('dashboard')} initialData={prefilledStudent} />;
  }

  return (
    <Layout
      activePath={activePath}
      onNavigate={handleNavigate}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
