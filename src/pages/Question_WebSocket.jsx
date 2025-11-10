import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Button,
  Paper,
  Card,
  CardContent,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  Videocam,
  Mic,
  MicOff,
  CheckCircle,
  Refresh,
  Phone,
  VolumeUp,
  Warning,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const pulseAnimation = `
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(245, 87, 108, 0.5);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

const theme = createTheme({
  palette: {
    primary: { main: '#667eea' },
    secondary: { main: '#764ba2' },
    success: { main: '#4a7c59' },
    error: { main: '#f5576c' },
  },
  typography: {
    h4: { fontWeight: 600 },
    h6: { fontWeight: 500 },
  },
});

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  mainBox: {
    width: '100%',
    maxWidth: '1000px',
    height: '90vh',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backdropFilter: 'blur(10px)',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px 30px',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    padding: '30px',
    overflowY: 'auto',
  },
  messagesPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxHeight: '100%',
    overflowY: 'auto',
  },
  messageBubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
    animation: 'fadeIn 0.3s ease',
    wordWrap: 'break-word',
  },
  aiBubble: {
    background: '#667eea',
    color: '#fff',
    marginRight: 'auto',
    maxWidth: '85%',
  },
  userBubble: {
    background: '#f0f0f0',
    color: '#333',
    marginLeft: 'auto',
    maxWidth: '85%',
    borderLeft: '3px solid #667eea',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  videoBox: {
    background: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    aspectRatio: '16/9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    background: '#f5f7fa',
    padding: '15px',
    borderRadius: '12px',
    borderLeft: '4px solid #667eea',
  },
  controlPanel: {
    display: 'flex',
    gap: '10px',
    padding: '20px 30px',
    background: '#f9f9f9',
    borderTop: '1px solid #e0e0e0',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  micButton: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontSize: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
};

export default function AIInterviewPage() {
  const [messages, setMessages] = useState([]);
  const [alert, setAlert] = useState({ show: false, msg: '', severity: 'info' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60);
  const [stats, setStats] = useState({
    questions: 0,
    duration: '0:00',
  });
  const [userTranscript, setUserTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const micStateRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const speechRecognitionRef = useRef(null);
  const { id } = useParams();

  const API_BASE_URL = 'http://localhost:8000';
  const WS_BASE_URL = 'ws://localhost:8000';
  const TARGET_SAMPLE_RATE = 24000;

  // Inject animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = pulseAnimation;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Show alert
  const showAlert = (msg, severity = 'info') => {
    setAlert({ show: true, msg, severity });
    setTimeout(() => setAlert({ show: false, msg: '', severity: 'info' }), 3000);
  };

  // Format time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync mic toggle with processor
  useEffect(() => {
    micStateRef.current = isMicOn;
  }, [isMicOn]);

  // Initialize interview
  useEffect(() => {
    const initialize = async () => {
      try {
        // Get camera and mic
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) videoRef.current.srcObject = stream;

        // Start audio session
        const res = await axios.post(`${API_BASE_URL}/start-audio-stream`, { uuid: id });
        const newSessionId = res.data.sessionId || res.data.session_id;

        if (!newSessionId) throw new Error('No session ID from server');

        setSessionId(newSessionId);

        // Connect WebSocket
        const ws = new WebSocket(`${WS_BASE_URL}/ws/audio-stream/${newSessionId}`);

        ws.onopen = () => {
          setWsConnected(true);
          showAlert('Connected to AI Interviewer', 'success');
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleMessage(data);
          } catch (err) {
            console.error('Message parse error:', err);
          }
        };

        ws.onerror = () => showAlert('Connection error', 'error');
        ws.onclose = () => setWsConnected(false);

        wsRef.current = ws;

        // Initialize audio context
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000,
          latencyHint: 'interactive',
        });

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Initialize Web Speech API for transcription
        initializeSpeechRecognition();

        setIsLoading(false);
        setIsMicOn(true);
        startAudioCapture(stream);

        // Timer
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              endInterview();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
      if (processorRef.current) processorRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle WebSocket messages
  const handleMessage = (data) => {
    if (data.type === 'audio') {
      const audioBytes = base64ToArrayBuffer(data.data);
      audioQueueRef.current.push(audioBytes);
      processAudioQueue();
    } else if (data.type === 'info') {
      if (data.message) {
        setMessages((prev) => [...prev, { type: 'ai', text: data.message }]);
      }
    }
  };

  // Initialize speech recognition for transcribing user input
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
    
    // Start listening when mic is on
    if (isMicOn) {
      recognition.start();
    }

    return recognition;
  };

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
          resolve();
        };

        source.start(0);
        
        // Fallback timeout in case onended doesn't fire
        const duration = audioBuffer.duration;
        timeoutId = setTimeout(() => {
          setIsAISpeaking(false);
          resolve();
        }, (duration * 1000) + 100);
      } catch (err) {
        console.error('Playback error:', err);
        setIsAISpeaking(false);
        resolve();
      }
    });
  };

  // PCM to AudioBuffer
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

  // Start audio capture
  const startAudioCapture = (stream) => {
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
    // Don't connect processor to destination - it interferes with playback
    // processor.connect(audioContextRef.current.destination);
  };

  // Base64 conversion
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

  // End interview
  const endInterview = async () => {
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
      showAlert('Interview completed!', 'success');
    } catch (err) {
      console.error('End error:', err);
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Loading
  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <CircularProgress size={60} sx={{ color: '#fff' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            Initializing Interview...
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Setting up your AI interview session
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Error
  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <Warning sx={{ fontSize: 60, color: '#f5576c', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            Error Initializing Interview
          </Typography>
          <Alert severity="error" sx={{ maxWidth: 500, mt: 2 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            startIcon={<Refresh />}
            sx={{ mt: 2, backgroundColor: '#fff', color: '#667eea' }}
          >
            Retry
          </Button>
        </Box>
      </ThemeProvider>
    );
  }

  // Complete
  if (isComplete) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.loadingContainer}>
          <CheckCircle sx={{ fontSize: 80, color: '#4a7c59', mb: 2 }} />
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
            Interview Complete!
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
            Your responses have been recorded and will be reviewed.
          </Typography>
          <Alert severity="success" sx={{ maxWidth: 500, mt: 3 }}>
            Thank you for completing the AI screening interview.
          </Alert>
        </Box>
      </ThemeProvider>
    );
  }

  // Main UI
  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        {alert.show && (
          <Alert
            severity={alert.severity}
            sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              minWidth: 300,
            }}
          >
            {alert.msg}
          </Alert>
        )}

        <Box sx={styles.mainBox}>
          {/* Header */}
          <Box sx={styles.header}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Mic sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6">AI Interview Session</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={formatTime(timeRemaining)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            />
          </Box>

          {/* Content */}
          <Box sx={styles.content}>
            {/* Left: Chat */}
            <Box sx={styles.messagesPanel}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Conversation
              </Typography>
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 5, opacity: 0.5 }}>
                  <Mic sx={{ fontSize: 50, color: '#999', mb: 2 }} />
                  <Typography>Start speaking to begin</Typography>
                </Box>
              ) : (
                messages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      ...styles.messageBubble,
                      ...(msg.type === 'ai' ? styles.aiBubble : styles.userBubble),
                    }}
                  >
                    {msg.text}
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Right: Video & Status */}
            <Box sx={styles.rightPanel}>
              <Box sx={styles.videoBox}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>

              <Card sx={{ background: '#f5f7fa', border: 'none' }}>
                <CardContent sx={{ pb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <VolumeUp sx={{ fontSize: 18, color: '#667eea' }} />
                    <Typography variant="body2">
                      {isAISpeaking ? '🔊 AI Speaking' : '👂 Listening'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Mic sx={{ fontSize: 18, color: isMicOn ? '#4a7c59' : '#999' }} />
                    <Typography variant="body2">
                      Microphone: {isMicOn ? 'Active' : 'Inactive'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card sx={{ background: '#f5f7fa', border: 'none' }}>
                <CardContent sx={{ pb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Session Info
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                    Session ID: {sessionId ? sessionId.substring(0, 12) : 'N/A'}...
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    Questions: {stats.questions}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Controls */}
          <Box sx={styles.controlPanel}>
            <Button
              variant="contained"
              sx={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: isMicOn
                  ? 'linear-gradient(135deg, #4a7c59 0%, #2d5a3d 100%)'
                  : 'linear-gradient(135deg, #f5576c 0%, #d32f2f 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '30px',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
              onClick={() => setIsMicOn(!isMicOn)}
            >
              {isMicOn ? <Mic /> : <MicOff />}
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<Phone />}
              onClick={endInterview}
              sx={{ alignSelf: 'center' }}
            >
              End Interview
            </Button>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}