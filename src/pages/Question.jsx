import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Mic,
  Stop,
  ArrowForward,
  PlayArrow,
  CheckCircle,
  Download,
  Refresh,
  Videocam,
  VideocamOff,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import generateQuestions from '../Api/generateQuestions';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    success: {
      main: '#4caf50',
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
    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    margin: 0,
    padding: '32px',
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'auto',
  },
  questionCard: {
    background: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  recordingButton: {
    minHeight: '56px',
    borderRadius: '28px',
  },
  progressBar: {
    height: '8px',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  answerSummary: {
    borderLeft: '4px solid #3f51b5',
    paddingLeft: '16px',
    marginBottom: '16px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: 2,
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '640px',
    margin: '0 auto',
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  video: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  videoPlaceholder: {
    padding: '100px 20px',
    textAlign: 'center',
    color: '#fff',
    backgroundColor: '#333',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  cameraStatus: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const { id } = useParams();

  console.log("UUID from params:", id);

  // Initialize camera when component mounts
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user" 
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setVideoStream(stream);
        setIsCameraActive(true);
        console.log('Camera initialized successfully');
      } catch (err) {
        console.error('Camera initialization error:', err);
        showAlertMessage(
          'Could not access camera/microphone. Please allow permissions.',
          'error'
        );
      }
    };

    initializeCamera();

    // Cleanup function - properly stop camera when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log('Track stopped:', track.kind);
        });
        videoRef.current.srcObject = null;
      }
    };
  }, []); // Empty dependency array - runs once on mount

  // Fetch questions from API on component mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const payload = {
          uuid: id
        };
        
        console.log("Sending payload to API:", payload);
        
        const response = await generateQuestions(payload);
        
        console.log("API response:", response);
        
        // Handle single question object from API
        if (response && response.question) {
          const transformedQuestion = {
            id: response.question_number,
            text: response.question,
            category: response.difficulty
          };
          
          // Store sessionId for later use
          if (response.sessionId) {
            setSessionId(response.sessionId);
          }
          
          // Set as array with single question
          setQuestions([transformedQuestion]);
          console.log('Question loaded successfully:', transformedQuestion);
        } else {
          throw new Error('No question received from API');
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
        setError(err.message || 'Failed to load questions. Please try again.');
        showAlertMessage(
          'Failed to load questions. Please refresh the page.',
          'error'
        );
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const showAlertMessage = (message, severity = 'warning') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  // Get supported MIME type for cross-browser compatibility
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
        console.log('Supported MIME type:', type);
        return type;
      }
    }
    return 'video/webm'; // fallback
  };

  // Upload video to server
  const uploadVideo = async (videoBlob, questionData) => {
    try {
      const formData = new FormData();
      
      // Append video file
      const timestamp = new Date().getTime();
      formData.append('video', videoBlob, `interview-q${questionData.questionId}-${timestamp}.webm`);
      
      // Append metadata
      formData.append('questionId', questionData.questionId);
      formData.append('questionText', questionData.question);
      formData.append('category', questionData.category);
      formData.append('sessionId', sessionId || id);
      formData.append('uuid', id);
      formData.append('timestamp', questionData.timestamp);
      
      console.log('Uploading video...', {
        size: videoBlob.size,
        type: videoBlob.type,
        questionId: questionData.questionId
      });
      
      // Replace with your actual upload endpoint
      const response = await axios.post('/api/upload-interview-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log('Upload progress:', percentCompleted + '%');
        },
      });
      
      console.log('Video uploaded successfully:', response.data);
      showAlertMessage('Video uploaded successfully', 'success');
      return response.data;
    } catch (err) {
      console.error('Video upload error:', err);
      showAlertMessage('Failed to upload video. Will retry...', 'warning');
      // You might want to implement retry logic here
      throw err;
    }
  };

  const startRecording = async () => {
    try {
      if (!videoStream) {
        showAlertMessage('Camera is not active. Please reload the page.', 'error');
        return;
      }

      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      
      // Create MediaRecorder with existing video stream
      mediaRecorderRef.current = new MediaRecorder(videoStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      });
      
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Data chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const videoBlob = new Blob(audioChunksRef.current, { 
          type: mimeType 
        });
        
        console.log('Recording stopped. Video size:', videoBlob.size, 'bytes');
        
        // Create download URL for the video (for debugging)
        const videoUrl = URL.createObjectURL(videoBlob);
        console.log('Video URL:', videoUrl);
        
        // Prepare question data for upload
        const questionData = {
          questionId: questions[currentQuestionIndex].id,
          question: questions[currentQuestionIndex].text,
          category: questions[currentQuestionIndex].category,
          timestamp: new Date().toISOString(),
        };
        
        // Upload the video to your server
        try {
          await uploadVideo(videoBlob, questionData);
        } catch (uploadErr) {
          console.error('Upload failed, but continuing...', uploadErr);
        }
        
        // Save answer after upload attempt
        saveAnswer(currentAnswer || '[Video Recording Completed]');
        
        // Clean up the object URL
        setTimeout(() => URL.revokeObjectURL(videoUrl), 1000);
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        showAlertMessage('Recording error occurred', 'error');
      };

      // Start recording with timeslice for regular data chunks
      mediaRecorderRef.current.start(1000); // Get data every second
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
      showAlertMessage('Recording started successfully', 'success');
    } catch (err) {
      console.error('Recording start error:', err);
      showAlertMessage(
        'Could not start recording. Please try again.',
        'error'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      
      // Camera stays on as required
      showAlertMessage('Recording stopped. Processing video...', 'info');
    }
  };

  const saveAnswer = (answer) => {
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
    setCurrentAnswer('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      showAlertMessage('Moving to next question', 'info');
    } else {
      setIsComplete(true);
      showAlertMessage('Interview completed!', 'success');
    }
  };

  const handleNextQuestion = () => {
    if (!currentAnswer.trim() && !isRecording) {
      showAlertMessage('Please provide an answer before moving to the next question', 'warning');
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      saveAnswer(currentAnswer);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speakQuestion = () => {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(
        questions[currentQuestionIndex].text
      );
      speech.rate = 0.9; // Slightly slower for clarity
      speech.pitch = 1.0;
      speech.volume = 1.0;
      
      speech.onstart = () => setIsSpeaking(true);
      speech.onend = () => setIsSpeaking(false);
      speech.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
      };
      
      window.speechSynthesis.speak(speech);
    } else {
      showAlertMessage('Text-to-speech is not supported in your browser', 'warning');
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSkipQuestion = () => {
    if (isRecording) {
      stopRecording();
    }
    saveAnswer('[Question Skipped]');
  };

  const retryFetchQuestions = () => {
    window.location.reload();
  };

  // Loading state
  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.container}>
          <Paper elevation={3} sx={styles.mainCard}>
            <Box sx={styles.loadingContainer}>
              <CircularProgress size={60} />
              <Typography variant="h6" color="textSecondary">
                Loading Questions...
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please wait while we prepare your interview
              </Typography>
            </Box>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // Error state
  if (error || questions.length === 0) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.container}>
          <Paper elevation={3} sx={styles.mainCard}>
            <Box sx={styles.loadingContainer}>
              <Alert severity="error" sx={{ mb: 3, width: '100%', maxWidth: 600 }}>
                {error || 'No questions available'}
              </Alert>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Unable to Load Questions
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                There was an error loading the interview questions.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={retryFetchQuestions}
                size="large"
              >
                Retry
              </Button>
            </Box>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // Completion state
  if (isComplete) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={styles.container}>
          <Paper elevation={3} sx={styles.mainCard}>
            <Box sx={styles.loadingContainer}>
              <CheckCircle color="success" sx={{ fontSize: 80, mb: 3 }} />
              <Typography variant="h4" color="primary" gutterBottom>
                Interview Complete!
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Thank you for completing the AI screening round.
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
                You answered {answers.length} out of {questions.length} questions.
              </Typography>
              <Alert severity="success" sx={{ mb: 3, maxWidth: 600 }}>
                Your responses have been recorded and will be reviewed by our team.
              </Alert>
            </Box>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // Render interview questions
  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        <Paper elevation={3} sx={styles.mainCard}>
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            AI Screening Round
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
            Answer each question thoughtfully. You can type or record your response.
          </Typography>

          {showAlert && (
            <Alert severity={alertSeverity} sx={{ mb: 3 }}>
              {alertMessage}
            </Alert>
          )}

          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="body2" color="textSecondary">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Typography>
              <Chip
                label={`${answers.length} Answered`}
                color="success"
                size="small"
              />
            </Box>

            <LinearProgress
              variant="determinate"
              value={((currentQuestionIndex + 1) / questions.length) * 100}
              sx={styles.progressBar}
            />

            <Card sx={styles.questionCard}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    {questions[currentQuestionIndex].category && (
                      <Chip
                        label={questions[currentQuestionIndex].category}
                        color="primary"
                        size="small"
                        sx={{ mb: 2 }}
                      />
                    )}
                    <Typography variant="h6" component="h2">
                      {questions[currentQuestionIndex].text}
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={isSpeaking ? stopSpeaking : speakQuestion}
                    color={isSpeaking ? 'error' : 'primary'}
                    sx={{ ml: 2 }}
                  >
                    {isSpeaking ? <Stop /> : <PlayArrow />}
                  </IconButton>
                </Box>
              </CardContent>
            </Card>

            {/* Camera Preview - Always Active */}
            <Box sx={{ mb: 3 }}>
              <Box sx={styles.videoContainer}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    ...styles.video,
                    display: isCameraActive ? 'block' : 'none',
                  }}
                />
                {!isCameraActive && (
                  <Box sx={styles.videoPlaceholder}>
                    <VideocamOff sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
                    <Typography variant="body2">
                      Camera is not active
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                      Please allow camera permissions and reload
                    </Typography>
                  </Box>
                )}
                
                {/* Camera Active Indicator */}
                {isCameraActive && !isRecording && (
                  <Chip
                    label="● Camera Active"
                    color="success"
                    size="small"
                    sx={styles.cameraStatus}
                  />
                )}
                
                {/* Recording Indicator */}
                {isRecording && (
                  <Chip
                    label={`● REC ${formatTime(recordingTime)}`}
                    color="error"
                    sx={styles.recordingIndicator}
                  />
                )}
              </Box>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={6}
              label="Your Answer"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here or use voice recording..."
              variant="outlined"
              disabled={isRecording}
              sx={{ mb: 3 }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant={isRecording ? 'contained' : 'outlined'}
                  color={isRecording ? 'error' : 'primary'}
                  size="large"
                  onClick={isRecording ? stopRecording : startRecording}
                  startIcon={isRecording ? <Stop /> : <Mic />}
                  sx={styles.recordingButton}
                  disabled={!isCameraActive}
                >
                  {isRecording
                    ? `Stop Recording (${formatTime(recordingTime)})`
                    : 'Record Answer'}
                </Button>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleNextQuestion}
                  endIcon={<ArrowForward />}
                  sx={styles.recordingButton}
                >
                  {currentQuestionIndex < questions.length - 1
                    ? 'Next Question'
                    : 'Finish Interview'}
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  onClick={handleSkipQuestion}
                  sx={{ textTransform: 'none' }}
                >
                  Skip this question
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </ThemeProvider>
  );
}
