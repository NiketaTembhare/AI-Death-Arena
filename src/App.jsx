import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeView from './pages/HomeView';
import MatchConsoleView from './pages/MatchConsoleView';
import PlayerView from './pages/PlayerView';
import LeaderboardView from './pages/LeaderboardView';
import AdminView from './pages/AdminView';

export default function App() {
  const isEnvMissing = false;

  return (
    <BrowserRouter>
      {isEnvMissing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#d63031',
          color: '#ffffff',
          padding: '12px 20px',
          textAlign: 'center',
          fontWeight: 'bold',
          zIndex: 999999,
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          ⚠️ SUPABASE NOT CONNECTED: Environment variables missing! If running locally, stop terminal (Ctrl+C), run <code>npx vite --force</code> and hard refresh. If hosted on Vercel, add <code>VITE_SUPABASE_URL</code> in Vercel Dashboard Settings.
        </div>
      )}
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/match" element={<MatchConsoleView />} />
        <Route path="/play" element={<PlayerView />} />
        <Route path="/leaderboard" element={<LeaderboardView />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
    </BrowserRouter>
  );
}
