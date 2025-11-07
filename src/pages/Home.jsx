import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome
      </Typography>
      <Typography sx={{ mb: 2 }}>
        Navigate to the job description page.
      </Typography>
      <Button component={Link} to="/job" variant="contained">
        Open Job Page
      </Button>
    </Box>
  );
}