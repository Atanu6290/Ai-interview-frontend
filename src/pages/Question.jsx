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
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [audioStreamReady, setAudioStreamReady] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(15 * 60);
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
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const audioStreamReadyRef = useRef(false);
  
  const { id } = useParams();

  const SILENCE_THRESHOLD = 10000;
  
  // WebSocket and Audio constants
  const API_BASE_URL = 'http://localhost:8000';
  const WS_BASE_URL = 'ws://localhost:8000';
  const TARGET_SAMPLE_RATE = 16000;

  // Audio Helper Functions
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

  // Play audio with queue management
  const playBackendAudio = async (base64Audio) => {
    try {
      if (!audioContextRef.current) {
        console.error('AudioContext is null');
        return;
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const arrayBuf = base64ToArrayBuffer(base64Audio);
      
      // Nova Sonic outputs 24kHz PCM16
      const audioBuffer = pcmToAudioBuffer(arrayBuf, 24000, 1);

      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Start playing if not already playing
      if (!isPlayingAudioRef.current) {
        playNextAudio();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      setIsAISpeaking(false);
      setIsSpeaking(false);
      return;
    }

    isPlayingAudioRef.current = true;
    setIsAISpeaking(true);
    setIsSpeaking(true);

    try {
      const audioBuffer = audioQueueRef.current.shift();
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create a gain node for volume control
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 1.0; // Full volume
      
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        playNextAudio();
      };
      
      source.start(0);
    } catch (error) {
      console.error('Error in playNextAudio:', error);
      isPlayingAudioRef.current = false;
      setIsAISpeaking(false);
      setIsSpeaking(false);
    }
  };

  const handleBackendEvents = async (data) => {
    console.log('📥 Backend event received:', data.type);
    
    switch (data.type) {
      case "initialized":
        console.log('✅ Session initialized');
        setSessionInitialized(true);
        break;

      case "audioReady":
        console.log('✅ Backend confirmed audio stream ready - processor can now send audio');
        audioStreamReadyRef.current = true;
        setAudioStreamReady(true);
        break;

      case "contentStart":
        if (data.role === 'ASSISTANT') {
          setIsAISpeaking(true);
          setIsSpeaking(true);
        }
        break;

      case "textOutput":
        setMessages(prev => {
          // Check if last message is AI and append to it
          if (prev.length > 0 && prev[prev.length - 1].type === "ai" && prev[prev.length - 1].isIncomplete) {
            const updated = [...prev];
            updated[updated.length - 1].text += data.text;
            return updated;
          } else {
            return [...prev, { type: "ai", text: data.text, isIncomplete: true }];
          }
        });
        break;

      case "audioOutput":
        if (data.content) {
          playBackendAudio(data.content);
        }
        break;

      case "contentEnd":
        if (data.role === 'ASSISTANT') {
          setMessages(prev => {
            if (prev.length > 0 && prev[prev.length - 1].type === "ai") {
              const updated = [...prev];
              updated[updated.length - 1].isIncomplete = false;
              return updated;
            }
            return prev;
          });
        }
        // Don't set isAISpeaking to false yet - audio might still be playing
        break;

      case "transcription":
        setMessages(prev => [...prev, { type: "user", text: data.text }]);
        setUserTranscript('');
        break;

      case "streamComplete":
        setIsComplete(true);
        break;

      case "sessionClosed":
        setIsComplete(true);
        break;

      case "audioStopped":
        audioStreamReadyRef.current = false;
        setAudioStreamReady(false);
        break;

      case "error":
        console.error("Backend error:", data);
        showAlertMessage(`Backend error: ${data.message || 'Unknown error'}`, 'error');
        break;

      default:
        break;
    }
  };

  const initializeWebSocket = async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/?interviewUuid=${id}`);

      ws.onopen = () => {
        setWsConnected(true);
        wsRef.current = ws;

        // Send initialization message
        ws.send(JSON.stringify({ type: "initializeConnection" }));
        
        resolve(ws);
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

      ws.onclose = () => {
        setWsConnected(false);
        setSessionInitialized(false);
        setAudioStreamReady(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
        reject(error);
      };
    });
  };

  // Start audio capture for WebSocket
  const startAudioCapture = async (stream) => {
    if (!audioContextRef.current) {
      console.error('Cannot start audio capture: AudioContext is null');
      return;
    }
    
    // Ensure AudioContext is running
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    console.log('🎙️ Setting up audio capture processor...');
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      console.log('🎵 Audio process event fired!'); // Debug log
      
      if (!micStateRef.current) {
        console.log('⏸️ Mic is off, skipping audio');
        return;
      }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('⚠️ WebSocket not open');
        return;
      }
      if (!audioStreamReadyRef.current) {
        console.log('⏳ Audio stream not ready yet');
        return;
      }

      const inputRate = e.inputBuffer.sampleRate;
      const buffer = e.inputBuffer.getChannelData(0);

      // Downsample to 16kHz
      const ds = downsampleBuffer(buffer, inputRate, TARGET_SAMPLE_RATE);
      const pcm = new Int16Array(ds.length);
      for (let i = 0; i < ds.length; i++) {
        const s = Math.max(-1, Math.min(1, ds[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const base64 = arrayBufferToBase64(pcm.buffer);

      // Debug: Log audio chunk being sent
      console.log(`📤 Sending audio chunk: ${base64.length} bytes (base64)`);

      // Send audio input
      wsRef.current.send(JSON.stringify({
        type: 'audioInput',
        audio: base64
      }));
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination); // CRITICAL: Required for processing to work
    
    console.log('✅ Audio processor connected and ready');
  };

  // Initialize speech recognition for display purposes
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

      // Update user transcript for display
      if (finalTranscript && finalTranscript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = finalTranscript;
        setUserTranscript(finalTranscript.trim());
      } else if (interimTranscript) {
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

  // Handle mic toggle
  const toggleMic = async () => {
    if (!wsConnected || !sessionInitialized) {
      showAlertMessage('Please wait for session to initialize', 'warning');
      return;
    }
    
    // Ensure AudioContext is running (user interaction required)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      console.log('▶️ Resuming AudioContext...');
      await audioContextRef.current.resume();
      console.log(`✅ AudioContext state: ${audioContextRef.current.state}`);
    }

    if (!isMicOn) {
      // Turning mic ON - start audio stream
      try {
        console.log('🎤 Starting audio stream...');
        console.log(`WebSocket state: ${wsRef.current?.readyState}`);
        console.log(`Session initialized: ${sessionInitialized}`);
        
        // Send audioStart message
        wsRef.current.send(JSON.stringify({ type: 'audioStart' }));
        console.log('📤 Sent audioStart message to backend');
        
        // Wait for backend confirmation - poll for audioStreamReady using ref
        console.log('⏳ Waiting for backend audioReady event...');
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max
        
        while (!audioStreamReadyRef.current && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!audioStreamReadyRef.current) {
          console.warn('⚠️ audioReady not received after 3s, but proceeding anyway');
        } else {
          console.log(`✅ Audio stream ready confirmed after ${attempts * 100}ms`);
        }
        
        // Enable microphone
        setIsMicOn(true);
        console.log('✅ Microphone enabled - audio processor should now start sending');
        
        // Start speech recognition for display
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.start();
            console.log('🎙️ Speech recognition started');
          } catch (e) {
            console.log('Speech recognition already running or error:', e.message);
          }
        }
      } catch (error) {
        console.error('❌ Error starting audio:', error);
        showAlertMessage('Failed to start audio stream', 'error');
      }
    } else {
      // Turning mic OFF - stop audio stream
      try {
        console.log('🛑 Stopping audio stream...');
        
        // Disable microphone first
        setIsMicOn(false);
        console.log('⏸️ Microphone disabled');
        
        // Stop speech recognition
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
            console.log('🎙️ Speech recognition stopped');
          } catch {
            // Already stopped
          }
        }
        
        // Send stopAudio message
        wsRef.current.send(JSON.stringify({ type: 'stopAudio' }));
        console.log('📤 Sent stopAudio message to backend');
        
        audioStreamReadyRef.current = false;
        setAudioStreamReady(false);
        console.log('✅ Audio stopped');
      } catch (error) {
        console.error('❌ Error stopping audio:', error);
        showAlertMessage('Failed to stop audio stream', 'error');
      }
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle timer expiry
  const handleTimerExpiry = useCallback(() => {
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    setIsMicOn(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
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
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsAISpeaking(false);
    
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      endInterviewWebSocket();
    } else {
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
        
        // Initialize audio context
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
        
        // Initialize speech recognition
        initializeSpeechRecognition();
        
        // Start audio capture
        startAudioCapture(stream);
      } catch (err) {
        console.error('Initialization error:', err);
        showAlertMessage(
          'Could not access camera/microphone or connect to AI service. Please allow permissions.',
          'error'
        );
      }
    };

    initializeMediaDevices();

    return () => {
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
        if (!isComplete && videoStream && timeRemaining > 0) {
          audioChunksRef.current = [];
          mediaRecorderRef.current.start(1000);
        }
      };

      mediaRecorderRef.current.start(1000);
      setIsRecordingVideo(true);
    } catch (err) {
      console.error('Recording start error:', err);
      showAlertMessage('Could not start recording', 'error');
    }
  };

  // Initialize audio visualization
  const initializeAudioVisualization = (stream) => {
    try {
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

      const bars = [];
      const step = Math.floor(dataArray.length / 20);
      for (let i = 0; i < 20; i++) {
        const value = dataArray[i * step] || 0;
        bars.push(Math.max(5, (value / 255) * 60));
      }

      if (isSpeaking || isAISpeaking) {
        setAiWaveform(bars);
      } else if (isMicOn) {
        setUserWaveform(bars);
      }
    };

    draw();
  };

  // Check if interview link is valid
  useEffect(() => {
    if (id) {
      setIsLoading(false);
    } else {
      setError('Invalid interview link. UUID is missing.');
      setIsLoading(false);
    }
  }, [id]);

  // Auto-start interview when ready
  useEffect(() => {
    if (!isLoading && isCameraActive && wsConnected && sessionInitialized) {
      setIsTimerActive(true);
    }
  }, [isLoading, isCameraActive, wsConnected, sessionInitialized]);

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
      wsRef.current.send(JSON.stringify({ type: 'endSession' }));
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
              label={wsConnected ? "● CONNECTED" : "● CONNECTING..."}
              sx={{
                ...styles.statusChip,
                backgroundColor: wsConnected ? '#4a7c59' : '#d32f2f',
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
              {sessionInitialized ? 'Interview Active' : 'Initializing...'}
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
                    {sessionInitialized ? 'Waiting for AI to start...' : 'Initializing session...'}
                  </Typography>
                )}
              </Box>
              {wsConnected && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VolumeUp sx={{ fontSize: 16, color: '#4a7c59' }} />
                  <Typography variant="caption" sx={{ color: '#4a7c59' }}>
                    {isAISpeaking ? 'AI Speaking...' : 'Ready'}
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
          <Box sx={{ ...styles.userSection, ...(isMicOn && styles.pulsingGlow) }}>
            <Chip
              label={isMicOn ? '● SPEAKING' : '● STANDBY'}
              sx={{
                ...styles.statusChip,
                backgroundColor: isMicOn ? '#d32f2f' : '#4a7c59',
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
                {userTranscript ? (
                  <span style={{ color: '#2d5a3d' }}>{userTranscript}</span>
                ) : (
                  <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                    {isMicOn 
                      ? 'Listening... Speak your response' 
                      : sessionInitialized 
                        ? 'Click "Start Speaking" to respond'
                        : 'Waiting for session to initialize...'}
                  </span>
                )}
              </Typography>
              
              {/* Microphone control */}
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  size="medium"
                  onClick={toggleMic}
                  startIcon={isMicOn ? <Mic /> : <MicOff />}
                  disabled={!sessionInitialized}
                  sx={{
                    backgroundColor: isMicOn ? '#d32f2f' : '#4a7c59',
                    '&:hover': {
                      backgroundColor: isMicOn ? '#b71c1c' : '#2d5a3d',
                    },
                    '&:disabled': {
                      backgroundColor: '#cccccc',
                    },
                  }}
                >
                  {isMicOn ? 'Stop Speaking' : 'Start Speaking'}
                </Button>
                {isListening && (
                  <Typography variant="caption" sx={{ color: '#4a7c59' }}>
                    Recording...
                  </Typography>
                )}
              </Box>
            </Box>

            {/* User Waveform Visualization */}
            {isMicOn && (
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
                {sessionInitialized 
                  ? `Interview in progress - ${formatTime(timeRemaining)} remaining`
                  : 'Initializing interview session...'}
              </Typography>
            </Box>

            {/* Controls */}
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={endInterviewWebSocket}
                disabled={!wsConnected}
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
                {wsConnected ? '🟢' : '🔴'} {wsConnected ? 'Connected' : 'Disconnected'}
              </Typography>
              {sessionInitialized && (
                <Typography variant="caption" sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  color: '#4a7c59',
                  gap: 0.5
                }}>
                  ✓ Session Ready
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}