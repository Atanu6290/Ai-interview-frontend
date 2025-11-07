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
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import generateQuestions from '../Api/generateQuestions';

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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const lastSpeechTimeRef = useRef(Date.now());
  const listeningRef = useRef(false);
  const { id } = useParams();

  const SILENCE_THRESHOLD = 10000; // 10 seconds

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
        
        // Initialize audio context for visualization
        initializeAudioVisualization(stream);
        
        console.log('Camera and recording initialized successfully');
      } catch (err) {
        console.error('Camera initialization error:', err);
        showAlertMessage(
          'Could not access camera/microphone. Please allow permissions.',
          'error'
        );
      }
    };

    initializeMediaDevices();

    return () => {
      // Cleanup
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

        try {
          await uploadVideo(videoBlob, questionData);
        } catch (uploadErr) {
          console.error('Upload failed:', uploadErr);
        }

        // Restart recording for next question if not complete
        if (!isComplete && videoStream) {
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
      // Small delay to ensure everything is ready
      setTimeout(() => {
        speakQuestion();
      }, 1000);
    }
  }, [questions, isLoading, isCameraActive]);

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
    if (listening && finalTranscript) {
      lastSpeechTimeRef.current = Date.now();
      resetSilenceTimer();
    }
  }, [finalTranscript, listening]);

  // Silence detection timer
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - lastSpeechTimeRef.current;
      if (timeSinceLastSpeech >= SILENCE_THRESHOLD && finalTranscript.trim()) {
        console.log('5 seconds of silence detected. Stopping listening...');
        stopListening();
        moveToNextQuestion();
      }
    }, SILENCE_THRESHOLD);
  };

  // Speak question using TTS
  const speakQuestion = () => {
    if (!questions[currentQuestionIndex]) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      const speech = new SpeechSynthesisUtterance(questions[currentQuestionIndex].text);
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
        
        // Start listening after AI finishes speaking
        setTimeout(() => {
          startListening();
        }, 500);
      };

      speech.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        // Start listening anyway
        startListening();
      };

      window.speechSynthesis.speak(speech);
    } else {
      showAlertMessage('Text-to-speech not supported', 'warning');
      startListening();
    }
  };

  // Start listening for user answer (using react-speech-recognition)
  const startListening = () => {
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
      console.log('Speech recognition stopped');
    }
  };

  // Move to next question
  const moveToNextQuestion = () => {
    const answer = finalTranscript.trim() || '[No response]';
    
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

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      showAlertMessage('Moving to next question', 'info');
      
      // Speak next question after a brief pause
      setTimeout(() => {
        speakQuestion();
      }, 1500);
    } else {
      setIsComplete(true);
      stopListening();
      showAlertMessage('Interview completed!', 'success');
    }
  };

  // Upload video
  const uploadVideo = async (videoBlob, questionData) => {
    try {
      const formData = new FormData();
      const timestamp = new Date().getTime();
      formData.append('video', videoBlob, `interview-q${questionData.questionId}-${timestamp}.webm`);
      formData.append('questionId', questionData.questionId);
      formData.append('questionText', questionData.question);
      formData.append('category', questionData.category);
      formData.append('sessionId', sessionId || id);
      formData.append('uuid', id);
      formData.append('timestamp', questionData.timestamp);
      formData.append('answer', questionData.answer);

      const response = await axios.post('/api/upload-interview-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Video uploaded successfully:', response.data);
      return response.data;
    } catch (err) {
      console.error('Video upload error:', err);
      throw err;
    }
  };

  // Get supported MIME type
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
            Thank you for completing the AI screening round.
          </Typography>
          <Alert severity="success" sx={{ maxWidth: 600 }}>
            Your responses have been recorded and will be reviewed by our team.
          </Alert>
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
              label="● AI INTERVIEWER"
              sx={{
                ...styles.statusChip,
                backgroundColor: '#4a7c59',
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
                {questions[currentQuestionIndex]?.text}
              </Typography>
            </Box>

            {/* AI Waveform Visualization */}
            {isSpeaking && (
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
              label={listening ? '● LISTENING' : '● STANDBY'}
              sx={{
                ...styles.statusChip,
                backgroundColor: listening ? '#d32f2f' : '#4a7c59',
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
              </Typography>
            </Box>

            {/* User Waveform Visualization */}
            {listening && (
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
          </Box>
        </Box>


      </Box>
    </ThemeProvider>
  );
}
