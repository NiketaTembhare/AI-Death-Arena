import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPlayerAvatar } from '../lib/avatar';
import { Trophy, ArrowLeft, Crown, Award, Zap } from 'lucide-react';
import ArenaBackground from '../components/ArenaBackground';

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
        .select('*, matches!inner(status)')
        .eq('matches.status', 'final_results')
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

  const top3 = allTimeLeaders.slice(0, 3);
  const remainingLeaders = allTimeLeaders.slice(3);

  return (
    <ArenaBackground>
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ maxWidth: '1100px', width: '100%' }}>
          {/* Top Bar Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button
              onClick={() => navigate('/')}
              className="btn"
              style={{ background: '#FFFFFF', color: '#2D3436', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <ArrowLeft size={20} /> BACK TO HOME
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', padding: '0.4rem 1rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem' }}>
              <Zap size={16} color="#FDCB6E" /> LIVE STANDINGS
            </div>
          </div>

          {/* Page Banner Header */}
          <div className="card-light" style={{ textAlign: 'center', marginBottom: '2rem', padding: '2rem 1.5rem' }}>
            <Trophy size={56} color="#FDCB6E" style={{ margin: '0 auto 0.5rem' }} />
            <h1 className="brand-title" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)' }}>HALL OF FAME</h1>
            <p style={{ color: '#636E72', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.5px' }}>
              ALL-TIME ARENA LEADERBOARD & INDIVIDUAL CHAMPIONS
            </p>
          </div>

          {loading ? (
            <div className="card-light" style={{ textAlign: 'center', padding: '4rem' }}>
              <p style={{ color: '#636E72', fontSize: '1.2rem', fontWeight: 600 }}>Loading Leaderboard Standings...</p>
            </div>
          ) : allTimeLeaders.length === 0 ? (
            <div className="card-light" style={{ textAlign: 'center', padding: '4rem' }}>
              <p style={{ color: '#636E72', fontSize: '1.2rem' }}>No completed matches recorded yet. Host a match to populate the Hall of Fame!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              {/* TOP 3 FEATURED PODIUM CARDS (Desktop Grid / Mobile Stack) */}
              {top3.length > 0 && (
                <div>
                  <h2 style={{ color: '#FDCB6E', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    👑 TOP ARENA PERFORMERS
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.25rem'
                  }}>
                    {top3.map((item, idx) => {
                      const avatar = getPlayerAvatar(item.display_name);
                      const isFirst = idx === 0;
                      const isSecond = idx === 1;
                      const accuracy = item.total_answers > 0 ? Math.round((item.correct_count / item.total_answers) * 100) : 0;
                      const dateStr = item.joined_at ? new Date(item.joined_at).toLocaleDateString() : '';

                      const cardBg = isFirst 
                        ? 'linear-gradient(135deg, #FFF9DB 0%, #FEFCBF 100%)' 
                        : isSecond 
                        ? 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)' 
                        : 'linear-gradient(135deg, #FFF5F5 0%, #FED7D7 100%)';

                      const borderColor = isFirst ? '#F6E05E' : isSecond ? '#CBD5E1' : '#FEB2B2';
                      const rankLabel = isFirst ? '1st Place' : isSecond ? '2nd Place' : '3rd Place';
                      const badgeColor = isFirst ? '#D69E2E' : isSecond ? '#475569' : '#C53030';

                      return (
                        <div
                          key={item.player_id}
                          className="card-light"
                          style={{
                            background: cardBg,
                            border: `2px solid ${borderColor}`,
                            borderRadius: '24px',
                            padding: '1.5rem',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: isFirst ? '0 10px 30px rgba(246, 224, 94, 0.4)' : '0 8px 24px rgba(0,0,0,0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          {/* Rank Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{
                              background: badgeColor,
                              color: '#FFFFFF',
                              padding: '0.35rem 0.85rem',
                              borderRadius: '999px',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              {isFirst && <Crown size={16} />}
                              {rankLabel}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#718096' }}>{dateStr}</span>
                          </div>

                          {/* Avatar & Player Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div className="avatar-badge" style={{ background: avatar.bgColor, width: '58px', height: '58px', fontSize: '2rem', flexShrink: 0 }}>
                              {avatar.emoji}
                            </div>
                            <div>
                              <h3 style={{ fontSize: '1.4rem', color: '#2D3436', margin: 0, fontWeight: 900 }}>{item.display_name}</h3>
                              <span style={{ fontSize: '0.85rem', color: '#4A5568', fontWeight: 700 }}>{accuracy}% Accuracy</span>
                            </div>
                          </div>

                          {/* Big Score Display */}
                          <div style={{
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(0,0,0,0.06)'
                          }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase' }}>TOTAL SCORE</span>
                            <strong style={{ fontSize: '1.6rem', color: '#6C5CE7', fontWeight: 900 }}>{item.total_score} pts</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ALL STANDINGS TABLE / LIST */}
              <div className="card-light" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', color: '#2D3436', marginBottom: '1.25rem', fontWeight: 800 }}>
                  ALL STANDINGS & ARCHIVE ROSTER
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {allTimeLeaders.map((item, idx) => {
                    const avatar = getPlayerAvatar(item.display_name);
                    const isTop3 = idx < 3;
                    const accuracy = item.total_answers > 0 ? Math.round((item.correct_count / item.total_answers) * 100) : 0;
                    const dateStr = item.joined_at ? new Date(item.joined_at).toLocaleDateString() : '';

                    return (
                      <div
                        key={item.player_id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(40px, auto) minmax(180px, 1fr) auto auto',
                          gap: '1rem',
                          alignItems: 'center',
                          padding: '0.9rem 1.25rem',
                          borderRadius: '16px',
                          background: isTop3 ? '#FEFCBF' : '#F8FAFC',
                          border: isTop3 ? '1px solid #F6E05E' : '1px solid #E2E8F0',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                      >
                        {/* Rank */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {idx === 0 && <Crown size={18} color="#D69E2E" />}
                          <span style={{
                            fontSize: '1.2rem',
                            fontWeight: 900,
                            color: idx === 0 ? '#D69E2E' : idx === 1 ? '#718096' : idx === 2 ? '#DD6B20' : '#A0AEC0'
                          }}>
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Player Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', overflow: 'hidden' }}>
                          <div className="avatar-badge" style={{ background: avatar.bgColor, width: '42px', height: '42px', fontSize: '1.3rem', flexShrink: 0 }}>
                            {avatar.emoji}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <strong style={{ display: 'block', fontSize: '1.1rem', color: '#2D3436', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.display_name}
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: '#718096', fontWeight: 600 }}>{dateStr}</span>
                          </div>
                        </div>

                        {/* Accuracy */}
                        <div style={{ textAlign: 'right', display: 'none', minWidth: '100px' }} className="leaderboard-desktop-col">
                          <span style={{ fontSize: '0.85rem', color: '#4A5568', fontWeight: 700 }}>{accuracy}% Accuracy</span>
                        </div>

                        {/* Score */}
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '1.3rem', color: '#6C5CE7', fontWeight: 900 }}>
                            {item.total_score} <span style={{ fontSize: '0.85rem', color: '#A29BFE' }}>pts</span>
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </ArenaBackground>
  );
}
