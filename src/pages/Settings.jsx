import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, SlidersHorizontal } from 'lucide-react';
import { getSettings, updateSettings } from '../api/attendanceApi';
import { motion } from 'framer-motion';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (data) {
      setForm({
        confidence_threshold: data.confidence_threshold,
        working_hours_start: data.working_hours_start,
        working_hours_end: data.working_hours_end,
        late_after_minutes: data.late_after_minutes,
        departments: data.departments.join(', '),
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (nextSettings) => {
      queryClient.setQueryData(['settings'], nextSettings);
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form) {
      return;
    }
    mutation.mutate({
      confidence_threshold: Number(form.confidence_threshold),
      working_hours_start: form.working_hours_start,
      working_hours_end: form.working_hours_end,
      late_after_minutes: Number(form.late_after_minutes),
      departments: form.departments
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">System Controls</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Settings</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Tune recognition confidence, working hours, late cutoff, and the supported department list.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form className="glass-card rounded-3xl p-5" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Configuration</p>
              <h3 className="text-lg font-semibold text-slate-50">Recognition controls</h3>
            </div>
          </div>

          {isLoading || !form ? (
            <div className="text-sm text-slate-400">Loading settings...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Confidence threshold</label>
                <input
                  type="range"
                  min="0.3"
                  max="0.95"
                  step="0.01"
                  className="w-full accent-cyan-400"
                  value={form.confidence_threshold}
                  onChange={(event) => setForm((current) => ({ ...current, confidence_threshold: event.target.value }))}
                />
                <div className="mt-2 text-sm text-cyan-200">{Number(form.confidence_threshold).toFixed(2)}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Working hours start</label>
                  <input
                    type="time"
                    className="glass-input"
                    value={form.working_hours_start}
                    onChange={(event) => setForm((current) => ({ ...current, working_hours_start: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Working hours end</label>
                  <input
                    type="time"
                    className="glass-input"
                    value={form.working_hours_end}
                    onChange={(event) => setForm((current) => ({ ...current, working_hours_end: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Late cutoff grace (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    className="glass-input"
                    value={form.late_after_minutes}
                    onChange={(event) => setForm((current) => ({ ...current, late_after_minutes: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Supported departments</label>
                  <input
                    className="glass-input"
                    value={form.departments}
                    onChange={(event) => setForm((current) => ({ ...current, departments: event.target.value }))}
                    placeholder="Engineering, HR, Operations"
                  />
                </div>
              </div>

              <button type="submit" className="glass-button" disabled={mutation.isPending}>
                <Save className="h-4 w-4" /> {mutation.isPending ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          )}

          {mutation.isSuccess ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              Settings saved successfully.
            </div>
          ) : null}
        </form>

        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Current State</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span>Threshold</span>
                <span className="text-cyan-200">{data?.confidence_threshold ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span>Work day</span>
                <span className="text-cyan-200">{data ? `${data.working_hours_start} - ${data.working_hours_end}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span>Departments</span>
                <span className="text-cyan-200">{data?.departments?.length ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 text-sm text-slate-400">
            The backend stores these settings in SQLite and uses them to control recognition confidence and late check-in handling.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
