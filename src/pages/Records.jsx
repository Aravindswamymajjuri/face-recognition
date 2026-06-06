import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAttendanceRecords } from '../api/attendanceApi';
import { motion } from 'framer-motion';

function buildCsv(rows) {
  const header = ['ID', 'Employee ID', 'Name', 'Department', 'Timestamp', 'Status', 'Confidence'];
  const lines = rows.map((row) => [
    row.id,
    row.employee_id,
    row.name,
    row.department,
    new Date(row.timestamp).toISOString(),
    row.status,
    (row.confidence * 100).toFixed(2),
  ]);
  return [header, ...lines].map((line) => line.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',')).join('\n');
}

export default function Records() {
  const [filters, setFilters] = useState({ date: '', name: '', department: '' });
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(1);

  const { data, isFetching } = useQuery({
    queryKey: ['attendance-records', filters, page],
    queryFn: () =>
      getAttendanceRecords({
        date: filters.date || undefined,
        name: filters.name || undefined,
        department: filters.department || undefined,
        page,
        page_size: 10,
      }),
    placeholderData: (previous) => previous,
  });

  const exportCsv = async () => {
    const response = await getAttendanceRecords({
      date: filters.date || undefined,
      name: filters.name || undefined,
      department: filters.department || undefined,
      page: 1,
      page_size: 1000,
    });
    const csv = buildCsv(response.items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-records-${filters.date || 'today'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = useMemo(() => data?.total_pages || 0, [data]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Records Center</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Attendance Records</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Search, filter, page through, and export attendance history from the recognition backend.
        </p>
      </div>

      <div className="glass-card rounded-3xl p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            type="date"
            className="glass-input"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
          />
          <input
            className="glass-input"
            placeholder="Search by name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            className="glass-input"
            placeholder="Department"
            value={draft.department}
            onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}
          />
          <button
            type="button"
            className="glass-button"
            onClick={() => {
              setFilters(draft);
              setPage(1);
            }}
          >
            <Filter className="h-4 w-4" /> Filter
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="glass-button-secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <div className="text-sm text-slate-400">Showing {data?.items.length || 0} records</div>
          {isFetching ? <div className="text-sm text-cyan-200">Refreshing...</div> : null}
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Employee ID</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data?.items || []).map((row) => (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="px-5 py-4 text-slate-50">{row.name}</td>
                  <td className="px-5 py-4 text-slate-300">{row.employee_id}</td>
                  <td className="px-5 py-4 text-slate-300">{row.department}</td>
                  <td className="px-5 py-4 text-slate-300">{new Date(row.timestamp).toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${row.status === 'late' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{Math.round(row.confidence * 100)}%</td>
                </tr>
              ))}
              {data?.items?.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={6}>
                    No attendance records match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Page {data?.page || 1} of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="glass-button-secondary"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            className="glass-button-secondary"
            onClick={() => setPage((current) => (data?.total_pages ? Math.min(current + 1, data.total_pages) : current + 1))}
            disabled={page >= (data?.total_pages || 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
