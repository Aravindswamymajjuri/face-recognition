import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#00D4FF', '#1dd1a1', '#f43f5e'];

export default function StatsChart({ trend = [], summary = [] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="glass-card rounded-3xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Weekly Trend</p>
            <h3 className="text-lg font-semibold text-slate-50">Attendance movement</h3>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="rgba(255,255,255,0.12)" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="rgba(255,255,255,0.12)" />
              <Tooltip
                contentStyle={{ background: '#07101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Bar dataKey="present" fill="#00D4FF" radius={[10, 10, 0, 0]} />
              <Bar dataKey="late" fill="#1dd1a1" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Today Split</p>
            <h3 className="text-lg font-semibold text-slate-50">Attendance breakdown</h3>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="h-72 w-full md:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={72} paddingAngle={4}>
                  {summary.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#07101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid w-full gap-3 md:w-1/2">
            {summary.map((item, index) => (
              <div key={item.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.value} records</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
