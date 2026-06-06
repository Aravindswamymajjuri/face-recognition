import { NavLink } from 'react-router-dom';
import { Activity, Camera, ClipboardList, LayoutDashboard, Settings, ScanFace } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/live', label: 'Live Attendance', icon: Camera },
  { to: '/register', label: 'Register Face', icon: ScanFace },
  { to: '/records', label: 'Attendance Records', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 flex-col border-r border-white/10 bg-[#07101c]/90 px-5 py-6 backdrop-blur-xl md:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">Face Attendance</p>
          <h1 className="text-lg font-semibold text-slate-50">Recognition Hub</h1>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                isActive
                  ? 'bg-accent/15 text-accent shadow-[0_0_0_1px_rgba(0,212,255,0.18)]'
                  : 'text-slate-300 hover:bg-white/5 hover:text-slate-100',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 to-transparent p-4 text-sm text-slate-300">
        <p className="mb-2 text-xs uppercase tracking-[0.35em] text-cyan-200/70">System Status</p>
        <p className="text-slate-100">Realtime recognition enabled</p>
        <p className="mt-1 text-slate-400">CORS, analytics, registration, and settings are wired to the backend API.</p>
      </div>
    </aside>
  );
}
