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
  Stepper,
  Step,
  StepLabel,
  Chip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  Mic,
  MicOff,
  ArrowForward,
  CheckCircle,
  Download,
  Refresh,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.3s ease',
    '&:hover': {
      borderColor: '#3f51b5',
    },
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
};

function App() {
  const [step, setStep] = useState('upload'); // upload, interview, complete
  const [jobDescription, setJobDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Generate questions based on job description
  const generateQuestions = (jd) => {
    const keywords = jd.toLowerCase();
    const questionSet = [];
    
    questionSet.push({
      id: 1,
      text: "Can you introduce yourself and tell us about your relevant experience?",
      category: "Introduction"
    });
    
    if (keywords.includes('developer') || keywords.includes('engineer') || keywords.includes('programming')) {
      questionSet.push({
        id: 2,
        text: "What programming languages and frameworks are you most proficient in?",
        category: "Technical"
      });
      questionSet.push({
        id: 3,
        text: "Describe a challenging technical problem you've solved recently.",
        category: "Problem Solving"
      });
    }
    
    if (keywords.includes('team') || keywords.includes('collaboration')) {
      questionSet.push({
        id: 4,
        text: "How do you handle disagreements with team members?",
        category: "Teamwork"
      });
    }
    
    if (keywords.includes('leadership') || keywords.includes('manager')) {
      questionSet.push({
        id: 5,
        text: "Describe your leadership style and give an example of how you've motivated a team.",
        category: "Leadership"
      });
    }
    
    questionSet.push({
      id: questionSet.length + 1,
      text: "Why are you interested in this position and what makes you a good fit?",
      category: "Motivation"
    });
    
    questionSet.push({
      id: questionSet.length + 1,
      text: "Where do you see yourself in the next 3-5 years?",
      category: "Career Goals"
    });
    
    return questionSet;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFileName(file.name);
      const fileType = file.type;
      
      // For text files
      if (fileType === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setJobDescription(event.target.result);
        };
        reader.readAsText(file);
      } 
      // For PDF and Word files
      else if (fileType === 'application/pdf' || 
               fileType === 'application/msword' || 
               fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For now, just store the file name
        // You'll need additional libraries to parse PDF/Word content
        setJobDescription(`File uploaded: ${file.name}\n\nPlease paste the job description content here...`);
      }
    }
  };

  const showAlertMessage = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const startInterview = () => {
    if (!jobDescription.trim()) {
      showAlertMessage('Please upload or paste a job description first');
      return;
    }
    const generatedQuestions = generateQuestions(jobDescription);
    setQuestions(generatedQuestions);
    setStep('interview');
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
        saveAnswer(currentAnswer || '[Audio Recording]');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      showAlertMessage('Could not access microphone. Please allow microphone access or type your answer.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const saveAnswer = (answer) => {
    const newAnswer = {
      questionId: questions[currentQuestionIndex].id,
      question: questions[currentQuestionIndex].text,
      answer: answer,
      timestamp: new Date().toISOString()
    };
    
    setAnswers([...answers, newAnswer]);
    setCurrentAnswer('');
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStep('complete');
    }
  };

  const handleNextQuestion = () => {
    if (!currentAnswer.trim() && !isRecording) {
      showAlertMessage('Please provide an answer before moving to the next question');
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

  const downloadResults = () => {
    const results = {
      jobDescription,
      interviewDate: new Date().toISOString(),
      responses: answers
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interview-results.json';
    a.click();
  };

  const resetInterview = () => {
    setStep('upload');
    setJobDescription('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentAnswer('');
  };

  const getStepperSteps = () => ['Job Description', 'Interview', 'Complete'];

  const speakQuestion = () => {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(questions[currentQuestionIndex].text);
      speech.onstart = () => setIsSpeaking(true);
      speech.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(speech);
    } else {
      showAlertMessage('Text-to-speech is not supported in your browser');
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        <Paper elevation={3} sx={styles.mainCard}>
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            AI Interview System
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
            Upload a job description and conduct an AI-powered interview
          </Typography>

          <Stepper activeStep={step === 'upload' ? 0 : step === 'interview' ? 1 : 2} sx={{ mb: 4 }}>
            {getStepperSteps().map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {showAlert && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {alertMessage}
            </Alert>
          )}

          {step === 'upload' && (
            <Box>
              <Card sx={{ ...styles.uploadArea, mb: 3 }} onClick={() => fileInputRef.current?.click()}>
                <CardContent>
                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="primary" gutterBottom>
                    {selectedFileName ? `Selected: ${selectedFileName}` : 'Upload job description file'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedFileName ? 'Click to change file' : 'or paste below'}
                  </Typography>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".txt,.doc,.docx,.pdf"
                    onChange={handleFileUpload}
                  />
                </CardContent>
              </Card>

              <TextField
                fullWidth
                multiline
                rows={12}
                label="Job Description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                variant="outlined"
                sx={{ mb: 3 }}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={startInterview}
                endIcon={<ArrowForward />}
                sx={{ py: 1.5, borderRadius: '28px' }}
              >
                Start Interview
              </Button>
            </Box>
          )}

          {step === 'interview' && questions.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={(currentQuestionIndex / questions.length) * 100}
                sx={styles.progressBar}
              />

              <Card sx={styles.questionCard}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Chip
                        label={questions[currentQuestionIndex].category}
                        color="primary"
                        size="small"
                        sx={{ mb: 2 }}
                      />
                      <Typography variant="h6" component="h2">
                        {questions[currentQuestionIndex].text}
                      </Typography>
                    </Box>
                    <IconButton 
                      onClick={isSpeaking ? stopSpeaking : speakQuestion}
                      color={isSpeaking ? "error" : "primary"}
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
                    variant={isRecording ? "contained" : "outlined"}
                    color={isRecording ? "error" : "primary"}
                    size="large"
                    onClick={isRecording ? stopRecording : startRecording}
                    startIcon={isRecording ? <Stop /> : <Mic />}
                    sx={styles.recordingButton}
                  >
                    {isRecording ? (
                      `Stop Recording (${formatTime(recordingTime)})`
                    ) : (
                      'Record Answer'
                    )}
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
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {step === 'complete' && (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 3 }} />
              <Typography variant="h5" gutterBottom color="primary">
                Interview Complete!
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
                You've answered all {questions.length} questions.
              </Typography>

              <Card sx={{ mb: 4, textAlign: 'left' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Interview Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {answers.map((ans, idx) => (
                    <Box key={idx} sx={styles.answerSummary}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Q{idx + 1}: {ans.question}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {ans.answer.substring(0, 100)}...
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    size="large"
                    onClick={downloadResults}
                    startIcon={<Download />}
                    sx={{ py: 1.5, borderRadius: '28px' }}
                  >
                    Download Results
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={resetInterview}
                    startIcon={<Refresh />}
                    sx={{ py: 1.5, borderRadius: '28px' }}
                  >
                    New Interview
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default App
