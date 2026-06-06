import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import LiveAttendance from './pages/LiveAttendance';
import RegisterFace from './pages/RegisterFace';
import Records from './pages/Records';
import Settings from './pages/Settings';

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-radial-grid">
      <div className="mx-auto flex min-h-screen max-w-[1800px]">
        <Sidebar />
        <main className="flex-1 overflow-hidden px-4 py-4 md:px-6 lg:px-8 lg:py-6">
          <div className="glass-card mb-4 rounded-3xl px-4 py-3 md:hidden">
            <p className="text-sm font-semibold text-slate-50">Face Recognition Attendance</p>
            <p className="text-xs text-slate-400">Dashboard, live capture, register, records, settings</p>
          </div>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/live" element={<LiveAttendance />} />
              <Route path="/register" element={<RegisterFace />} />
              <Route path="/records" element={<Records />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
