import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Card,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { CloudUpload, ContentCopy, Close } from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import createJDLink from "../Api/createJDLink";

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
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
};

export default function JobPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isUploaded, setIsUploaded] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [testLink, setTestLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];

    if (isUploaded) {
      setJobDescription('');
      setSelectedFileName('');
      setIsUploaded(false);
    }

    if (file) {
      const fileType = file.type;
      const fileSizeMB = file.size / (1024 * 1024);

      if (fileSizeMB > 5) {
        showAlertMessage('File size should be less than 5MB');
        return;
      }

      setSelectedFileName(file.name);
      setIsUploaded(true);

      if (fileType === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setJobDescription(event.target.result);
        };
        reader.readAsText(file);
      } else if (
        fileType === 'application/pdf' ||
        fileType === 'application/msword' ||
        fileType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        setJobDescription(
          `File uploaded: ${file.name}\n\nPlease paste the job description content here...`
        );
      }
    }
  };

  const handleRemoveFile = () => {
    setJobDescription('');
    setSelectedFileName('');
    setIsUploaded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const showAlertMessage = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(testLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCopySuccess(false);
    setTestLink('');
  };

  const handleSubmit = async () => {
    if (!jobDescription && !selectedFileName) {
      showAlertMessage('Please upload a file or enter job description');
      return;
    }

    const data = {
      jd: jobDescription,
    };
    console.log('Full Submitted Data:', data);
    
    try {
      const response = await createJDLink(data);
      console.log('Response from createJDLink:', response);
      
      // Set the test link and open dialog
      setTestLink(response.link);
      setOpenDialog(true);
      setSubmittedData(data);
      setJobDescription('');
      handleRemoveFile();
    } catch (error) {
      console.error('Error calling createJDLink:', error);
      showAlertMessage('Failed to create test link. Please try again.');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        <Paper elevation={3} sx={styles.mainCard}>
          <Typography variant="h4" component="h1" gutterBottom color="primary">
            AI screening round
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
            Upload a job description or paste it below
          </Typography>

          {showAlert && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {alertMessage}
            </Alert>
          )}

          <Box>
            <Card
              sx={{ ...styles.uploadArea, mb: 3 }}
              onClick={() => !isUploaded && fileInputRef.current?.click()}
            >
              <CardContent>
                <CloudUpload
                  sx={{
                    fontSize: 48,
                    color: isUploaded ? 'success.main' : 'text.secondary',
                    mb: 2,
                  }}
                />
                <Typography variant="h6" color="primary" gutterBottom>
                  {selectedFileName
                    ? `Selected: ${selectedFileName}`
                    : 'Upload job description file'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedFileName ? (
                    <Button
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                    >
                      Remove file
                    </Button>
                  ) : (
                    'Click to upload (max 5MB)'
                  )}
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
              placeholder={
                isUploaded
                  ? 'Content from uploaded file...'
                  : 'Paste the job description here...'
              }
              variant="outlined"
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={handleSubmit}
              sx={{ mb: 3 }}
            >
              Submit
            </Button>
          </Box>
        </Paper>

        {/* Dialog for displaying test link */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Your Test Link</Typography>
              <IconButton onClick={handleCloseDialog} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              value={testLink}
              variant="outlined"
              InputProps={{
                readOnly: true,
              }}
              sx={{ mb: 2 }}
            />
            {copySuccess && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Link copied to clipboard!
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              startIcon={<ContentCopy />}
              onClick={handleCopyLink}
              color="primary"
            >
              Copy Link
            </Button>
            <Button onClick={handleCloseDialog} variant="outlined">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
