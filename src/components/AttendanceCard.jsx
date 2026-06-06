export default function AttendanceCard({ title, value, subtitle, accent = 'text-cyan-300', icon: Icon }) {
  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <div className={`mt-3 text-4xl font-semibold tracking-tight ${accent}`}>{value}</div>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        {Icon ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
