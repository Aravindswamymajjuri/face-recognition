import { useQuery } from '@tanstack/react-query';
import { Clock3, ShieldCheck, UserRoundCheck, UserRoundX, UserSquare2 } from 'lucide-react';
import { getTodayStats } from '../api/attendanceApi';
import AttendanceCard from '../components/AttendanceCard';
import StatsChart from '../components/StatsChart';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['today-stats'],
    queryFn: getTodayStats,
    refetchInterval: 15000,
  });

  const stats = data || {
    total_registered: 0,
    present: 0,
    absent: 0,
    late: 0,
    recent_checkins: [],
  };

  const summary = [
    { name: 'Present', value: stats.present },
    { name: 'Absent', value: stats.absent },
    { name: 'Late', value: stats.late },
  ];

  const metrics = [
    {
      title: 'Registered',
      value: stats.total_registered,
      subtitle: 'All active people in the system',
      icon: UserSquare2,
      accent: 'text-cyan-300',
    },
    {
      title: 'Present',
      value: stats.present,
      subtitle: 'Recognized today',
      icon: UserRoundCheck,
      accent: 'text-emerald-300',
    },
    {
      title: 'Absent',
      value: stats.absent,
      subtitle: 'Still pending check-in',
      icon: UserRoundX,
      accent: 'text-rose-300',
    },
    {
      title: 'Late',
      value: stats.late,
      subtitle: 'Checked in after cutoff',
      icon: Clock3,
      accent: 'text-amber-300',
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Attendance Command Center</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Monitor today&apos;s attendance, recent activity, and weekly recognition trends in one place.
          </p>
        </div>
        <div className="glass-card rounded-3xl px-4 py-3 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-cyan-200">
            <ShieldCheck className="h-4 w-4" /> Live backend connected
          </div>
        </div>
      </div>

      {isError ? <div className="glass-card rounded-3xl p-4 text-rose-300">Unable to load dashboard data.</div> : null}
      {isLoading ? <div className="glass-card rounded-3xl p-6 text-slate-400">Loading dashboard data...</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <AttendanceCard key={metric.title} title={metric.title} value={metric.value} subtitle={metric.subtitle} accent={metric.accent} icon={metric.icon} />
        ))}
      </div>

      <StatsChart trend={stats.weekly_trend || []} summary={summary} />

      <div className="glass-card rounded-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Recent Check-ins</p>
            <h3 className="text-lg font-semibold text-slate-50">Latest recognized faces</h3>
          </div>
        </div>
        <div className="space-y-3">
          {stats.recent_checkins.length === 0 ? (
            <p className="text-sm text-slate-500">No check-ins recorded yet today.</p>
          ) : (
            stats.recent_checkins.map((entry) => (
              <div key={`${entry.employee_id}-${entry.timestamp}`} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-slate-50">{entry.name}</p>
                  <p className="text-sm text-slate-400">
                    {entry.employee_id} • {entry.department}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">{entry.status}</span>
                  <span>{Math.round(entry.confidence * 100)}%</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
