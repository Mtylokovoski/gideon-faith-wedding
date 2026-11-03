import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable' | 'unsupported' | 'error';
export type Facing = 'environment' | 'user';

export function cameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** Wraps getUserMedia with friendly states. Never throws; permission is only requested when start() is called. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wasActive = useRef(false);
  const [state, setState] = useState<CameraState>('idle');
  const [facing, setFacing] = useState<Facing>('environment');
  const [message, setMessage] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (want: Facing) => {
      if (!cameraSupported()) {
        setState('unsupported');
        setMessage(
          window.isSecureContext
            ? 'This browser cannot open the camera directly.'
            : 'The camera needs a secure (HTTPS) connection.',
        );
        return;
      }
      stop();
      setState('starting');
      setMessage('');
      setFacing(want);

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: want }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false },
        { video: { facingMode: { ideal: want } }, audio: false },
        { video: true, audio: false },
      ];

      let lastErr: unknown;
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.setAttribute('playsinline', 'true');
            video.muted = true;
            try {
              await video.play();
            } catch {
              /* autoplay quirks: the element still shows frames once it can play */
            }
          }
          wasActive.current = true;
          setState('active');
          return;
        } catch (e) {
          lastErr = e;
          const name = (e as DOMException)?.name;
          // Permission problems will not be fixed by trying looser constraints.
          if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'NotFoundError') break;
        }
      }

      const name = (lastErr as DOMException | undefined)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
        setMessage('Camera permission was not given.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setState('unavailable');
        setMessage('No camera was found on this device.');
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        setState('error');
        setMessage('The camera is busy. Close other apps that use the camera, then try again.');
      } else {
        setState('error');
        setMessage('The camera could not be started.');
      }
    },
    [stop],
  );

  const flip = useCallback(() => start(facing === 'environment' ? 'user' : 'environment'), [facing, start]);

  /** Grab the current video frame as a JPEG. */
  const capture = useCallback((): Promise<Blob> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return Promise.reject(new Error('The camera is not ready yet.'));
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('Could not capture the photo.'));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          canvas.width = 0;
          canvas.height = 0;
          if (b) resolve(b);
          else reject(new Error('Could not capture the photo.'));
        },
        'image/jpeg',
        0.92,
      );
    });
  }, []);

  // Release the camera when leaving, and when the tab is hidden (phones may freeze the stream).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) {
          stop();
          setState('idle');
        }
      } else if (wasActive.current && !streamRef.current) {
        void start(facing);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [facing, start, stop]);

  return { videoRef, state, facing, message, start, stop, flip, capture, mirrored: facing === 'user' };
}
