import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeView from './pages/HomeView';
import MatchConsoleView from './pages/MatchConsoleView';
import PlayerView from './pages/PlayerView';
import LeaderboardView from './pages/LeaderboardView';
import AdminView from './pages/AdminView';

export default function App() {
  return (
    <BrowserRouter>
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
