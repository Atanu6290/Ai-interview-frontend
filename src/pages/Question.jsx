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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const { id } = useParams();

  console.log("UUID from params:", id);

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
      
      // Transform the API response to match component structure
      const fetchedQuestions = response.questions || response.data?.questions || [];
      
      if (fetchedQuestions && fetchedQuestions.length > 0) {
        // Map API response to component format
        const transformedQuestions = fetchedQuestions.map((q) => ({
          id: q.question_number,
          text: q.question,
          category: q.difficulty
        }));
        
        setQuestions(transformedQuestions);
      } else {
        throw new Error('No questions received from API');
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        // You can save or process the audio blob here
        saveAnswer(currentAnswer || '[Audio Recording Completed]');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      showAlertMessage(
        'Could not access microphone. Please allow microphone access or type your answer.',
        'warning'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const saveAnswer = (answer) => {
    const newAnswer = {
      questionId: questions[currentQuestionIndex].id,
      question: questions[currentQuestionIndex].text,
      category: questions[currentQuestionIndex].category,
      answer: answer,
      timestamp: new Date().toISOString(),
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsComplete(true);
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
      speech.onstart = () => setIsSpeaking(true);
      speech.onend = () => setIsSpeaking(false);
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

  // Render interview questions
  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        <Paper elevation={3} sx={styles.mainCard}>
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            AI Interview Questions
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
    </ThemeProvider>
  );
}
