import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ScanFace } from 'lucide-react';
import WebcamCapture from '../components/WebcamCapture';
import { recognizeFace } from '../api/attendanceApi';
import { motion } from 'framer-motion';

export default function LiveAttendance() {
  const webcamRef = useRef(null);
  const [lastCapture, setLastCapture] = useState(null);
  const [overlayState, setOverlayState] = useState('neutral');
  const [warningMessage, setWarningMessage] = useState('');

  const recognition = useMutation({
    mutationFn: recognizeFace,
  });

  const result = recognition.data;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28 }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/60">Live Recognition</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50 md:text-4xl">Live Attendance</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Capture a frame from the camera, send it to the recognition API, and display the matched employee in real time.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <WebcamCapture
          ref={webcamRef}
          captureLabel={recognition.isPending ? 'Scanning...' : 'Capture & recognize'}
          onCapture={(image) => {
            setLastCapture(image);
            setOverlayState('neutral');
            setWarningMessage('');
            recognition.mutate(image, {
              onSuccess: (response) => {
                setOverlayState(response.status === 'unknown' ? 'unknown' : 'recognized');
              },
              onError: (error) => {
                setOverlayState('unknown');
                setWarningMessage(
                  error?.response?.data?.detail || 'Face not clear or not detected. Please adjust lighting and center your face.',
                );
              },
            });
          }}
          status={overlayState}
        />

        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                <ScanFace className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Recognition Result</p>
                <h3 className="text-lg font-semibold text-slate-50">Realtime response</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
              {warningMessage ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  {warningMessage}
                </div>
              ) : null}
              {result ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-400">Status</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${result.status === 'unknown' ? 'bg-rose-400/15 text-rose-300' : result.status === 'late' ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
                      {result.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Name</p>
                    <p className="text-xl font-semibold text-slate-50">{result.name || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-slate-400">Employee ID</p>
                      <p className="font-medium text-slate-100">{result.employee_id || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Confidence</p>
                      <p className="font-medium text-slate-100">{Math.round((result.confidence || 0) * 100)}%</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Timestamp</p>
                    <p className="font-medium text-slate-100">{new Date(result.timestamp).toLocaleString()}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 text-slate-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <p>Capture a frame to start realtime attendance recognition.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Live Overlay</p>
            <p className="mt-2 text-sm text-slate-400">The webcam ring turns green for a recognized face and red for unknown results.</p>
            <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
              <BadgeCheck className="h-4 w-4 text-emerald-300" /> Recognized
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-300">
              <AlertTriangle className="h-4 w-4 text-rose-300" /> Unknown
            </div>
          </div>

          {lastCapture ? (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Last Frame</p>
              <img src={lastCapture} alt="Last webcam capture" className="mt-3 rounded-2xl border border-white/10" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
