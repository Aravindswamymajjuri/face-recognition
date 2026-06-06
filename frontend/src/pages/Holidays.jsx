import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX2, ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' },   { value: 4, label: 'April' },
  { value: 5, label: 'May' },     { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },
  { value: 9, label: 'September' },{ value: 10, label: 'October' },
  { value: 11, label: 'November' },{ value: 12, label: 'December' },
];

const HOLIDAY_TYPES = [
  { value: 'public',     label: 'Public Holiday',     color: 'bg-rose-400/15 text-rose-300 ring-rose-400/20' },
  { value: 'optional',  label: 'Optional Holiday',    color: 'bg-amber-400/15 text-amber-300 ring-amber-400/20' },
  { value: 'restricted', label: 'Restricted Holiday', color: 'bg-cyan-400/15 text-cyan-300 ring-cyan-400/20' },
];

function typeColor(type) {
  return HOLIDAY_TYPES.find((t) => t.value === type)?.color
    ?? 'bg-slate-400/15 text-slate-300 ring-slate-400/20';
}

function TypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = HOLIDAY_TYPES.find((t) => t.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="glass-input flex w-full items-center justify-between text-left">
        <span className="text-slate-50">{selected?.label ?? 'Select type'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800 shadow-xl">
          {HOLIDAY_TYPES.map((t) => (
            <li key={t.value}>
              <button type="button"
                onClick={() => { onChange(t.value); setOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors
                  ${value === t.value ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-200 hover:bg-slate-700 hover:text-slate-50'}`}>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const getHolidays = ({ year, month }) =>
  axios.get('/api/holidays', { params: { year, month } }).then((r) => r.data);

const addHoliday = (payload) =>
  axios.post('/api/holidays', payload).then((r) => r.data);

const deleteHoliday = (date) =>
  axios.delete(`/api/holidays/${date}`).then((r) => r.data);

export default function Holidays() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [filter, setFilter] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [form, setForm] = useState({ date: '', name: '', holiday_type: 'public' });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['holidays', filter],
    queryFn: () => getHolidays(filter),
  });

  const addMutation = useMutation({
    mutationFn: addHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setForm({ date: '', name: '', holiday_type: 'public' });
      setFormError('');
    },
    onError: (err) => {
      setFormError(err?.response?.data?.detail || 'Failed to add holiday.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.date || !form.name) {
      setFormError('Date and name are required.');
      return;
    }
    addMutation.mutate(form);
  };

  return (
    <motion.div className="space-y-6"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>

      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Calendar Management</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Holiday Management</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Add public, optional, or restricted holidays. These are excluded from attendance working day calculations.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">

        {/* Add Holiday Form */}
        <form className="glass-card rounded-3xl p-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Add Holiday</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-50">New entry</h3>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Date</label>
            <input
              type="date"
              className="glass-input"
              value={form.date}
              onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Holiday Name</label>
            <input
              className="glass-input"
              placeholder="e.g. Diwali, Christmas, Republic Day"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Type</label>
            <TypeSelect
              value={form.holiday_type}
              onChange={(v) => setForm((c) => ({ ...c, holiday_type: v }))}
            />
          </div>

          {formError && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
              {formError}
            </div>
          )}

          <button type="submit" className="glass-button w-full justify-center"
            disabled={addMutation.isPending}>
            {addMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
              : <><Plus className="h-4 w-4" /> Add Holiday</>}
          </button>
        </form>

        {/* Holiday List */}
        <div className="glass-card rounded-3xl overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <CalendarX2 className="h-4 w-4 text-cyan-200" />
            <select className="glass-input flex-1"
              value={filter.month}
              onChange={(e) => setFilter((c) => ({ ...c, month: Number(e.target.value) }))}>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input type="number" className="glass-input w-28"
              value={filter.year} min="2000" max="2100"
              onChange={(e) => setFilter((c) => ({ ...c, year: Number(e.target.value) }))} />
          </div>

          {/* List */}
          <div className="divide-y divide-white/5">
            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
              </div>
            )}
            {!isLoading && data?.holidays?.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-500">
                No holidays recorded for{' '}
                {MONTHS.find((m) => m.value === filter.month)?.label} {filter.year}.
              </div>
            )}
            {(data?.holidays ?? []).map((holiday) => (
              <div key={holiday.date}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">
                      {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className="text-lg font-semibold text-slate-50">
                      {new Date(holiday.date + 'T00:00:00').getDate()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-50">{holiday.name}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${typeColor(holiday.holiday_type)}`}>
                      {HOLIDAY_TYPES.find((t) => t.value === holiday.holiday_type)?.label ?? holiday.holiday_type}
                    </span>
                  </div>
                </div>
                <button type="button"
                  onClick={() => deleteMutation.mutate(holiday.date)}
                  disabled={deleteMutation.isPending}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
            {data?.total ?? 0} holiday{data?.total !== 1 ? 's' : ''} this month
          </div>
        </div>
      </div>
    </motion.div>
  );
}