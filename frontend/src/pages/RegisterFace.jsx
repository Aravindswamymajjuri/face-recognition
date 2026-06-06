import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ScanFace, Upload } from 'lucide-react';
import WebcamCapture from '../components/WebcamCapture';
import { registerFace } from '../api/attendanceApi';
import { motion } from 'framer-motion';

const angleLabels = [
  { key: 'front', label: 'Front' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
];

export default function RegisterFace() {
  const webcamRef = useRef(null);
  const [form, setForm] = useState({ name: '', employee_id: '', department: 'Engineering' });
  const [captures, setCaptures] = useState({ front: null, left: null, right: null });
  const [latestFrame, setLatestFrame] = useState(null);
  const [progress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => registerFace(payload, (event) => {
      if (!event.total) {
        return;
      }
      setProgress(Math.min(Math.round((event.loaded / event.total) * 100), 95));
    }),
    onSuccess: (data) => {
      setProgress(100);
      setSuccessMessage(`${data.name} (${data.employee_id}) has been registered.`);
      setErrorMessage('');
    },
    onError: (error) => {
      const detail = error?.response?.data?.detail;
      setErrorMessage(detail || 'Registration failed. Please verify the captured images and backend connection.');
    },
  });

  const captureStatus = useMemo(() => angleLabels.map(({ key, label }) => ({ key, label, image: captures[key] })), [captures]);

  const takeSnapshot = (angle) => {
    const image = webcamRef.current?.captureFrame?.() || webcamRef.current?.getImage?.();
    if (!image) {
      return;
    }
    setCaptures((current) => ({ ...current, [angle]: image }));
    setLatestFrame(image);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setProgress(0);
    mutation.mutate({
      ...form,
      images: Object.values(captures).filter(Boolean),
    });
  };

  const allCaptured = Object.values(captures).every(Boolean);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Enrollment Workflow</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Register Face</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Capture a face from three angles, submit the employee profile, and persist the averaged embedding on the backend.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <WebcamCapture
            ref={webcamRef}
            captureLabel="Save current frame"
            onCapture={(image) => setLatestFrame(image)}
          />

          <div className="glass-card rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Capture Angles</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {captureStatus.map(({ key, label, image }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => takeSnapshot(key)}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-accent/40 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">{label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-50">{image ? 'Captured' : 'Pending'}</p>
                    </div>
                    <ScanFace className="h-5 w-5 text-cyan-200" />
                  </div>
                  {image ? <img src={image} alt={`${label} capture`} className="mt-4 h-28 w-full rounded-2xl object-cover" /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form className="glass-card rounded-3xl p-5" onSubmit={onSubmit}>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Employee Details</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-50">Registration form</h3>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Full name</label>
              <input
                className="glass-input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Employee / Student ID</label>
              <input
                className="glass-input"
                value={form.employee_id}
                onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}
                placeholder="EMP-1024"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Department</label>
              <input
                className="glass-input"
                value={form.department}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                placeholder="Engineering"
              />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>Upload progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="glass-button" type="submit" disabled={mutation.isPending || !allCaptured || !form.name || !form.employee_id}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {mutation.isPending ? 'Registering' : 'Submit registration'}
            </button>
          </div>

          {mutation.isError ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {successMessage}
              </div>
            </div>
          ) : null}

          {latestFrame ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Latest Capture</p>
              <img src={latestFrame} alt="Latest captured face frame" className="mt-3 rounded-2xl border border-white/10" />
            </div>
          ) : null}
        </form>
      </div>
    </motion.div>
  );
}
