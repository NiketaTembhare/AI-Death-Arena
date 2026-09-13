import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeView from './pages/HomeView';
import MatchConsoleView from './pages/MatchConsoleView';
import PlayerView from './pages/PlayerView';
import LeaderboardView from './pages/LeaderboardView';
import AdminView from './pages/AdminView';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('⚠️ ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0D0B1D',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: '#1E1A3C',
            border: '1px solid #2D2856',
            borderRadius: '24px',
            maxWidth: '520px',
            width: '100%',
            padding: '2.5rem 2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '1.8rem', color: '#FF7675', marginBottom: '0.75rem' }}>⚠️ Screen Render Error</h2>
            <p style={{ color: '#A29BFE', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
              An error occurred while displaying this page. Details below:
            </p>
            <div style={{
              background: '#161334',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #FF7675',
              color: '#FF7675',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              marginBottom: '1.5rem',
              wordBreak: 'break-all',
              textAlign: 'left',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {this.state.error?.toString() || 'Unknown Error'}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '14px',
                  border: 'none',
                  background: '#6C5CE7',
                  color: '#FFF',
                  cursor: 'pointer'
                }}
              >
                🏠 GO HOME
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '14px',
                  border: 'none',
                  background: '#00B894',
                  color: '#FFF',
                  cursor: 'pointer'
                }}
              >
                🔄 REFRESH
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const isEnvMissing = false;

  return (
    <BrowserRouter>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </BrowserRouter>
  );
}

