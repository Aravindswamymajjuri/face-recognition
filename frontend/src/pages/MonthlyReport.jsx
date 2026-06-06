import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarRange, ChevronRight, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMonthlyAttendanceReport, getSettings } from '../api/attendanceApi';
import axios from 'axios';

const MONTHS = [
  { value: 1,  label: 'January'   },
  { value: 2,  label: 'February'  },
  { value: 3,  label: 'March'     },
  { value: 4,  label: 'April'     },
  { value: 5,  label: 'May'       },
  { value: 6,  label: 'June'      },
  { value: 7,  label: 'July'      },
  { value: 8,  label: 'August'    },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October'   },
  { value: 11, label: 'November'  },
  { value: 12, label: 'December'  },
];

function getCurrentMonth() { return new Date().getMonth() + 1; }
function getCurrentYear()  { return new Date().getFullYear(); }

function percentageTone(value) {
  if (value >= 85) return 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/20';
  if (value >= 75) return 'bg-amber-400/15 text-amber-300 ring-amber-400/20';
  return 'bg-rose-400/15 text-rose-300 ring-rose-400/20';
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function statusStyle(status) {
  switch (status) {
    case 'present': return 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20';
    case 'late':    return 'bg-amber-400/15  text-amber-300  ring-1 ring-amber-400/20';
    case 'holiday': return 'bg-cyan-400/15   text-cyan-300   ring-1 ring-cyan-400/20';
    default:        return 'bg-rose-400/15   text-rose-300   ring-1 ring-rose-400/20';
  }
}

function statusLabel(status, holidayName) {
  if (status === 'holiday') return holidayName || 'Holiday';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusDot(status) {
  switch (status) {
    case 'present': return 'bg-emerald-400';
    case 'late':    return 'bg-amber-400';
    case 'holiday': return 'bg-cyan-400';
    default:        return 'bg-rose-400';
  }
}

// ─── Employee Detail Modal ────────────────────────────────────────────────────

function EmployeeDetailModal({ employeeId, employeeName, month, year, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-detail', employeeId, month, year],
    queryFn: () =>
      axios
        .get('/api/attendance/employee-detail', {
          params: { employee_id: employeeId, month, year },
        })
        .then((r) => r.data),
    enabled: !!employeeId,
  });

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? '';

  // Stats derived from day records
  const stats = useMemo(() => {
    if (!data?.days) return null;
    const present  = data.days.filter((d) => d.status === 'present').length;
    const late     = data.days.filter((d) => d.status === 'late').length;
    const absent   = data.days.filter((d) => d.status === 'absent').length;
    const holidays = data.days.filter((d) => d.status === 'holiday').length;
    return { present, late, absent, holidays };
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 w-full max-w-2xl glass-card rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Day-wise Breakdown</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-50">
              {employeeName}
            </h3>
            <p className="text-sm text-slate-400">{monthLabel} {year}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-slate-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary strip */}
        {data && (
          <div className="grid grid-cols-4 divide-x divide-white/10 border-b border-white/10 shrink-0">
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Present</p>
              <p className="mt-0.5 text-lg font-semibold text-emerald-300">{stats?.present ?? 0}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Late</p>
              <p className="mt-0.5 text-lg font-semibold text-amber-300">{stats?.late ?? 0}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Absent</p>
              <p className="mt-0.5 text-lg font-semibold text-rose-300">{stats?.absent ?? 0}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Attendance %</p>
              <p className={`mt-0.5 text-lg font-semibold ${
                data.attendance_percentage >= 85 ? 'text-emerald-300'
                : data.attendance_percentage >= 75 ? 'text-amber-300'
                : 'text-rose-300'
              }`}>
                {data.attendance_percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-white/5 shrink-0 flex-wrap">
          {[
            { status: 'present', label: 'Present'  },
            { status: 'late',    label: 'Late'     },
            { status: 'absent',  label: 'Absent'   },
            { status: 'holiday', label: 'Holiday'  },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`h-2 w-2 rounded-full ${statusDot(status)}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Day list — scrollable */}
        <div className="overflow-y-auto divide-y divide-white/5 flex-1">
          {isLoading && (
            <div className="py-16 text-center text-sm text-slate-500">
              Loading attendance…
            </div>
          )}

          {(data?.days ?? []).map((day) => {
            const d = new Date(day.date + 'T00:00:00');
            const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayNum  = d.getDate();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div
                key={day.date}
                className={`flex items-center justify-between px-6 py-3 transition-colors hover:bg-white/5 ${
                  isWeekend ? 'opacity-50' : ''
                }`}
              >
                {/* Left — date */}
                <div className="flex items-center gap-4">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">{weekday}</p>
                    <p className="text-base font-semibold text-slate-50 leading-tight">{dayNum}</p>
                  </div>

                  {/* Status dot + badge */}
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot(day.status)}`} />
                    <span className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${statusStyle(day.status)}`}>
                      {statusLabel(day.status, day.holiday_name)}
                    </span>
                  </div>
                </div>

                {/* Right — check-in details */}
                <div className="text-right shrink-0">
                  {day.check_in_time ? (
                    <>
                      <p className="text-sm text-slate-300">{day.check_in_time}</p>
                      {day.confidence != null && (
                        <p className="text-xs text-slate-500">{day.confidence}% confidence</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-600">—</p>
                  )}
                </div>
              </div>
            );
          })}

          {!isLoading && data?.days?.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-500">
              No records found for this period.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyReport() {
  const [draft, setDraft] = useState({
    month: getCurrentMonth(),
    year:  getCurrentYear(),
    department: '',
  });
  const [filters, setFilters] = useState(draft);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // { id, name }

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const reportQuery = useQuery({
    queryKey: ['monthly-attendance-report', filters],
    queryFn: () =>
      getMonthlyAttendanceReport({
        month:      filters.month,
        year:       filters.year,
        department: filters.department || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Employees',
        value: reportQuery.data?.summary?.total_employees ?? 0,
        tone: 'from-cyan-400/15 to-transparent',
        valueClass: 'text-cyan-200',
      },
      {
        label: 'Average Attendance %',
        value: `${reportQuery.data?.summary?.average_attendance_percentage?.toFixed(1) ?? '0.0'}%`,
        tone: 'from-emerald-400/15 to-transparent',
        valueClass: 'text-emerald-200',
      },
      {
        label: 'Perfect Attendance',
        value: reportQuery.data?.summary?.perfect_attendance_count ?? 0,
        tone: 'from-amber-400/15 to-transparent',
        valueClass: 'text-amber-200',
      },
      {
        label: 'Below 75%',
        value: reportQuery.data?.summary?.below_75_count ?? 0,
        tone: 'from-rose-400/15 to-transparent',
        valueClass: 'text-rose-200',
      },
    ],
    [reportQuery.data],
  );

  const reportLabel = `${MONTHS.find((m) => m.value === filters.month)?.label ?? 'Month'} ${filters.year}`;

  return (
    <>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0  }}
        exit={{    opacity: 0, y: -12 }}
        transition={{ duration: 0.28 }}
      >
        {/* Page heading */}
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Attendance Insights</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Monthly Attendance Report</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Generate a monthly attendance summary by department. Click any employee row to see their day-wise breakdown.
          </p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-3xl p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr_0.9fr_auto]">
            <select
              className="glass-input"
              value={draft.month}
              onChange={(e) => setDraft((c) => ({ ...c, month: Number(e.target.value) }))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="2000"
              max="2100"
              className="glass-input"
              value={draft.year}
              onChange={(e) => setDraft((c) => ({ ...c, year: Number(e.target.value) }))}
              placeholder="Year"
            />
            <select
              className="glass-input"
              value={draft.department}
              onChange={(e) => setDraft((c) => ({ ...c, department: e.target.value }))}
            >
              <option value="">All departments</option>
              {(settings?.departments || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button type="button" className="glass-button" onClick={() => setFilters(draft)}>
              <Filter className="h-4 w-4" /> Generate Report
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
              <CalendarRange className="h-4 w-4 text-cyan-200" />
              {reportLabel}
            </div>
            {reportQuery.isFetching && (
              <span className="text-cyan-200">Refreshing report…</span>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={`glass-card rounded-3xl bg-gradient-to-br ${card.tone} p-5`}>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{card.label}</p>
              <div className={`mt-3 text-3xl font-semibold ${card.valueClass}`}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Report Table</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-50">Employee monthly breakdown</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              <BarChart3 className="h-4 w-4 text-cyan-200" />
              {formatNumber(reportQuery.data?.items?.length || 0)} employees
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Employee ID</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Present</th>
                  <th className="px-5 py-4">Late</th>
                  <th className="px-5 py-4">Absent</th>
                  <th className="px-5 py-4">Days So Far</th>
                  <th className="px-5 py-4">Attendance %</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(reportQuery.data?.items || []).map((row) => (
                  <tr
                    key={row.employee_id}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setSelectedEmployee({ id: row.employee_id, name: row.name })}
                  >
                    <td className="px-5 py-4 font-medium text-slate-50">{row.name}</td>
                    <td className="px-5 py-4 text-slate-300">{row.employee_id}</td>
                    <td className="px-5 py-4 text-slate-300">{row.department}</td>
                    <td className="px-5 py-4 text-slate-300">{row.present_days}</td>
                    <td className="px-5 py-4 text-slate-300">{row.late_days}</td>
                    <td className="px-5 py-4 text-slate-300">{row.absent_days}</td>
                    <td className="px-5 py-4 text-slate-300">{row.total_working_days}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ring-1 ${percentageTone(row.attendance_percentage)}`}>
                        {row.attendance_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
                {reportQuery.data?.items?.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-slate-500" colSpan={9}>
                      No employees match the current report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Employee detail modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <EmployeeDetailModal
            key={selectedEmployee.id}
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            month={filters.month}
            year={filters.year}
            onClose={() => setSelectedEmployee(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}