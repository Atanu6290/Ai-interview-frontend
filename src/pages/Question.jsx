import React, { useState, useRef, useEffect, useCallback } from 'react';
import SpeechRecognition from 'react-speech-recognition';
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
    justifyContent: 'flex-start',
    position: 'relative',
    padding: '30px 40px',
    borderRight: '1px solid rgba(0, 0, 0, 0.08)',
  },
  userSection: {
    flex: 1,
    background: '#ECF4E8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    padding: '40px',
  },
  videoContainer: {
    width: '100%',
    maxWidth: '650px',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'relative',
    marginTop: '30px',
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
    minHeight: '240px',
    maxHeight: '500px',
    width: '100%',
    maxWidth: '554px',
    overflowY: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.06)',
  },
  aiTranscriptBox: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '24px',
    minHeight: '400px',
    maxHeight: '400px',
    width: '100%',
    maxWidth: '600px',
    overflowY: 'auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
    transition: 'height 0.25s ease-out',
  },
  pulsingGlow: {
    opacity: 0.98,
    transition: 'all 0.3s ease-in-out',
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
  messageContainer: {
    transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
  },
};

export default function QuestionsPage() {
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
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userTranscript, setUserTranscript] = useState('');
  const [isMicOn, setIsMicOn] = useState(false);

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(7 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // UI state for smooth transitions
  const [uiState, setUiState] = useState({
    isTransitioning: false,
    lastAction: null
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // WebSocket and Audio refs
  const wsRef = useRef(null);
  const micStateRef = useRef(false);
  const speechRecognitionRef = useRef(null);
  const processorRef = useRef(null);
  
  // Enhanced audio queue with better management
  const audioQueueRef = useRef({
    queue: [],
    isPlaying: false,
    currentSource: null,
    volume: 1.0,
    lastPlayTime: 0,
    bufferQueue: [], // Store raw audio buffers for concatenation
    isBuffering: false,
    bufferTimeout: null
  });
  
  const audioStreamReadyRef = useRef(false);
  const messagesEndRef = useRef(null);
  
  // Message update debouncing
  const messageUpdateRef = useRef({
    pendingUpdate: null,
    timeoutId: null,
    lastMessageTime: 0
  });

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

  // Concatenate audio buffers for smoother playback
  const concatenateAudioBuffers = (buffers) => {
    if (!audioContextRef.current || buffers.length === 0) return null;

    // All buffers should have the same sample rate and channels
    const sampleRate = buffers[0].sampleRate;
    const numberOfChannels = buffers[0].numberOfChannels;
    
    // Calculate total length
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    
    // Create a new buffer with the total length
    const concatenated = audioContextRef.current.createBuffer(
      numberOfChannels,
      totalLength,
      sampleRate
    );
    
    // Copy data from all buffers
    let offset = 0;
    for (const buffer of buffers) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const outputData = concatenated.getChannelData(channel);
        const inputData = buffer.getChannelData(channel);
        outputData.set(inputData, offset);
      }
      offset += buffer.length;
    }
    
    return concatenated;
  };

  // Enhanced audio playback with buffering and smooth transitions
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
      const audioBuffer = pcmToAudioBuffer(arrayBuf, 24000, 1);

      // Add to buffer queue
      audioQueueRef.current.bufferQueue.push(audioBuffer);

      console.log(`🎵 Added audio to buffer queue, size: ${audioQueueRef.current.bufferQueue.length}`);

      // Clear existing buffer timeout
      if (audioQueueRef.current.bufferTimeout) {
        clearTimeout(audioQueueRef.current.bufferTimeout);
      }

      // Set timeout to flush buffer after 80ms of no new audio (reduced from 150ms)
      audioQueueRef.current.bufferTimeout = setTimeout(() => {
        flushAudioBuffer();
      }, 80);

      // If we have enough buffered data, flush immediately
      if (audioQueueRef.current.bufferQueue.length >= 2) {
        clearTimeout(audioQueueRef.current.bufferTimeout);
        audioQueueRef.current.bufferTimeout = null;
        flushAudioBuffer();
      }
    } catch (error) {
      console.error('Error buffering audio:', error);
    }
  };

  const flushAudioBuffer = () => {
    if (audioQueueRef.current.bufferQueue.length === 0) {
      return;
    }

    // Clear buffer timeout
    if (audioQueueRef.current.bufferTimeout) {
      clearTimeout(audioQueueRef.current.bufferTimeout);
      audioQueueRef.current.bufferTimeout = null;
    }

    console.log(`🔊 Flushing ${audioQueueRef.current.bufferQueue.length} audio chunks...`);

    // Concatenate all buffered audio chunks
    const concatenatedBuffer = concatenateAudioBuffers(audioQueueRef.current.bufferQueue);
    
    if (concatenatedBuffer) {
      // Add to playback queue
      audioQueueRef.current.queue.push({
        buffer: concatenatedBuffer,
        timestamp: Date.now()
      });

      console.log(`✅ Created concatenated buffer of ${concatenatedBuffer.duration.toFixed(2)}s, queue size: ${audioQueueRef.current.queue.length}`);
      
      // Clear buffer queue
      audioQueueRef.current.bufferQueue = [];

      // Start playing if not already playing
      if (!audioQueueRef.current.isPlaying) {
        console.log(`▶️ Starting audio playback...`);
        playNextAudio();
      }
    }
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.queue.length === 0) {
      console.log(`⏹️ No more audio in queue, stopping playback`);
      audioQueueRef.current.isPlaying = false;
      audioQueueRef.current.currentSource = null;
      smoothSetIsSpeaking(false);
      setIsAISpeaking(false);
      return;
    }

    audioQueueRef.current.isPlaying = true;
    audioQueueRef.current.lastPlayTime = Date.now();
    setIsAISpeaking(true);
    smoothSetIsSpeaking(true);

    try {
      const audioItem = audioQueueRef.current.queue.shift();
      
      console.log(`▶️ Playing audio buffer (${audioItem.buffer.duration.toFixed(2)}s), remaining in queue: ${audioQueueRef.current.queue.length}`);
      
      // Stop current source if exists
      if (audioQueueRef.current.currentSource) {
        try {
          audioQueueRef.current.currentSource.stop();
          audioQueueRef.current.currentSource.disconnect();
        } catch {
          // Ignore errors from already stopped sources
        }
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioItem.buffer;

      // Create gain node for volume control (no fade effects)
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = audioQueueRef.current.volume;

      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      source.onended = () => {
        console.log(`✅ Audio chunk finished playing`);
        // Check if there are more items to play
        if (audioQueueRef.current.queue.length > 0) {
          playNextAudio();
        } else {
          // Check if there are buffered items waiting
          setTimeout(() => {
            if (audioQueueRef.current.bufferQueue.length > 0) {
              console.log(`🔄 Flushing remaining buffered chunks...`);
              flushAudioBuffer();
            } else {
              console.log(`🏁 All audio playback complete`);
              audioQueueRef.current.isPlaying = false;
              audioQueueRef.current.currentSource = null;
              smoothSetIsSpeaking(false);
              setIsAISpeaking(false);
            }
          }, 100); // Small delay to allow for any incoming chunks
        }
      };

      source.onerror = (error) => {
        console.error('❌ Audio source error:', error);
        // Continue with next audio despite error
        setTimeout(() => playNextAudio(), 50);
      };

      source.start(0);
      audioQueueRef.current.currentSource = source;
      console.log(`🎵 Audio started successfully`);
    } catch (error) {
      console.error('❌ Error in playNextAudio:', error);
      audioQueueRef.current.isPlaying = false;
      smoothSetIsSpeaking(false);
      setIsAISpeaking(false);
      
      // Try to recover
      setTimeout(() => playNextAudio(), 100);
    }
  };

  // Stop audio playback gracefully
  const stopAudioPlayback = () => {
    // Clear buffer timeout
    if (audioQueueRef.current.bufferTimeout) {
      clearTimeout(audioQueueRef.current.bufferTimeout);
      audioQueueRef.current.bufferTimeout = null;
    }

    if (audioQueueRef.current.currentSource) {
      try {
        audioQueueRef.current.currentSource.stop();
        audioQueueRef.current.currentSource.disconnect();
        audioQueueRef.current.currentSource = null;
      } catch {
        // Ignore errors from already stopped sources
      }
    }
    
    // Clear queues
    audioQueueRef.current.queue = [];
    audioQueueRef.current.bufferQueue = [];
    audioQueueRef.current.isPlaying = false;
  };

  // Enhanced interruption detection
  const checkAndCleanInterruptedText = (text) => {
    if (!text) return { isInterrupted: false, cleanText: text };
    
    // More comprehensive interruption patterns
    const interruptedPatterns = [
      /\{\s*"?\s*interrupted\s*"?\s*:\s*"?true"?\s*\}/gi,
      /\{\s*"?\s*ïnturpted\s*"?\s*:\s*"?true"?\s*\}/gi,
      /\{\s*interrupted\s*:\s*true\s*\}/gi,
      /\{\s*"interrupted"\s*:\s*"true"\s*\}/gi,
      /\[interrupted\]/gi,
      /\(interrupted\)/gi,
      /\binterrupted\b/gi,
    ];
    
    let isInterrupted = false;
    let cleanText = text;
    
    for (const pattern of interruptedPatterns) {
      const matches = cleanText.match(pattern);
      if (matches) {
        isInterrupted = true;
        cleanText = cleanText.replace(pattern, '').trim();
        console.log(`🚫 Found interruption pattern: ${pattern}, matches:`, matches);
      }
    }
    
    // Additional check for very short texts that might be artifacts
    if (cleanText.length < 3 && text.length > cleanText.length) {
      isInterrupted = true;
    }
    
    return { isInterrupted, cleanText };
  };

  // Smooth state transitions
  const smoothSetIsSpeaking = (value) => {
    setUiState(prev => ({ ...prev, isTransitioning: true }));
    setIsSpeaking(value);
    
    // Small delay to allow CSS transitions to complete
    setTimeout(() => {
      setUiState(prev => ({ ...prev, isTransitioning: false }));
    }, 300);
  };

  // Debounced message updates for smoother UI
  const debouncedSetMessages = useCallback((updateFn) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - messageUpdateRef.current.lastMessageTime;
    
    // If updates are coming too fast, batch them
    if (timeSinceLastUpdate < 100) {
      if (messageUpdateRef.current.timeoutId) {
        clearTimeout(messageUpdateRef.current.timeoutId);
      }
      
      messageUpdateRef.current.pendingUpdate = updateFn;
      messageUpdateRef.current.timeoutId = setTimeout(() => {
        if (messageUpdateRef.current.pendingUpdate) {
          setMessages(messageUpdateRef.current.pendingUpdate);
          messageUpdateRef.current.pendingUpdate = null;
          messageUpdateRef.current.lastMessageTime = Date.now();
        }
      }, 50);
    } else {
      // Normal update
      setMessages(updateFn);
      messageUpdateRef.current.lastMessageTime = now;
    }
  }, []);

  const handleBackendEvents = async (data) => {
    console.log('📥 Backend event received:', data.type);

    // Enhanced interruption detection at event level
    if (data.interrupted === true || data.interrupted === "True" || data.interrupted === "true") {
      console.log('🚫 Event marked as interrupted - ignoring completely');
      return;
    }

    switch (data.type) {
      case "initialized":
        console.log('✅ Session initialized');
        setSessionInitialized(true);
        break;

      case "audioReady":
        console.log('✅ Backend confirmed audio stream ready');
        audioStreamReadyRef.current = true;
        
        if (timeRemaining < 60 && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log('⏱️ Less than 60 seconds remaining - notifying backend to wrap up');
          wsRef.current.send(JSON.stringify({ 
            type: 'wrapUpInterview',
            message: 'Time is running out, please conclude the interview'
          }));
        }
        break;

      case "contentStart":
        if (data.role === 'ASSISTANT') {
          // Stop any ongoing audio when new content starts
          stopAudioPlayback();
          
          debouncedSetMessages(prev => {
            if (prev.length > 0 && prev[prev.length - 1].type === 'user' && prev[prev.length - 1].isIncomplete) {
              const updated = [...prev];
              updated[updated.length - 1].isIncomplete = false;
              console.log('✅ Marked user message as complete (AI started)');
              return updated;
            }
            return prev;
          });

          setUserTranscript('');
          setIsAISpeaking(true);
          smoothSetIsSpeaking(true);
        }
        break;

      case "textOutput": {
        const textContent = data.text || data.content || '';

        if (!textContent) {
          console.warn('Received textOutput with no text content:', data);
          break;
        }

        const { isInterrupted, cleanText } = checkAndCleanInterruptedText(textContent);
        
        if (isInterrupted) {
          console.log('🚫 Detected interrupted flag in text - discarding message');
          debouncedSetMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.type === "ai" && lastMsg.isIncomplete) {
              console.log('🗑️ Removing incomplete interrupted AI message');
              return prev.slice(0, -1);
            }
            return prev;
          });
          break;
        }

        console.log(`📝 textOutput: role=${data.role || 'unknown'}, text="${cleanText.substring(0, 50)}..."`);

        if (data.role === 'USER') {
          debouncedSetMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.type === 'user' && lastMsg.text === cleanText) {
              return prev;
            }
            return [...prev, { type: "user", text: cleanText }];
          });
          setUserTranscript(cleanText);
          break;
        }

        if (data.role !== 'ASSISTANT' && data.role !== undefined) {
          break;
        }

        debouncedSetMessages(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === "ai" && prev[prev.length - 1].isIncomplete) {
            const updated = [...prev];
            const currentText = updated[updated.length - 1].text || '';

            // Skip exact duplicate
            if (currentText === cleanText) {
              console.log('⚠️ Skipping exact duplicate message');
              return prev;
            }

            // Skip if new text is already contained in current text
            if (currentText.includes(cleanText) && cleanText.length > 10) {
              console.log('⚠️ Skipping message already contained in current text');
              return prev;
            }

            // Skip if already at the end (redundant chunk)
            if (currentText.endsWith(cleanText) && cleanText.length > 5) {
              console.log('⚠️ Skipping redundant chunk at end');
              return prev;
            }

            // Check if current text is contained in new text (backend sending full message)
            if (cleanText.includes(currentText) && currentText.length > 10) {
              console.log('🔄 Replacing with full message from backend');
              updated[updated.length - 1].text = cleanText;
              return updated;
            }

            // Append new text chunk
            console.log(`✅ Appending new chunk (${cleanText.length} chars)`);
            updated[updated.length - 1].text = currentText + cleanText;
            return updated;
          }

          // Start new AI message
          console.log('🆕 Starting new AI message');
          return [...prev, { type: "ai", text: cleanText, isIncomplete: true }];
        });
        break;
      }

      case "audioOutput":
        if (data.content) {
          playBackendAudio(data.content);
        }
        break;

      case "contentEnd":
        if (data.role === 'ASSISTANT') {
          debouncedSetMessages(prev => {
            if (prev.length > 0 && prev[prev.length - 1].type === "ai" && prev[prev.length - 1].isIncomplete) {
              const updated = [...prev];
              updated[updated.length - 1].isIncomplete = false;
              return updated;
            }
            return prev;
          });
        }
        break;

      case "transcription":
        debouncedSetMessages(prev => {
          const userText = data.text || '';
          if (!userText) return prev;

          console.log(`📝 User transcription received: "${userText}"`);

          const lastMsg = prev[prev.length - 1];

          if (lastMsg && lastMsg.type === 'user') {
            if (lastMsg.isIncomplete !== false) {
              const updated = [...prev];
              const currentText = updated[updated.length - 1].text || '';

              // Skip if exact duplicate
              if (currentText.trim() === userText.trim()) {
                console.log('⚠️ Skipping duplicate user transcription');
                return prev;
              }

              // If new text contains current text, replace with full version
              if (userText.includes(currentText) && currentText.length > 5) {
                console.log('🔄 Replacing user message with full transcription');
                updated[updated.length - 1].text = userText;
                updated[updated.length - 1].isIncomplete = true;
                return updated;
              }

              // Append new chunk with space (only if not already included)
              if (!currentText.includes(userText)) {
                console.log('✅ Appending to user message');
                updated[updated.length - 1].text = currentText ? currentText + ' ' + userText : userText;
                updated[updated.length - 1].isIncomplete = true;
                return updated;
              }

              console.log('⚠️ Text already included, skipping');
              return prev;
            }
          }

          console.log('🆕 Starting new user message');
          return [...prev, { type: "user", text: userText, isIncomplete: true }];
        });
        setUserTranscript('');
        break;

      case "streamComplete":
        console.log('✅ Stream completed');
        if (isMicOn) {
          stopStreaming();
        }
        break;

      case "sessionClosed":
        console.log('✅ Session closed by server');
        setIsComplete(true);
        break;

      case "audioStopped":
        console.log('✅ Audio stopped by server');
        audioStreamReadyRef.current = false;
        break;

      case "error":
        console.error('❌ Backend error:', data.message);
        showAlertMessage(`Backend error: ${data.message}`, 'error');
        break;

      default:
        console.warn(`Unhandled event type: ${data.type}`);
        break;
    }
  };

  // Enhanced WebSocket with reconnection
  const initializeWebSocket = async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/?interviewUuid=${id}`);
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;

      const setupReconnection = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            console.log(`🔄 Attempting reconnect ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
            initializeWebSocket().then(resolve).catch(reject);
          }, 2000 * (reconnectAttempts + 1));
          reconnectAttempts++;
        }
      };

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setWsConnected(true);
        wsRef.current = ws;
        reconnectAttempts = 0;

        const sendInit = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "initializeConnection" }));
          }
        };
        
        setTimeout(sendInit, 100);
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
        
        // Use requestAnimationFrame for smoother UI updates
        requestAnimationFrame(() => {
          handleBackendEvents(data);
        });
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        setWsConnected(false);
        setSessionInitialized(false);
        audioStreamReadyRef.current = false;
        
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          setupReconnection();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
        
        if (reconnectAttempts === 0) {
          reject(error);
        }
      };
    });
  };

  // Start audio capture for WebSocket
  const startAudioCapture = async (stream) => {
    if (!audioContextRef.current) {
      console.error('Cannot start audio capture: AudioContext is null');
      return;
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    console.log('🎙️ Setting up audio capture processor...');

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);

    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!micStateRef.current) {
        return;
      }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      if (!audioStreamReadyRef.current) {
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

      // Send audio input
      wsRef.current.send(JSON.stringify({
        type: 'audioInput',
        audio: base64
      }));
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
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

    let currentSessionTranscript = '';

    recognition.onstart = () => {
      currentSessionTranscript = '';
      console.log('🎤 Speech recognition started - new session');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let sessionFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          sessionFinalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (sessionFinalTranscript) {
        currentSessionTranscript += sessionFinalTranscript;
      }

      const displayText = currentSessionTranscript + interimTranscript;
      setUserTranscript(displayText.trim());
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      currentSessionTranscript = '';
      setUserTranscript('');
      console.log('🎤 Speech recognition ended - clearing current session');
    };

    speechRecognitionRef.current = recognition;
    return recognition;
  };

  // Stop streaming function
  const stopStreaming = () => {
    setIsMicOn(false);
    micStateRef.current = false;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stopAudio' }));
    }
    
    stopAudioPlayback();
    
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
  };

  // Sync mic toggle with processor
  useEffect(() => {
    micStateRef.current = isMicOn;
  }, [isMicOn]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle timer expiry
  const handleTimerExpiry = useCallback(() => {
    setIsTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (isMicOn) {
      setIsMicOn(false);
      micStateRef.current = false;
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stopAudio' }));
      }
      
      stopAudioPlayback();
      
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
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
    smoothSetIsSpeaking(false);
    setIsAISpeaking(false);

    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      endInterviewWebSocket();
    } else {
      setIsComplete(true);
      showAlertMessage('Time expired! Interview completed.', 'warning');
    }
  }, [videoStream, wsConnected, isMicOn]);

  // Timer countdown effect
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (!prev || isNaN(prev) || prev <= 0) {
            handleTimerExpiry();
            return 0;
          }
          if (prev <= 1) {
            handleTimerExpiry();
            return 0;
          }
          
          const newTime = prev - 1;
          
          if (newTime === 60 && wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('⏱️ 60 seconds remaining - notifying backend to wrap up');
            wsRef.current.send(JSON.stringify({ 
              type: 'wrapUpInterview',
              message: 'One minute remaining, please conclude the interview without asking new questions'
            }));
          }
          
          return newTime;
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

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Check if interview link is valid
  useEffect(() => {
    if (id) {
      setIsLoading(false);
    } else {
      setError('Invalid interview link. UUID is missing.');
      setIsLoading(false);
    }
  }, [id]);

  // Auto-start interview and microphone when ready
  useEffect(() => {
    const startMicAutomatically = async () => {
      if (!isLoading && isCameraActive && wsConnected && sessionInitialized && !isMicOn) {
        setIsTimerActive(true);
        
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          console.log('▶️ Resuming AudioContext...');
          await audioContextRef.current.resume();
          console.log(`✅ AudioContext state: ${audioContextRef.current.state}`);
        }

        try {
          console.log('🎤 Auto-starting audio stream...');
          console.log(`WebSocket state: ${wsRef.current?.readyState}`);
          console.log(`Session initialized: ${sessionInitialized}`);

          wsRef.current.send(JSON.stringify({ type: 'audioStart' }));
          console.log('📤 Sent audioStart message to backend');

          let attempts = 0;
          const maxAttempts = 30;

          while (!audioStreamReadyRef.current && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }

          if (!audioStreamReadyRef.current) {
            console.warn('⚠️ audioReady not received after 3s, but proceeding anyway');
          } else {
            console.log(`✅ Audio stream ready confirmed after ${attempts * 100}ms`);
          }

          setIsMicOn(true);
          console.log('✅ Microphone auto-started - audio processor should now start sending');

          if (speechRecognitionRef.current) {
            try {
              speechRecognitionRef.current.start();
              console.log('🎙️ Speech recognition started');
            } catch (e) {
              console.log('Speech recognition already running or error:', e.message);
            }
          }
        } catch (error) {
          console.error('❌ Error auto-starting audio:', error);
          showAlertMessage('Failed to start audio stream', 'error');
        }
      }
    };

    startMicAutomatically();
  }, [isLoading, isCameraActive, wsConnected, sessionInitialized, isMicOn]);

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
              Time used: {formatTime(2 * 60 - timeRemaining)} / 07:00
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
                mb: 1,
              }}
            >
              AI Interviewer
            </Typography>

            <Typography
              variant="h6"
              sx={{
                color: '#4a7c59',
                textAlign: 'center',
                mb: 2,
                fontWeight: 400,
              }}
            >
              {sessionInitialized ? 'Interview Active' : 'Initializing...'}
            </Typography>

            {/* AI Avatar/Icon with Animated Effect */}
            <Box
              sx={{
                position: 'relative',
                width: '140px',
                height: '140px',
                mb: 3,
              }}
            >
              {/* Outer glow ring - animates when speaking */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  border: '2px solid rgba(74, 124, 89, 0.3)',
                  ...(isSpeaking && {
                    animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    '@keyframes pulse-ring': {
                      '0%, 100%': {
                        transform: 'translate(-50%, -50%) scale(1)',
                        opacity: 1,
                      },
                      '50%': {
                        transform: 'translate(-50%, -50%) scale(1.2)',
                        opacity: 0.5,
                      },
                    },
                  }),
                }}
              />

              {/* Middle glow ring */}
              {isSpeaking && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '2px solid rgba(74, 124, 89, 0.5)',
                    animation: 'pulse-ring-middle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.3s',
                    '@keyframes pulse-ring-middle': {
                      '0%, 100%': {
                        transform: 'translate(-50%, -50%) scale(1)',
                        opacity: 1,
                      },
                      '50%': {
                        transform: 'translate(-50%, -50%) scale(1.15)',
                        opacity: 0.3,
                      },
                    },
                  }}
                />
              )}

              {/* Main microphone circle */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: isSpeaking
                    ? '#4a7c59'
                    : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isSpeaking
                    ? '0 0 30px rgba(74, 124, 89, 0.6)'
                    : '0 2px 8px rgba(0,0,0,0.1)',
                  border: '2px solid #4a7c59',
                  transition: 'all 0.3s ease',
                }}
              >
                <Mic
                  sx={{
                    fontSize: 50,
                    color: isSpeaking ? '#ffffff' : '#4a7c59',
                    ...(isSpeaking && {
                      animation: 'pulse-icon 1s ease-in-out infinite',
                      '@keyframes pulse-icon': {
                        '0%, 100%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.1)' },
                      },
                    }),
                  }}
                />
              </Box>
            </Box>

            {/* Conversation Display - Chat Style with Larger Size */}
            <Box sx={styles.aiTranscriptBox}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#4a7c59',
                  mb: 2,
                  fontWeight: 600,
                }}
              >
                Conversation:
              </Typography>
              <Box sx={{ maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: 1.5, paddingTop:"2px", paddingBottom:"2px"}}>
                {messages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.type === 'ai' ? 'flex-start' : 'flex-end',
                      width: '100%',
                      mb: 0.5
                    }}
                  >
                    <Box
                      sx={{
                        ...styles.messageContainer,
                        maxWidth: '85%',
                        backgroundColor: msg.type === 'ai' ? '#e8f5e9' : '#e3f2fd',
                        borderRadius: msg.type === 'ai'
                          ? '4px 12px 12px 12px'
                          : '12px 4px 12px 12px',
                        padding: '10px 14px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: msg.type === 'ai' ? '#2d5a3d' : '#1565c0',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          display: 'block',
                          mb: 0.3
                        }}
                      >
                        {msg.type === 'ai' ? 'AI Interviewer' : 'You'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#1a1a1a',
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          wordWrap: 'break-word',
                        }}
                      >
                        {msg.text || ''}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {messages.length === 0 && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#6b9475',
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}
                  >
                    {sessionInitialized ? 'Waiting for AI to start...' : 'Initializing session...'}
                  </Typography>
                )}
                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </Box>
              {wsConnected && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                  <VolumeUp sx={{ fontSize: 16, color: '#4a7c59' }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#4a7c59',
                    }}
                  >
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
            {/* Header with Timer and Status on same line */}
            <Box
              sx={{
                position: 'absolute',
                top: '5px',
                left: '5px',
                right: '5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 1000,
              }}
            >
              {/* Timer Display - Left */}
              <Box
                sx={{
                  backgroundColor: timeRemaining < 60 ? 'rgba(211, 47, 47, 0.9)' : '#ECF4E8',
                  borderRadius: timeRemaining < 60 ? '8px' : "0px",
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: timeRemaining < 60 ? "#ffffff" : 'rgba(74, 124, 89, 0.9)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  TIME REMAINING
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    color: timeRemaining < 60 ? "#ffffff" : 'rgba(74, 124, 89, 0.9)',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    fontSize: '1.2rem',
                  }}
                >
                  {formatTime(timeRemaining)}
                </Typography>
              </Box>

              {/* Status Chip - Right */}
              <Chip
                label={isMicOn ? '● SPEAKING' : '● STANDBY'}
                sx={{
                  backgroundColor: isMicOn ? '#d32f2f' : '#4a7c59',
                  color: '#ffffff',
                  fontWeight: 'bold',
                }}
              />
            </Box>

            {/* Title and Subtitle Section - Matching AI Interviewer */}
            <Typography
              variant="h3"
              sx={{
                color: '#2d5a3d',
                fontWeight: 600,
                textAlign: 'center',
                mb: 1,
                mt: 0,
              }}
            >
              Your Response
            </Typography>

            {/* Video Preview - Made Bigger */}
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
                        ? 'Microphone starting...'
                        : 'Waiting for session to initialize...'}
                  </span>
                )}
              </Typography>

              {/* Status indicator - no buttons */}
              <Box sx={{ mt: 17, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                {isMicOn && (
                  <Chip
                    icon={<Mic />}
                    label="Recording..."
                    color="error"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
                {!isMicOn && sessionInitialized && (
                  <Chip
                    icon={<MicOff />}
                    label="Initializing microphone..."
                    sx={{ backgroundColor: '#cccccc', fontWeight: 'bold' }}
                  />
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
                variant="contained"
                color="error"
                size="small"
                onClick={endInterviewWebSocket}
                disabled={!wsConnected}
                sx={{ borderRadius: '5px' }}
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