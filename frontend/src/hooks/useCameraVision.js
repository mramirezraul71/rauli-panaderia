import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook para captura de cámara y análisis visual
 * Características 2026:
 * - Captura de foto/video
 * - Acceso a múltiples cámaras
 * - Resolución ajustable
 * - Filtros y efectos
 */
export function useCameraVision({ facingMode = "user", resolution = "hd" } = {}) {
  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Verificar soporte
    const hasSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(hasSupport);

    console.log("useCameraVision: Inicializando", {
      hasNavigator: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      isSupported: hasSupport
    });

    if (!hasSupport) {
      setError("Tu navegador no soporta acceso a cámara");
      console.error("useCameraVision: No soportado");
      return;
    }
    
    console.log("useCameraVision: Soportado ✓");

    // Listar dispositivos de video
    const loadDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === "videoinput");
        setDevices(videoDevices);
      } catch (err) {
        console.error("Error listing devices:", err);
      }
    };

    loadDevices();

    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getConstraints = useCallback((deviceId) => {
    const resolutions = {
      vga: { width: 640, height: 480 },
      hd: { width: 1280, height: 720 },
      fhd: { width: 1920, height: 1080 },
      "4k": { width: 3840, height: 2160 }
    };

    return {
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        facingMode: deviceId ? undefined : facingMode,
        ...resolutions[resolution]
      },
      audio: false
    };
  }, [facingMode, resolution]);

  const startCamera = useCallback(async (deviceId) => {
    if (!isSupported) return;

    try {
      // Detener stream anterior
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = getConstraints(deviceId);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setError(null);
    } catch (err) {
      console.error("Error starting camera:", err);
      setError(`No se pudo acceder a la cámara: ${err.message}`);
      setIsActive(false);
    }
  }, [isSupported, getConstraints]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !isActive) {
      setError("La cámara no está activa");
      return null;
    }

    try {
      const video = videoRef.current;
      
      // Crear canvas temporal si no existe
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Obtener imagen como base64
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const base64 = imageDataUrl.split(",")[1];
      
      const imageData = {
        dataUrl: imageDataUrl,
        base64,
        mimeType: "image/jpeg",
        width: canvas.width,
        height: canvas.height,
        timestamp: new Date().toISOString()
      };

      setCapturedImage(imageData);
      return imageData;

    } catch (err) {
      console.error("Error capturing photo:", err);
      setError(`Error al capturar foto: ${err.message}`);
      return null;
    }
  }, [isActive]);

  const switchCamera = useCallback(async () => {
    if (devices.length < 2) {
      setError("No hay múltiples cámaras disponibles");
      return;
    }

    // Encontrar cámara actual
    const currentTrack = streamRef.current?.getVideoTracks()[0];
    const currentDeviceId = currentTrack?.getSettings().deviceId;
    
    // Encontrar siguiente cámara
    const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    await startCamera(nextDevice.deviceId);
  }, [devices, startCamera]);

  const clearCapturedImage = useCallback(() => {
    setCapturedImage(null);
  }, []);

  return {
    videoRef,
    isActive,
    isSupported,
    devices,
    error,
    capturedImage,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    clearCapturedImage
  };
}
