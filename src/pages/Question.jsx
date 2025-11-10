import React, { useState, useRef, useEffect } from 'react';
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
import axios from 'axios';
import { useParams } from 'react-router-dom';
import generateQuestions from '../Api/generateQuestions';
import getNextQuestion from '../Api/getNextQuestion';


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
    resetTranscript,
    listening,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('warning');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [aiWaveform, setAiWaveform] = useState([]);
  const [userWaveform, setUserWaveform] = useState([]);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [silenceCountdown, setSilenceCountdown] = useState(null);
  
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
  const silenceTimerRef = useRef(null);
  const lastSpeechTimeRef = useRef(Date.now());
  const listeningRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  
  // WebSocket and Audio refs
  const wsRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const micStateRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const speechRecognitionRef = useRef(null);
  const processorRef = useRef(null);
  
  const { id } = useParams();

  const SILENCE_THRESHOLD = 10000; // 10 seconds
  
  // WebSocket and Audio constants
  const API_BASE_URL = 'http://localhost:8000';
  const WS_BASE_URL = 'ws://localhost:8000';
  const TARGET_SAMPLE_RATE = 24000;

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

  // Handle WebSocket messages
  const handleMessage = (data) => {
    if (data.type === 'audio') {
      const audioBytes = base64ToArrayBuffer(data.data);
      audioQueueRef.current.push(audioBytes);
      processAudioQueue();
    } else if (data.type === 'info') {
      if (data.message) {
        setMessages((prev) => [...prev, { type: 'ai', text: data.message }]);
        // Update the current question text with AI response
        if (questions[currentQuestionIndex]) {
          const updatedQuestions = [...questions];
          updatedQuestions[currentQuestionIndex] = {
            ...updatedQuestions[currentQuestionIndex],
            text: data.message
          };
          setQuestions(updatedQuestions);
        }
      }
    }
  };

  // Process audio queue
  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      await playAudio(audioData);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    isPlayingRef.current = false;
  };

  // Play audio
  const playAudio = (pcmData) => {
    return new Promise((resolve) => {
      try {
        setIsAISpeaking(true);
        setIsSpeaking(true);

        const audioBuffer = pcmToAudioBuffer(pcmData, 24000, 1);
        const source = audioContextRef.current.createBufferSource();
        const gainNode = audioContextRef.current.createGain();

        source.buffer = audioBuffer;
        gainNode.gain.value = 0.8;

        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);

        // Resume context if needed
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        let timeoutId;
        source.onended = () => {
          clearTimeout(timeoutId);
          setIsAISpeaking(false);
          setIsSpeaking(false);
          resolve();
        };

        source.start(0);
        
        // Fallback timeout in case onended doesn't fire
        const duration = audioBuffer.duration;
        timeoutId = setTimeout(() => {
          setIsAISpeaking(false);
          setIsSpeaking(false);
          resolve();
        }, (duration * 1000) + 100);
      } catch (err) {
        console.error('Playback error:', err);
        setIsAISpeaking(false);
        setIsSpeaking(false);
        resolve();
      }
    });
  };

  // Initialize WebSocket connection
  const initializeWebSocket = async () => {
    try {
      // Start audio session
      const res = await axios.post(`${API_BASE_URL}/start-audio-stream`, { uuid: id });
      const newSessionId = res.data.sessionId || res.data.session_id;

      if (!newSessionId) throw new Error('No session ID from server');

      setSessionId(newSessionId);

      // Connect WebSocket
      const ws = new WebSocket(`${WS_BASE_URL}/ws/audio-stream/${newSessionId}`);

      ws.onopen = () => {
        setWsConnected(true);
        showAlertMessage('Connected to AI Interviewer', 'success');
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleMessage(data);
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };

      ws.onerror = () => showAlertMessage('WebSocket connection error', 'error');
      ws.onclose = () => setWsConnected(false);

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket initialization error:', err);
      showAlertMessage('Failed to connect to AI service', 'error');
    }
  };

  // Start audio capture for WebSocket
  const startAudioCapture = (stream) => {
    if (!audioContextRef.current) return;
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (isPlayingRef.current) return;
      if (!micStateRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const inputSampleRate = e.inputBuffer.sampleRate;
      let inputData = e.inputBuffer.getChannelData(0);

      if (inputSampleRate !== TARGET_SAMPLE_RATE) {
        inputData = downsampleBuffer(inputData, inputSampleRate, TARGET_SAMPLE_RATE);
      }

      const pcmData = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const base64 = arrayBufferToBase64(pcmData.buffer);

      if (!base64) {
        return;
      }

      const payload = {
        type: 'audio',
        encoding: 'base64',
        format: 'pcm16',
        sampleRate: TARGET_SAMPLE_RATE,
        data: base64,
        chunk: base64,
      };

      wsRef.current.send(JSON.stringify(payload));
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
  const handleTimerExpiry = () => {
    console.log('Timer expired - stopping interview');
    
    // Stop timer
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Stop speech recognition
    stopListening();
    
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
  };

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
  }, [isTimerActive]);

  // Initialize camera and recording when component mounts
  useEffect(() => {
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
        }

        setVideoStream(stream);
        setIsCameraActive(true);
        
        // Start continuous video recording
        startContinuousRecording(stream);
        
        // Initialize audio context for visualization and WebSocket
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000,
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
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
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
  }, []);

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
        
        const questionData = {
          questionId: questions[currentQuestionIndex]?.id,
          question: questions[currentQuestionIndex]?.text,
          category: questions[currentQuestionIndex]?.category,
          timestamp: new Date().toISOString(),
          answer: finalTranscript,
        };

        // try {
        //   await uploadVideo(videoBlob, questionData);
        // } catch (uploadErr) {
        //   console.error('Upload failed:', uploadErr);
        // }

        // Restart recording for next question if not complete and timer not expired
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
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start visualization loop
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

      if (listeningRef.current) {
        setUserWaveform(bars);
      } else if (isSpeaking) {
        setAiWaveform(bars);
      }
    };

    draw();
  };

  // Fetch questions from API
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const payload = { uuid: id };
        const response = await generateQuestions(payload);

        if (response && response.question) {
          const transformedQuestion = {
            id: response.question_number,
            text: response.question,
            category: response.difficulty,
          };

          if (response.sessionId) {
            setSessionId(response.sessionId);
          }

          setQuestions([transformedQuestion]);
          console.log('Question loaded successfully:', transformedQuestion);
        } else {
          throw new Error('No question received from API');
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
        setError(err.message || 'Failed to load questions');
        showAlertMessage('Failed to load questions', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchQuestions();
    } else {
      setError('Invalid interview link. UUID is missing.');
      setIsLoading(false);
    }
  }, [id]);

  // Auto-start question reading when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && !isLoading && isCameraActive) {
      // Start timer
      setIsTimerActive(true);
      
      setTimeout(() => {
        // Use WebSocket if connected, otherwise fallback to TTS
        if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send initial message to start WebSocket interview
          const payload = {
            type: 'start',
            message: 'Begin interview session',
          };
          wsRef.current.send(JSON.stringify(payload));
        } else {
          // Fallback to traditional TTS
          speakQuestion(questions[0].text);
        }
      }, 1000);
    }
  }, [questions, isLoading, isCameraActive, wsConnected]);

  // Check browser support
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      showAlertMessage('Speech recognition not supported in this browser', 'error');
      setError('Speech recognition not supported. Please use Chrome or Edge.');
    }
  }, [browserSupportsSpeechRecognition]);

  // Sync listening state to ref for use in animation frame
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  // Monitor transcript changes and reset silence timer
  useEffect(() => {
    if (listening && (finalTranscript || interimTranscript)) {
      lastSpeechTimeRef.current = Date.now();
      
      // Cancel countdown if user starts speaking again
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        setSilenceCountdown(null);
        console.log('User resumed speaking - countdown cancelled');
      }
      
      resetSilenceTimer();
    }
  }, [finalTranscript, interimTranscript, listening]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Silence detection timer
  const resetSilenceTimer = () => {
    // Clear existing silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    // Clear countdown if it's running
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      setSilenceCountdown(null);
    }

    // Only start new timer if we have some transcript
    if (!finalTranscript.trim() && !interimTranscript.trim()) {
      return;
    }

    silenceTimerRef.current = setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
      if (timeSinceLastSpeech >= SILENCE_THRESHOLD && finalTranscript.trim()) {
        
        // Start countdown from 10 to 0
        let countdown = 10;
        setSilenceCountdown(countdown);
        
        countdownIntervalRef.current = setInterval(() => {
          countdown -= 1;
          setSilenceCountdown(countdown);
          
          if (countdown <= 0) {
            clearInterval(countdownIntervalRef.current);
            setSilenceCountdown(null);
            stopListening();
            moveToNextQuestion();
          }
        }, 1000);
      }
    }, SILENCE_THRESHOLD);
  };

  // Speak question using TTS or WebSocket
  const speakQuestion = (questionText) => {
    if (!questionText) return;

    // If WebSocket is connected, rely on WebSocket audio
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      // WebSocket will handle audio automatically
      setTimeout(() => {
        startListening();
      }, 2000); // Give some time for WebSocket audio to start
      return;
    }

    // Fallback to TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(questionText);
      speech.rate = 0.9;
      speech.pitch = 1.0;
      speech.volume = 1.0;

      speech.onstart = () => {
        setIsSpeaking(true);
        console.log('AI started speaking');
      };

      speech.onend = () => {
        setIsSpeaking(false);
        console.log('AI finished speaking');
        
        setTimeout(() => {
          startListening();
        }, 500);
      };

      speech.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        startListening();
      };

      window.speechSynthesis.speak(speech);
    } else {
      showAlertMessage('Text-to-speech not supported', 'warning');
      startListening();
    }
  };

  // Start listening for user answer (using react-speech-recognition or WebSocket)
  const startListening = () => {
    if (timeRemaining <= 0) return;

    // If WebSocket is connected, enable microphone for real-time audio
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsMicOn(true);
      showAlertMessage('Listening via WebSocket... Speak your answer', 'info');
      return;
    }

    // Fallback to react-speech-recognition
    if (!listening) {
      try {
        resetTranscript();
        lastSpeechTimeRef.current = Date.now();
        SpeechRecognition.startListening({ 
          continuous: true,
          language: 'en-US',
        });
        resetSilenceTimer();
        showAlertMessage('Listening... Speak your answer', 'info');
        console.log('Speech recognition started');
      } catch (err) {
        console.error('Failed to start listening:', err);
        showAlertMessage('Failed to start listening', 'error');
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      setSilenceCountdown(null);
      console.log('Speech recognition stopped');
    }
  };

  // Move to next question
  const moveToNextQuestion = async () => {
    // Check if timer expired
    if (timeRemaining <= 0) {
      handleTimerExpiry();
      return;
    }

    let answer;
    
    // Get answer from appropriate source
    if (wsConnected && messages.length > 0) {
      // Get the last user message from WebSocket
      const lastUserMessage = messages.filter(msg => msg.type === 'user').pop();
      answer = lastUserMessage?.text?.trim() || '[No response]';
    } else {
      // Use traditional speech recognition transcript
      answer = finalTranscript.trim() || '[No response]';
    }
    
    const newAnswer = {
      questionId: questions[currentQuestionIndex].id,
      question: questions[currentQuestionIndex].text,
      category: questions[currentQuestionIndex].category,
      answer: answer,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || id,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    resetTranscript();

    // Stop current recording segment
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // If using WebSocket, send next question request via WebSocket
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'next',
        answer: answer,
        sessionId: sessionId || id,
      };
      wsRef.current.send(JSON.stringify(payload));
      showAlertMessage('Processing your answer...', 'info');
      return;
    }

    // Fallback to traditional API approach
    try {
      const payload = {
        sessionId: sessionId || id,
        answer: answer,
      };

      console.log('Next question payload:', payload);

      const response = await getNextQuestion(payload);
      console.log('Next question response:', response);

      if (response && response.question) {
        const transformedQuestion = {
          id: response.question_number,
          text: response.question,
          category: response.difficulty,
        };

        // Add new question to questions array
        const updatedQuestions = [...questions, transformedQuestion];
        setQuestions(updatedQuestions);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        
        showAlertMessage('Moving to next question', 'info');
        
        // Speak next question after a brief pause
        setTimeout(() => {
          speakQuestion(transformedQuestion.text);
        }, 1500);
      } else {
        // No more questions - interview complete
        setIsComplete(true);
        stopListening();
        showAlertMessage('Interview completed!', 'success');
      }
    } catch (err) {
      console.error('Error fetching next question:', err);
      // Fallback: complete the interview if API fails
      setIsComplete(true);
      stopListening();
      showAlertMessage('Interview completed!', 'success');
    }
  };

  // Upload video
  // const uploadVideo = async (videoBlob, questionData) => {
  //   try {
  //     const formData = new FormData();
  //     const timestamp = new Date().getTime();
  //     formData.append('video', videoBlob, `interview-q${questionData.questionId}-${timestamp}.webm`);
  //     formData.append('questionId', questionData.questionId);
  //     formData.append('questionText', questionData.question);
  //     formData.append('category', questionData.category);
  //     formData.append('sessionId', sessionId || id);
  //     formData.append('uuid', id);
  //     formData.append('timestamp', questionData.timestamp);
  //     formData.append('answer', questionData.answer);

  //     const response = await axios.post('/api/upload-interview-video', formData, {
  //       headers: { 'Content-Type': 'multipart/form-data' },
  //     });

  //     console.log('Video uploaded successfully:', response.data);
  //     return response.data;
  //   } catch (err) {
  //     console.error('Video upload error:', err);
  //     throw err;
  //   }
  // };

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

  // End interview function for WebSocket mode
  const endInterviewWebSocket = async () => {
    try {
      audioQueueRef.current = [];
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
        wsRef.current.close();
      }
      if (sessionId) {
        await axios.post(`${API_BASE_URL}/end-audio-stream/${sessionId}`);
      }
      setIsComplete(true);
      showAlertMessage('Interview completed!', 'success');
    } catch (err) {
      console.error('End interview error:', err);
      setIsComplete(true);
      showAlertMessage('Interview completed!', 'success');
    }
  };

  const showAlertMessage = (message, severity = 'warning') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const retryFetchQuestions = () => {
    window.location.reload();
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
  if (error || questions.length === 0) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <Alert severity="error" sx={{ mb: 3, width: '100%', maxWidth: 600 }}>
            {error || 'No questions available'}
          </Alert>
          <Typography variant="h6" sx={{ color: '#2d5a3d', mb: 2, fontWeight: 600 }}>
            Unable to Load Questions
          </Typography>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={retryFetchQuestions}
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
              Question {currentQuestionIndex + 1} of {questions.length}
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

            {/* Question Display */}
            <Box sx={styles.transcriptBox}>
              {questions[currentQuestionIndex]?.category && (
                <Chip
                  label={questions[currentQuestionIndex].category}
                  sx={{
                    mb: 2,
                    backgroundColor: '#CBF3BB',
                    color: '#2d5a3d',
                    fontWeight: 600,
                    border: '1px solid #4a7c59',
                  }}
                  size="small"
                />
              )}
              <Typography variant="h6" sx={{ color: '#2d5a3d', lineHeight: 1.6 }}>
                {/* Show the latest AI message if WebSocket is connected, otherwise show traditional question */}
                {wsConnected && messages.length > 0 
                  ? messages.filter(msg => msg.type === 'ai').pop()?.text || questions[currentQuestionIndex]?.text
                  : questions[currentQuestionIndex]?.text
                }
              </Typography>
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
                Your Answer:
              </Typography>
              <Typography variant="body1" sx={{ color: '#2d5a3d', lineHeight: 1.8 }}>
                {wsConnected ? (
                  // Show WebSocket conversation
                  <>
                    {messages.filter(msg => msg.type === 'user').map((msg, idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        {msg.text}
                      </div>
                    ))}
                    {userTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        {userTranscript}
                      </span>
                    )}
                    {messages.filter(msg => msg.type === 'user').length === 0 && !userTranscript && (
                      <span style={{ color: '#6b9475', fontStyle: 'italic' }}>
                        {isMicOn ? 'Start speaking your answer...' : 'Turn on microphone to speak'}
                      </span>
                    )}
                  </>
                ) : (
                  // Show traditional speech recognition
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

            {/* Silence Countdown Timer */}
            {silenceCountdown !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  backgroundColor: 'rgba(211, 47, 47, 0.85)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(211, 47, 47, 0.3)',
                  zIndex: 1000,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                  }}
                >
                  {silenceCountdown}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#ffffff',
                    fontSize: '0.75rem',
                  }}
                >
                  sec will auto-submit due to silence
                </Typography>
              </Box>
            )}

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

            {/* Progress Bar */}
            <Box sx={{ width: '100%', maxWidth: '500px', mt: 3 }}>
              <LinearProgress
                variant="determinate"
                value={((currentQuestionIndex + 1) / questions.length) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0,0,0,0.08)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#4a7c59',
                  },
                }}
              />
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
