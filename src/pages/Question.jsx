import React, { useState, useRef, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Refresh,
  Videocam,
  Mic,
  CheckCircle,
  MicOff,
  VolumeUp,
  Warning,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useParams } from 'react-router-dom';


const theme = createTheme({
  palette: {
    primary: {
      main: '#4a7c59',
    },
    secondary: {
      main: '#2d5a3d',
    },
    success: {
      main: '#4a7c59',
    },
    error: {
      main: '#d32f2f',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
});


const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    height: '100vh',
    width: '100%',
    background: '#ECF4E8',
    padding: 0,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  splitContainer: {
    display: 'flex',
    width: '100%',
    height: '100vh',
  },
  aiSection: {
    flex: 1,
    background: '#CBF3BB',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '40px',
    borderRight: '1px solid rgba(0, 0, 0, 0.08)',
  },
  userSection: {
    flex: 1,
    background: '#ECF4E8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '40px',
  },
  videoContainer: {
    width: '100%',
    maxWidth: '500px',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative',
    marginTop: '20px',
    border: '1px solid rgba(0,0,0,0.08)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  transcriptBox: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '20px',
    minHeight: '150px',
    maxHeight: '200px',
    width: '100%',
    maxWidth: '500px',
    overflowY: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.06)',
  },
  waveformContainer: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    height: '60px',
  },
  waveBar: {
    width: '3px',
    backgroundColor: 'rgba(74, 124, 89, 0.6)',
    borderRadius: '2px',
    transition: 'height 0.15s ease',
  },
  pulsingGlow: {
    opacity: 0.98,
  },
  statusChip: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    minWidth: '100vw',
    gap: 2,
    background: '#ECF4E8',
  },
};


export default function QuestionsPage() {
  const {
    interimTranscript,
    finalTranscript,
    listening,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('warning');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [aiWaveform, setAiWaveform] = useState([]);
  const [userWaveform, setUserWaveform] = useState([]);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  
  // WebSocket and Audio states
  const [wsConnected, setWsConnected] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerIntervalRef = useRef(null);
  
  // WebSocket and Audio refs
  const wsRef = useRef(null);
  const micStateRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const speechRecognitionRef = useRef(null);
  const processorRef = useRef(null);
  
  const { id } = useParams();

  const SILENCE_THRESHOLD = 10000; // 10 seconds
  
  // WebSocket and Audio constants
  const API_BASE_URL = 'http://localhost:8000';
  const WS_BASE_URL = 'ws://localhost:8000';
  const TARGET_SAMPLE_RATE = 16000; // Bedrock expected input sampleRateHertz for audio/lpcm (16 kHz mono 16-bit)
  const PROMPT_NAME = 'INTERVIEW_PROMPT';
  const CONTENT_NAME = 'USER_AUDIO_STREAM';
  const promptNameRef = useRef(PROMPT_NAME);
  const contentNameRef = useRef(CONTENT_NAME);

  // WebSocket and Audio Helper Functions
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const pcmToAudioBuffer = (pcmData, sampleRate, channels) => {
    const numSamples = pcmData.byteLength / 2;
    const audioBuffer = audioContextRef.current.createBuffer(channels, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    const dataView = new DataView(pcmData);

    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      channelData[i] = int16 / 32768.0;
    }

    return audioBuffer;
  };

  const downsampleBuffer = (buffer, fromSampleRate, toSampleRate) => {
    if (fromSampleRate === toSampleRate) {
      return buffer;
    }

    const sampleRateRatio = fromSampleRate / toSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;

      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }

      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  };

 const handleBackendEvents = async (data) => {
  switch (data.type) {
    case "initialized":
      // Backend now auto-handles prompt and audio setup after initialization
      // No need to send deprecated 'promptStart' or 'audioStart'
      console.log("Session initialized and ready");
      break;

    case "audioReady":
      // Backend is ready for audio input (if still used)
      console.log("Backend ready for audio");
      break;

    case "contentStart":
      setIsAISpeaking(true);
      setIsSpeaking(true);
      break;

    case "textOutput":
      setMessages(prev => [...prev, { type: "ai", text: data.text }]);
      break;

    case "audioOutput":
      playBackendAudio(data.audio);
      break;

    case "contentEnd":
      setIsAISpeaking(false);
      setIsSpeaking(false);
      break;

    case "transcription":
      // Add user message from backend transcription
      setMessages(prev => [...prev, { type: "user", text: data.text }]);
      setUserTranscript('');
      break;

    case "streamComplete":
      console.log("Stream completed");
      setIsComplete(true);
      break;

    case "sessionClosed":
      console.log("Session closed by backend");
      setIsComplete(true);
      break;

    case "error":
      console.error("Backend error:", data);
      showAlertMessage(`Backend error: ${data.message || 'Unknown error'}`, 'error');
      break;
  }
};


  const playBackendAudio = async (b64) => {
  const arrayBuf = base64ToArrayBuffer(b64);
  const audioBuffer = pcmToAudioBuffer(arrayBuf, TARGET_SAMPLE_RATE, 1);

  const src = audioContextRef.current.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioContextRef.current.destination);
  src.start(0);
};

 const initializeWebSocket = async () => {
  const ws = new WebSocket(
    `${WS_BASE_URL}/?interviewUuid=${id}`
  );

  ws.onopen = () => {
    setWsConnected(true);
    wsRef.current = ws;

    // Send simple initialization message to match backend expectations
    // Backend will auto-setup prompt, start streaming, and handle audio readiness
    ws.send(JSON.stringify({ type: "initializeConnection" }));
  };

  ws.onmessage = (e) => {
    let data;
    try {
      data = JSON.parse(e.data);
    } catch (err) {
      console.warn('Non-JSON WS message', err);
      return;
    }
    handleBackendEvents(data);
  };

  ws.onclose = () => setWsConnected(false);
  ws.onerror = () => setWsConnected(false);
};


  // Start audio capture for WebSocket
  const startAudioCapture = (stream) => {
    if (!audioContextRef.current) return;
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!micStateRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const inputRate = e.inputBuffer.sampleRate;
      const buffer = e.inputBuffer.getChannelData(0);

      // Downsample
      const ds = downsampleBuffer(buffer, inputRate, TARGET_SAMPLE_RATE);
      const pcm = new Int16Array(ds.length);
      for (let i = 0; i < ds.length; i++) {
        const s = Math.max(-1, Math.min(1, ds[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const base64 = arrayBufferToBase64(pcm.buffer);

      // Sample debug logging (1% of chunks)
      if (Math.random() < 0.01) {
        const first8 = Array.from(new Uint8Array(pcm.buffer).slice(0, 8));
        console.log('[AUDIO_CHUNK]', {
          samples: pcm.length,
          bytes: pcm.byteLength,
          first8,
          inputRate,
          targetRate: TARGET_SAMPLE_RATE
        });
      }

      // Send simple audioInput payload to match backend expectations
      // Backend expects: { type: 'audioInput', audio: base64 }
      wsRef.current.send(JSON.stringify({
        type: 'audioInput',
        audio: base64
      }));
    };


    source.connect(processor);
  };

  // Initialize speech recognition for WebSocket mode
  const initializeSpeechRecognition = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition API not supported');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.language = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscript = '';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update user transcript state with final transcript
      if (finalTranscript && finalTranscript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = finalTranscript;
        setMessages((prev) => {
          // Check if last message is a user message to update it, or add new one
          if (prev.length > 0 && prev[prev.length - 1].type === 'user' && prev[prev.length - 1].isIncomplete) {
            const updated = [...prev];
            updated[updated.length - 1] = { type: 'user', text: finalTranscript.trim(), isIncomplete: false };
            return updated;
          } else {
            return [...prev, { type: 'user', text: finalTranscript.trim(), isIncomplete: false }];
          }
        });
      }

      // Show interim results
      if (interimTranscript && !finalTranscript) {
        setUserTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      finalTranscript = '';
      setUserTranscript('');
    };

    speechRecognitionRef.current = recognition;
    
    return recognition;
  };

  // Sync mic toggle with processor
  useEffect(() => {
    micStateRef.current = isMicOn;
  }, [isMicOn]);

  // Handle mic toggle for speech recognition
  useEffect(() => {
    if (!speechRecognitionRef.current) return;

    if (isMicOn) {
      try {
        speechRecognitionRef.current.start();
      } catch {
        console.log('Speech recognition already started');
      }
    } else {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        console.log('Speech recognition already stopped');
      }
    }
  }, [isMicOn]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle timer expiry
  const handleTimerExpiry = useCallback(() => {
    console.log('Timer expired - stopping interview');
    
    // Stop timer
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Stop WebSocket microphone
    setIsMicOn(false);
    
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop camera
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsRecordingVideo(false);
    
    // Stop TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsAISpeaking(false);
    
    // End WebSocket session if connected
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      endInterviewWebSocket();
    } else {
      // Mark as complete for traditional mode
      setIsComplete(true);
      showAlertMessage('Time expired! Interview completed.', 'warning');
    }
  }, [videoStream, wsConnected]);

  // Timer countdown effect
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer expired
            handleTimerExpiry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [isTimerActive, timeRemaining, handleTimerExpiry]);

  // Initialize camera and recording when component mounts
  useEffect(() => {
    let currentVideoElement = null;
    
    const initializeMediaDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          currentVideoElement = videoRef.current;
        }

        setVideoStream(stream);
        setIsCameraActive(true);
        
        // Start continuous video recording
        startContinuousRecording(stream);
        
        // Initialize audio context for visualization and WebSocket
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: TARGET_SAMPLE_RATE,
          latencyHint: 'interactive',
        });

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Initialize audio visualization
        initializeAudioVisualization(stream);
        
        // Initialize WebSocket connection
        await initializeWebSocket();
        
        // Initialize speech recognition for WebSocket mode
        initializeSpeechRecognition();
        
        // Start audio capture for WebSocket
        startAudioCapture(stream);
        
        // Enable microphone by default
        setIsMicOn(true);
        
        console.log('Camera, WebSocket, and recording initialized successfully');
      } catch (err) {
        console.error('Camera/WebSocket initialization error:', err);
        showAlertMessage(
          'Could not access camera/microphone or connect to AI service. Please allow permissions.',
          'error'
        );
      }
    };

    initializeMediaDevices();

    return () => {
      // Cleanup
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (currentVideoElement && currentVideoElement.srcObject) {
        const tracks = currentVideoElement.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        currentVideoElement.srcObject = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      SpeechRecognition.stopListening();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start continuous video recording
  const startContinuousRecording = (stream) => {
    try {
      const mimeType = getSupportedMimeType();
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000,
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const videoBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Recording segment completed. Size:', videoBlob.size);
        
        // For continuous interview, we don't need question-specific data
        // The conversation is handled by WebSocket

        // Restart recording if not complete and timer not expired
        if (!isComplete && videoStream && timeRemaining > 0) {
          audioChunksRef.current = [];
          mediaRecorderRef.current.start(1000);
        }
      };

      mediaRecorderRef.current.start(1000);
      setIsRecordingVideo(true);
      console.log('Continuous recording started');
    } catch (err) {
      console.error('Recording start error:', err);
      showAlertMessage('Could not start recording', 'error');
    }
  };

  // Initialize audio visualization
  const initializeAudioVisualization = (stream) => {
    try {
      // Reuse existing audioContext to maintain sample rate consistency
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: TARGET_SAMPLE_RATE,
          latencyHint: 'interactive'
        });
      }
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      visualizeAudio();
    } catch (err) {
      console.error('Audio visualization error:', err);
    }
  };

  // Audio visualization loop
  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const draw = () => {
      requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Generate waveform bars (20 bars)
      const bars = [];
      const step = Math.floor(dataArray.length / 20);
      for (let i = 0; i < 20; i++) {
        const value = dataArray[i * step] || 0;
        bars.push(Math.max(5, (value / 255) * 60)); // Scale to 60px max height
      }

      if (isSpeaking) {
        setAiWaveform(bars);
      } else if (isMicOn) {
        setUserWaveform(bars);
      }
    };

    draw();
  };

  // Fetch questions from API
  useEffect(() => {
    // For WebSocket-based interviews, we don't need to fetch questions
    // The backend handles the conversation flow
    if (id) {
      setIsLoading(false);
    } else {
      setError('Invalid interview link. UUID is missing.');
      setIsLoading(false);
    }
  }, [id]);

  // Auto-start interview when WebSocket is connected
  useEffect(() => {
    if (!isLoading && isCameraActive && wsConnected) {
      // Start timer
      setIsTimerActive(true);
      // WebSocket will handle the conversation automatically
    }
  }, [isLoading, isCameraActive, wsConnected]);

  // Check browser support
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      showAlertMessage('Speech recognition not supported in this browser', 'error');
      setError('Speech recognition not supported. Please use Chrome or Edge.');
    }
  }, [browserSupportsSpeechRecognition]);

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  };

  const endInterviewWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send simple stopAudio payload to match backend expectations
      // Drop the raw Bedrock contentEnd event
      wsRef.current.send(JSON.stringify({ type: 'stopAudio' }));
    }
    setIsComplete(true);
  };


  const showAlertMessage = (message, severity = 'warning') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  // Loading state
  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <CircularProgress size={60} sx={{ color: '#4a7c59' }} />
          <Typography variant="h6" sx={{ color: '#2d5a3d', mt: 2, fontWeight: 600 }}>
            Loading Interview...
          </Typography>
          <Typography variant="body2" sx={{ color: '#4a7c59' }}>
            Please wait while we prepare your session
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <Alert severity="error" sx={{ mb: 3, width: '100%', maxWidth: 600 }}>
            {error}
          </Alert>
          <Typography variant="h6" sx={{ color: '#2d5a3d', mb: 2, fontWeight: 600 }}>
            Unable to Start Interview
          </Typography>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            size="large"
            sx={{
              backgroundColor: '#4a7c59',
              '&:hover': {
                backgroundColor: '#2d5a3d',
              },
            }}
          >
            Retry
          </Button>
        </Box>
      </ThemeProvider>
    );
  }

  // Completion state
  if (isComplete) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <CheckCircle sx={{ fontSize: 80, mb: 3, color: '#4a7c59' }} />
          <Typography variant="h4" sx={{ color: '#2d5a3d', mb: 2, fontWeight: 600 }}>
            Interview Complete!
          </Typography>
          <Typography variant="body1" sx={{ color: '#4a7c59', mb: 3 }}>
            {timeRemaining <= 0 
              ? 'Time limit reached. Thank you for your participation.'
              : 'Thank you for completing the AI screening round.'}
          </Typography>
          <Alert severity={timeRemaining <= 0 ? 'warning' : 'success'} sx={{ maxWidth: 600 }}>
            Your responses have been recorded and will be reviewed by our team.
          </Alert>
          {timeRemaining > 0 && (
            <Typography variant="body2" sx={{ color: '#4a7c59', mt: 2 }}>
              Time used: {formatTime(15 * 60 - timeRemaining)} / 15:00
            </Typography>
          )}
        </Box>
      </ThemeProvider>
    );
  }

  // Main interview UI - Split screen
  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        {showAlert && (
          <Alert
            severity={alertSeverity}
            sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              minWidth: '300px',
            }}
          >
            {alertMessage}
          </Alert>
        )}

        <Box sx={styles.splitContainer}>
          {/* AI Section - Left Half */}
          <Box sx={{ ...styles.aiSection, ...(isSpeaking && styles.pulsingGlow) }}>
            <Chip
              label={wsConnected ? "● AI INTERVIEWER (WebSocket)" : "● AI INTERVIEWER"}
              sx={{
                ...styles.statusChip,
                backgroundColor: wsConnected ? '#667eea' : '#4a7c59',
                color: '#ffffff',
                fontWeight: 'bold',
              }}
            />

            <Typography
              variant="h3"
              sx={{
                color: '#2d5a3d',
                fontWeight: 600,
                textAlign: 'center',
                mb: 2,
              }}
            >
              AI Interviewer
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: '#4a7c59',
                textAlign: 'center',
                mb: 3,
                fontWeight: 400,
              }}
            >
              AI Interview in Progress
            </Typography>

            {/* AI Avatar/Icon */}
            <Box
              sx={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '2px solid #4a7c59',
                ...(isSpeaking && {
                  boxShadow: '0 2px 12px rgba(74, 124, 89, 0.4)',
                }),
              }}
            >
              <Mic sx={{ fontSize: 50, color: '#4a7c59' }} />
            </Box>

            {/* Conversation Display */}
            <Box sx={styles.transcriptBox}>
              <Typography variant="subtitle2" sx={{ color: '#4a7c59', mb: 2, fontWeight: 600 }}>
                Conversation:
              </Typography>
              <Box sx={{ maxHeight: '120px', overflowY: 'auto' }}>
                {messages.map((msg, idx) => (
                  <Box key={idx} sx={{ mb: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: msg.type === 'ai' ? '#2d5a3d' : '#4a7c59',
                        fontWeight: msg.type === 'ai' ? 600 : 400,
                        fontStyle: msg.type === 'ai' ? 'normal' : 'italic'
                      }}
                    >
                      <strong>{msg.type === 'ai' ? 'AI:' : 'You:'}</strong> {msg.text}
                    </Typography>
                  </Box>
                ))}
                {messages.length === 0 && (
                  <Typography variant="body2" sx={{ color: '#6b9475', fontStyle: 'italic' }}>
                    Waiting for AI to start the interview...
                  </Typography>
                )}
              </Box>
              {wsConnected && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VolumeUp sx={{ fontSize: 16, color: '#4a7c59' }} />
                  <Typography variant="caption" sx={{ color: '#4a7c59' }}>
                    {isAISpeaking ? 'AI Speaking...' : 'Ready to listen'}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* AI Waveform Visualization */}
            {(isSpeaking || isAISpeaking) && (
              <Box sx={styles.waveformContainer}>
                {aiWaveform.map((height, index) => (
                  <Box
                    key={index}
                    sx={{
                      ...styles.waveBar,
                      height: `${height}px`,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* User Section - Right Half */}
          <Box sx={{ ...styles.userSection, ...(listening && styles.pulsingGlow) }}>
            <Chip
              label={wsConnected 
                ? (isMicOn ? '● LISTENING (WebSocket)' : '● MICROPHONE OFF') 
                : (listening ? '● LISTENING' : '● STANDBY')
              }
              sx={{
                ...styles.statusChip,
                backgroundColor: (wsConnected ? isMicOn : listening) ? '#d32f2f' : '#4a7c59',
                color: '#ffffff',
                fontWeight: 'bold',
              }}
            />

            {/* Timer Display */}
            <Box
              sx={{
                position: 'absolute',
                top: '80px',
                right: '20px',
                backgroundColor: timeRemaining < 60 ? 'rgba(211, 47, 47, 0.9)' : 'rgba(74, 124, 89, 0.9)',
                borderRadius: '8px',
                padding: '12px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 1000,
                minWidth: '120px',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                TIME REMAINING
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  fontSize: '1.8rem',
                }}
              >
                {formatTime(timeRemaining)}
              </Typography>
            </Box>

            <Typography
              variant="h3"
              sx={{
                color: '#2d5a3d',
                fontWeight: 600,
                textAlign: 'center',
                mb: 2,
              }}
            >
              Your Response
            </Typography>

            {/* Video Preview */}
            <Box sx={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={styles.video}
              />
              {isCameraActive && isRecordingVideo && (
                <Chip
                  icon={<Videocam />}
                  label="RECORDING"
                  color="error"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                  }}
                />
              )}
            </Box>

            {/* Transcript Display */}
            <Box sx={styles.transcriptBox}>
              <Typography variant="subtitle2" sx={{ color: '#4a7c59', mb: 1, fontWeight: 600 }}>
                Your Response:
              </Typography>
              <Typography variant="body1" sx={{ color: '#2d5a3d', lineHeight: 1.8 }}>
                {wsConnected ? (
                  // Show current user input
                  <>
                    {userTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        {userTranscript}
                      </span>
                    )}
                    {!userTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        {isMicOn ? 'Listening... Speak your response' : 'Turn on microphone to speak'}
                      </span>
                    )}
                  </>
                ) : (
                  // Fallback for non-WebSocket mode
                  <>
                    {finalTranscript}
                    {interimTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        {interimTranscript}
                      </span>
                    )}
                    {!finalTranscript && !interimTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        Start speaking your answer...
                      </span>
                    )}
                  </>
                )}
              </Typography>
              
              {/* WebSocket microphone control */}
              {wsConnected && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setIsMicOn(!isMicOn)}
                    startIcon={isMicOn ? <Mic /> : <MicOff />}
                    sx={{
                      backgroundColor: isMicOn ? '#4a7c59' : '#d32f2f',
                      '&:hover': {
                        backgroundColor: isMicOn ? '#2d5a3d' : '#b71c1c',
                      },
                    }}
                  >
                    {isMicOn ? 'Mute' : 'Unmute'}
                  </Button>
                  <Typography variant="caption" sx={{ color: '#4a7c59' }}>
                    {isListening ? 'Speech recognition active' : 'Waiting for speech'}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* User Waveform Visualization */}
            {(listening || (wsConnected && isMicOn)) && (
              <Box sx={styles.waveformContainer}>
                {userWaveform.map((height, index) => (
                  <Box
                    key={index}
                    sx={{
                      ...styles.waveBar,
                      height: `${height}px`,
                      backgroundColor: 'rgba(74, 124, 89, 0.6)',
                    }}
                  />
                ))}
              </Box>
            )}

            {/* Interview Status */}
            <Box sx={{ width: '100%', maxWidth: '500px', mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#4a7c59' }}>
                Interview in progress - {formatTime(timeRemaining)} remaining
              </Typography>
            </Box>

            {/* WebSocket Controls */}
            {wsConnected && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={endInterviewWebSocket}
                  sx={{ borderRadius: '20px' }}
                >
                  End Interview
                </Button>
                <Typography variant="caption" sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  color: wsConnected ? '#4a7c59' : '#d32f2f',
                  gap: 0.5
                }}>
                  {wsConnected ? '🟢' : '🔴'} WebSocket {wsConnected ? 'Connected' : 'Disconnected'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}