import { useState, useEffect, useRef, useCallback } from "react";

export interface FaceDetectionState {
  isPresent: boolean;
  attentionScore: number;
  isWebcamActive: boolean;
  error: string | null;
  faceCount: number;
}

export function useFaceDetection() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const scoreRef = useRef(0);

  const [state, setState] = useState<FaceDetectionState>({
    isPresent: false,
    attentionScore: 0,
    isWebcamActive: false,
    error: null,
    faceCount: 0,
  });

  // Use canvas-based brightness/motion detection as a lightweight proxy
  // for face presence (works without heavy ML libraries)
  const previousFrameRef = useRef<ImageData | null>(null);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(video, 0, 0, 160, 120);

    const imageData = ctx.getImageData(0, 0, 160, 120);
    const data = imageData.data;

    // Analyze center region for skin-tone pixels (face proxy)
    const centerX = 40, centerY = 20, regionW = 80, regionH = 80;
    let skinPixels = 0;
    let totalPixels = 0;

    for (let y = centerY; y < centerY + regionH; y++) {
      for (let x = centerX; x < centerX + regionW; x++) {
        const i = (y * 160 + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];

        // Skin tone detection in RGB space
        if (r > 60 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - b > 15) {
          skinPixels++;
        }
        totalPixels++;
      }
    }

    const skinRatio = skinPixels / totalPixels;
    const faceDetected = skinRatio > 0.15;

    // Motion detection
    let motionScore = 0;
    if (previousFrameRef.current) {
      const prevData = previousFrameRef.current.data;
      let diff = 0;
      for (let i = 0; i < data.length; i += 16) {
        diff += Math.abs(data[i] - prevData[i]);
      }
      motionScore = diff / (data.length / 16);
    }
    previousFrameRef.current = imageData;

    // Update attention score
    if (faceDetected) {
      // Face present: increase score, bonus for slight motion (engagement)
      const motionBonus = motionScore > 2 && motionScore < 30 ? 2 : 0;
      scoreRef.current = Math.min(scoreRef.current + 3 + motionBonus, 100);
    } else {
      // No face: decrease score
      scoreRef.current = Math.max(scoreRef.current - 4, 0);
    }

    setState(prev => ({
      ...prev,
      isPresent: faceDetected,
      attentionScore: Math.round(scoreRef.current),
      faceCount: faceDetected ? 1 : 0,
    }));
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState(prev => ({ ...prev, isWebcamActive: true, error: null }));

      // Analyze frames every 500ms
      intervalRef.current = window.setInterval(analyzeFrame, 500);
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: "Camera access denied. Please allow camera permissions.",
        isWebcamActive: false,
      }));
    }
  }, [analyzeFrame]);

  const stopWebcam = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setState(prev => ({ ...prev, isWebcamActive: false, isPresent: false }));
  }, []);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  return {
    ...state,
    videoRef,
    canvasRef,
    startWebcam,
    stopWebcam,
  };
}
