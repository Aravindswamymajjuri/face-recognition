import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  ScanFace,
  LogIn,
  LogOut,
  Clock,
  Timer,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WebcamCapture from '../components/WebcamCapture';
import { recognizeFace } from '../api/attendanceApi';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ConfidenceBadge({ value }) {
  if (value == null) return null;
  const pct = Math.min(Math.round(value * 100), 99);
  const color =
    pct >= 85
      ? 'bg-emerald-400/15 text-emerald-300'
      : pct >= 65
      ? 'bg-amber-400/15 text-amber-300'
      : 'bg-rose-400/15 text-rose-300';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {pct}%
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    present:       'bg-emerald-400/15 text-emerald-300',
    checked_out:   'bg-purple-400/15 text-purple-300',
    late:          'bg-amber-400/15 text-amber-300',
    duplicate:     'bg-cyan-400/15 text-cyan-300',
    unknown:       'bg-rose-400/15 text-rose-300',
    outside_hours: 'bg-orange-400/15 text-orange-300',
    too_soon:      'bg-amber-400/15 text-amber-300',
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        map[status] ?? 'bg-slate-400/15 text-slate-300'
      }`}
    >
      {status?.replace('_', ' ')}
    </span>
  );
}

function ActionBadge({ action }) {
  if (!action || action === 'duplicate') return null;
  const isIn = action === 'check_in';
  return (
    <span
      className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isIn
          ? 'bg-cyan-400/15 text-cyan-300'
          : 'bg-purple-400/15 text-purple-300'
      }`}
    >
      {isIn ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
      {isIn ? 'Checked In' : 'Checked Out'}
    </span>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function LiveAttendance() {
  const webcamRef = useRef(null);
  const [lastCapture, setLastCapture] = useState(null);
  const [overlayState, setOverlayState] = useState('neutral');
  const [errorMessage, setErrorMessage] = useState('');
  const [isOutsideHours, setIsOutsideHours] = useState(false);

  const recognition = useMutation({ mutationFn: recognizeFace });
  const result = recognition.data;

  const handleCapture = (image) => {
    setLastCapture(image);
    setOverlayState('neutral');
    setErrorMessage('');
    setIsOutsideHours(false);

    recognition.mutate(image, {
      onSuccess: (res) => {
        setOverlayState(res.status === 'unknown' ? 'unknown' : 'recognized');
      },
      onError: (err) => {
        setOverlayState('unknown');
        const httpStatus = err?.response?.status;
        const detail = err?.response?.data?.detail ?? '';
        if (httpStatus === 403) {
          // Outside working hours — show as info, not error
          setErrorMessage(detail);
          setOverlayState('neutral');
          setIsOutsideHours(true);
        } else if (detail.toLowerCase().includes('blur'))
          setErrorMessage('Image is too blurry. Hold still and ensure good lighting.');
        else if (detail.toLowerCase().includes('no face'))
          setErrorMessage('No face detected. Center your face and improve lighting.');
        else
          setErrorMessage(detail || 'Recognition failed. Please try again.');
      },
    });
  };

  const handleReset = () => {
    recognition.reset();
    setLastCapture(null);
    setOverlayState('neutral');
    setErrorMessage('');
    setIsOutsideHours(false);
  };

  const isPending = recognition.isPending;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      {/* ── Header ── */}
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Live Recognition</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">
          Live Attendance
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Capture a frame from the camera. First scan marks{' '}
          <span className="text-cyan-300">check-in</span>, second scan marks{' '}
          <span className="text-purple-300">check-out</span>.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        {/* ── Webcam ── */}
        <WebcamCapture
          ref={webcamRef}
          captureLabel={isPending ? 'Scanning…' : 'Capture & recognize'}
          onCapture={handleCapture}
          status={overlayState}
        />

        {/* ── Right panel ── */}
        <div className="space-y-4">

          {/* Recognition result card */}
          <div className="glass-card rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <ScanFace className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">
                    Recognition Result
                  </p>
                  <h3 className="text-lg font-semibold text-slate-50">Realtime response</h3>
                </div>
              </div>
              {result && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">

              {/* Error / outside-hours message */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm ${
                      isOutsideHours
                        ? 'border-blue-400/20 bg-blue-400/10 text-blue-200'
                        : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                    }`}
                  >
                    {isOutsideHours
                      ? <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pending state */}
              {isPending && (
                <div className="flex items-center gap-3 py-2 text-sm text-cyan-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  Scanning face…
                </div>
              )}

              {/* Result */}
              <AnimatePresence mode="wait">
                {result && !isPending ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {/* Status + Action row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={result.status} />
                      <ActionBadge action={result.action} />
                    </div>

                    {/* Name */}
                    <div>
                      <p className="text-xs text-slate-400">Name</p>
                      <p className="text-xl font-semibold text-slate-50">
                        {result.name || 'Unknown'}
                      </p>
                    </div>

                    {/* Employee ID + Confidence */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Employee ID</p>
                        <p className="font-medium text-slate-100">
                          {result.employee_id || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Confidence</p>
                        <ConfidenceBadge value={result.confidence} />
                      </div>
                    </div>

                    {/* Department */}
                    {result.department && (
                      <div>
                        <p className="text-xs text-slate-400">Department</p>
                        <p className="font-medium text-slate-100">{result.department}</p>
                      </div>
                    )}

                    {/* Check-in / Check-out times */}
                    {(result.check_in_time || result.check_out_time) && (
                      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center gap-2">
                          <LogIn className="h-4 w-4 text-cyan-400" />
                          <div>
                            <p className="text-xs text-slate-400">Check-in</p>
                            <p className="text-sm font-medium text-slate-100">
                              {formatTime(result.check_in_time)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-purple-400" />
                          <div>
                            <p className="text-xs text-slate-400">Check-out</p>
                            <p className="text-sm font-medium text-slate-100">
                              {formatTime(result.check_out_time)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Work duration — shown only after check-out */}
                    {result.action === 'check_out' &&
                      result.check_in_time &&
                      result.check_out_time && (
                        <div className="flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-3 py-2">
                          <Timer className="h-4 w-4 text-purple-300" />
                          <div>
                            <p className="text-xs text-purple-300/70">Work duration</p>
                            <p className="text-sm font-semibold text-purple-200">
                              {formatDuration(
                                Math.round(
                                  (new Date(result.check_out_time) -
                                    new Date(result.check_in_time)) /
                                    60000,
                                ),
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Too soon to check out */}
                    {result.status === 'too_soon' && (
                      <div className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          Too soon to check out. Please wait at least{' '}
                          <span className="font-semibold">30 minutes</span>{' '}
                          after check-in before scanning again.
                        </span>
                      </div>
                    )}

                    {/* Already checked out */}
                    {result.status === 'duplicate' && (
                      <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Already checked out today. See you tomorrow!</span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div>
                      <p className="text-xs text-slate-400">Timestamp</p>
                      <p className="text-sm font-medium text-slate-100">
                        {new Date(result.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                ) : !isPending ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 text-slate-400"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <p className="text-sm">
                      Capture a frame to start realtime attendance recognition.
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Live overlay legend */}
          <div className="glass-card rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">
              Live Overlay
            </p>
            <p className="mt-2 text-sm text-slate-400">
              The webcam ring changes colour based on recognition result.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <BadgeCheck className="h-4 w-4 text-emerald-300" />
                Recognized
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
                Unknown
              </div>
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <LogIn className="h-3.5 w-3.5 text-cyan-400" />
                  <span>First scan of the day → Check-in</span>
                </div>
                <div className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-purple-400" />
                  <span>Second scan (after 30 min) → Check-out</span>
                </div>
              </div>
            </div>
          </div>

          {/* Last frame preview */}
          {lastCapture && (
            <div className="glass-card rounded-3xl p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.35em] text-cyan-200/60">
                Last Frame
              </p>
              <img
                src={lastCapture}
                alt="Last webcam capture"
                className="rounded-2xl border border-white/10"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}