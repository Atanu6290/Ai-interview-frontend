import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import Home from './pages/Home';
import JobPage from './pages/JobPage';

// import QuestionsPage from './pages/Question_WebSocket';
import QuestionsPage from './pages/Question';

export default function App() {
  return (
    <BrowserRouter>

      <Box sx={{ mt: 2 }}>
        <Routes>
          <Route path="/" element={<JobPage />} />
          <Route path="/questions/:id" element={<QuestionsPage />} />

        </Routes>
      </Box>
    </BrowserRouter>
  );
}