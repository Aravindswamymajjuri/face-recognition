import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { AlertTriangle, Camera, Loader2, Power } from 'lucide-react';

const WebcamCapture = forwardRef(function WebcamCapture(
  { onCapture, captureLabel = 'Capture', mirrored = true, status = 'neutral', className = '' },
  ref,
) {
  const webcamRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const videoConstraints = useMemo(
    () => ({
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    }),
    [],
  );

  const handleUserMedia = () => {
    setIsCameraLoading(false);
    setCameraError('');
    console.log('Camera initialized successfully.');
  };

  const handleUserMediaError = (error) => {
    setIsCameraLoading(false);
    const fallbackMessage = 'Unable to access camera. Please allow camera permissions and close other apps using it.';
    setCameraError(error?.message || fallbackMessage);
    console.error('Camera initialization failed:', error);
  };

  const stopCameraStream = () => {
    const stream = webcamRef.current?.video?.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const toggleCamera = () => {
    if (isCameraEnabled) {
      stopCameraStream();
      setIsCameraEnabled(false);
      setIsCameraLoading(false);
      setCameraError('');
      return;
    }
    setIsCameraEnabled(true);
    setIsCameraLoading(true);
    setCameraError('');
  };

  const captureFrame = () => {
    if (!isCameraEnabled || cameraError || isCameraLoading) {
      return null;
    }
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc && onCapture) {
      onCapture(imageSrc);
    }
    return imageSrc;
  };

  useImperativeHandle(ref, () => ({
    captureFrame,
    getImage: captureFrame,
  }));

  const statusRing =
    status === 'recognized'
      ? 'ring-2 ring-emerald-400/80 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]'
      : status === 'unknown'
        ? 'ring-2 ring-rose-400/80 shadow-[0_0_0_1px_rgba(251,113,133,0.2)]'
        : 'ring-1 ring-white/10';

  return (
    <div className={`glass-card overflow-hidden rounded-3xl ${className}`}>
      <div className={`relative overflow-hidden rounded-3xl ${statusRing}`}>
        {!isCameraEnabled ? (
          <div className="flex h-[360px] w-full flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center md:h-[420px]">
            <Power className="h-8 w-8 text-cyan-300" />
            <p className="text-base font-semibold text-slate-100">Camera is turned off</p>
            <p className="max-w-md text-sm text-slate-400">Turn on the camera to capture frames for registration or live attendance.</p>
          </div>
        ) : cameraError ? (
          <div className="flex h-[360px] w-full flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center md:h-[420px]">
            <AlertTriangle className="h-8 w-8 text-rose-300" />
            <p className="text-base font-semibold text-slate-100">Camera not available</p>
            <p className="max-w-md text-sm text-slate-400">
              Allow camera permission for this site, close other apps using the webcam, then refresh this page.
            </p>
            <p className="text-xs text-rose-300/90">{cameraError}</p>
          </div>
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              mirrored={mirrored}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              videoConstraints={videoConstraints}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="h-[360px] w-full object-cover md:h-[420px]"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isCameraLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Initializing camera...
                </div>
              </div>
            ) : null}
          </>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">Camera Status</p>
          <p className="text-sm text-slate-100">
            {!isCameraEnabled
              ? 'Camera turned off'
              : cameraError
              ? 'Camera access required'
              : isCameraLoading
                ? 'Waiting for camera permission'
                : 'Live webcam feed connected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="glass-button-secondary"
            onClick={toggleCamera}
          >
            <Power className="h-4 w-4" />
            {isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          </button>
          <button
            type="button"
            className="glass-button"
            onClick={captureFrame}
            disabled={!isCameraEnabled || isCameraLoading || Boolean(cameraError)}
          >
            <Camera className="h-4 w-4" />
            {captureLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

export default WebcamCapture;
