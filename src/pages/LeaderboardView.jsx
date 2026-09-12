import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPlayerAvatar } from '../lib/avatar';
import { Trophy, ArrowLeft, Crown } from 'lucide-react';

export default function LeaderboardView() {
  const navigate = useNavigate();
  const [allTimeLeaders, setAllTimeLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllTimeLeaderboard();
  }, []);

  const fetchAllTimeLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('match_leaderboard')
        .select('*')
        .order('total_score', { ascending: false })
        .limit(50);

      if (data) {
        setAllTimeLeaders(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F4F5F9 0%, #E2E8F0 100%)',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '640px', width: '100%' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate('/')} className="btn" style={{ background: '#FFFFFF', color: '#2D3436', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <ArrowLeft size={20} /> BACK TO HOME
          </button>
        </div>

        <div className="card-light" style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1.5rem' }}>
          <Trophy size={48} color="#FDCB6E" style={{ margin: '0 auto 0.5rem' }} />
          <h1 className="brand-title" style={{ fontSize: '2.2rem' }}>HALL OF FAME</h1>
          <p style={{ color: '#636E72', fontSize: '0.9rem', fontWeight: 600 }}>
            ALL-TIME INDIVIDUAL MATCH PERFORMANCES
          </p>
        </div>

        {/* Leaders List */}
        <div className="card-light" style={{ padding: '1rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#636E72', padding: '2rem' }}>Loading Leaderboard...</p>
          ) : allTimeLeaders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#636E72', padding: '2rem' }}>No matches recorded yet. Host a match to populate the leaderboard!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {allTimeLeaders.map((item, idx) => {
                const avatar = getPlayerAvatar(item.display_name);
                const isTop3 = idx < 3;
                const accuracy = item.total_answers > 0 
                  ? Math.round((item.correct_count / item.total_answers) * 100) 
                  : 0;
                const dateStr = item.joined_at ? new Date(item.joined_at).toLocaleDateString() : '';

                return (
                  <div
                    key={item.player_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      borderRadius: '16px',
                      background: isTop3 ? '#FEFCBF' : '#F8FAFC',
                      border: isTop3 ? '1px solid #F6E05E' : '1px solid #E2E8F0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        width: '32px',
                        color: idx === 0 ? '#D69E2E' : idx === 1 ? '#718096' : idx === 2 ? '#DD6B20' : '#A0AEC0'
                      }}>
                        #{idx + 1}
                      </span>

                      <div style={{ position: 'relative' }}>
                        {idx === 0 && <Crown size={18} color="#D69E2E" style={{ position: 'absolute', top: '-12px', left: '10px' }} />}
                        <div className="avatar-badge" style={{ background: avatar.bgColor, width: '40px', height: '40px', fontSize: '1.3rem' }}>
                          {avatar.emoji}
                        </div>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '1.1rem', color: '#2D3436' }}>{item.display_name}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#718096' }}>{accuracy}% Accuracy • {dateStr}</span>
                      </div>
                    </div>

                    <strong style={{ fontSize: '1.3rem', color: '#6C5CE7' }}>
                      {item.total_score} pts
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
