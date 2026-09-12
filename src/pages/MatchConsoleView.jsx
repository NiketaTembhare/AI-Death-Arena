import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';
import { getPlayerAvatar } from '../lib/avatar';
import { Volume2, VolumeX, Play, Award, RotateCcw, Crown, Users, ArrowRight, X } from 'lucide-react';

export default function MatchConsoleView() {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [isMuted, setIsMuted] = useState(audioManager.isMuted);
  const previousStatusRef = useRef(null);

  // Remove / Kick Player action for Host (Non-destructive: sets has_left = true)
  const handleRemovePlayer = async (playerId, displayName) => {
    if (!window.confirm(`Remove ${displayName || 'this player'} from active match roster?`)) return;
    try {
      await supabase.from('match_players').update({ has_left: true }).eq('id', playerId);
      if (match?.id) {
        fetchLiveLeaderboardAndProgress(match.id, match.current_round);
      }
    } catch (err) {
      console.error('Error marking player left:', err);
    }
  };

  // Subscribe to AudioManager mute changes
  useEffect(() => {
    return audioManager.subscribe((muted) => setIsMuted(muted));
  }, []);

  // 1. Fetch current active match on mount
  const fetchActiveMatch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['lobby', 'round1', 'round1_results', 'round2', 'round2_results', 'round3', 'round3_results'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setMatch(data[0]);
      } else {
        setMatch(null);
      }
    } catch (err) {
      console.error('Error fetching active match:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveMatch();
  }, []);

  // 2. Direct-table aggregate calculation for live standings & round completion counter
  const fetchLiveLeaderboardAndProgress = async (matchId, currentRound) => {
    if (!matchId) return;

    // Fetch players
    const { data: playerRows } = await supabase
      .from('match_players')
      .select('id, display_name, device_token, has_left, joined_at')
      .eq('match_id', matchId)
      .order('joined_at', { ascending: true });

    if (!playerRows) return;
    
    // Active players in lobby/roster (excludes players who have left/kicked)
    const activePlayers = playerRows.filter((p) => !p.has_left);
    setPlayers(activePlayers);

    // Fetch submitted answers
    const { data: answerRows } = await supabase
      .from('match_answers')
      .select('player_id, round, is_correct, points_earned')
      .eq('match_id', matchId);

    const answers = answerRows || [];

    let donePlayersCount = 0;

    const aggregated = playerRows.map((p) => {
      const pAnswers = answers.filter((a) => a.player_id === p.id);
      const totalScore = pAnswers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const correctCount = pAnswers.filter((a) => a.is_correct === true).length;
      
      const roundAnswersCount = currentRound 
        ? pAnswers.filter((a) => a.round === Number(currentRound)).length 
        : 0;

      if (!p.has_left && roundAnswersCount >= 5) {
        donePlayersCount++;
      }

      return {
        player_id: p.id,
        match_id: matchId,
        display_name: p.display_name,
        device_token: p.device_token,
        has_left: p.has_left,
        total_score: totalScore,
        correct_count: correctCount,
        total_answers: pAnswers.length,
        round_answers_count: roundAnswersCount,
        joined_at: p.joined_at
      };
    });

    aggregated.sort((a, b) => b.total_score - a.total_score);

    setLeaderboard(aggregated);
    setAnsweredCount(donePlayersCount);
  };

  // 3. Realtime Subscriptions
  useEffect(() => {
    if (!match?.id) return;

    fetchLiveLeaderboardAndProgress(match.id, match.current_round);

    // Subscribe to match status changes
    const matchChannel = supabase
      .channel(`match_${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, (payload) => {
        const newMatch = payload.new;
        setMatch(newMatch);
        fetchLiveLeaderboardAndProgress(newMatch.id, newMatch.current_round);

        if (previousStatusRef.current !== newMatch.status) {
          handleStatusSoundCue(newMatch.status);
          previousStatusRef.current = newMatch.status;
        }
      })
      .subscribe();

    // Subscribe to joined players
    const playerChannel = supabase
      .channel(`players_${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${match.id}` }, () => {
        fetchLiveLeaderboardAndProgress(match.id, match.current_round);
      })
      .subscribe();

    // Subscribe to submitted answers
    const answersChannel = supabase
      .channel(`answers_${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_answers', filter: `match_id=eq.${match.id}` }, () => {
        fetchLiveLeaderboardAndProgress(match.id, match.current_round);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(answersChannel);
    };
  }, [match?.id]);

  const handleStatusSoundCue = (status) => {
    if (status.startsWith('round') && !status.includes('results')) {
      audioManager.playRoundStart();
    } else if (status.includes('results')) {
      audioManager.playRoundEnd();
    } else if (status === 'final_results') {
      audioManager.playFinalFanfare();
    }
  };

  // State A action: Start New Match (auto-archive non-final active matches)
  const handleStartNewMatch = async () => {
    audioManager.initContext();
    setLoading(true);
    try {
      await supabase
        .from('matches')
        .update({ status: 'archived' })
        .neq('status', 'final_results')
        .neq('status', 'archived');

      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('matches')
        .insert([
          {
            room_code: roomCode,
            status: 'lobby',
            current_round: 0
          }
        ])
        .select()
        .single();

      if (error) throw error;
      setMatch(data);
      previousStatusRef.current = 'lobby';
    } catch (err) {
      console.error('Failed to create match:', err);
      alert('Error creating match. Check Supabase database setup.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to assign random round questions per player
  const assignRoundQuestionsForPlayers = async (matchId, roundNum) => {
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('round', roundNum)
      .eq('is_active', true);

    if (!allQuestions || allQuestions.length === 0) return;

    const { data: currentPlayers } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', matchId);

    if (!currentPlayers) return;

    const rowsToInsert = [];
    currentPlayers.forEach((player) => {
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);

      selected.forEach((q, idx) => {
        rowsToInsert.push({
          match_id: matchId,
          player_id: player.id,
          round: roundNum,
          question_id: q.id,
          position: idx + 1
        });
      });
    });

    if (rowsToInsert.length > 0) {
      await supabase.from('match_round_questions').insert(rowsToInsert);
    }
  };

  // Advance round status
  const updateMatchStatus = async (nextStatus, roundNum) => {
    audioManager.initContext();
    const updatePayload = {
      status: nextStatus,
      current_round: roundNum
    };

    if (nextStatus === 'round1' || nextStatus === 'round2' || nextStatus === 'round3') {
      const targetTime = new Date(Date.now() + 3000).toISOString();
      updatePayload.round_started_at = targetTime;

      await assignRoundQuestionsForPlayers(match.id, roundNum);
    }

    const { data, error } = await supabase
      .from('matches')
      .update(updatePayload)
      .eq('id', match.id)
      .select()
      .single();

    if (!error && data) {
      setMatch(data);
    }
  };

  if (loading) {
    return (
      <div style={darkPageStyle}>
        <h2>Loading Match Console...</h2>
      </div>
    );
  }

  const joinUrl = match ? `${window.location.origin}/play?room=${match.room_code}` : '';

  return (
    <div style={darkPageStyle}>
      {/* Console Header */}
      <header style={headerStyle}>
        <div>
          <h1 className="brand-title" style={{ fontSize: '2rem' }}>AI-DEATH ARENA</h1>
          <p style={{ color: '#A29BFE', fontSize: '0.85rem', fontWeight: 600 }}>MATCH CONSOLE — HOST & PROJECTOR VIEW</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {match && (
            <div style={{ background: '#1E1A3C', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #2D2856' }}>
              <span style={{ color: '#A29BFE', fontSize: '0.8rem', display: 'block' }}>ROOM CODE</span>
              <strong style={{ fontSize: '1.2rem', color: '#FDCB6E', letterSpacing: '2px' }}>{match.room_code}</strong>
            </div>
          )}

          <button
            onClick={() => audioManager.toggleMute()}
            className="sound-toggle-btn"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            <span>{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>
        </div>
      </header>

      {/* STATE A: NO ACTIVE MATCH */}
      {!match && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="card-console" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>No Active Match</h2>
            <p style={{ color: '#A29BFE', marginBottom: '2rem' }}>
              Ready for the next group of booth players? Click below to launch a new arena match.
            </p>
            <button onClick={handleStartNewMatch} className="btn btn-purple" style={{ width: '100%', fontSize: '1.3rem' }}>
              <Play size={24} /> START NEW MATCH
            </button>
          </div>
        </div>
      )}

      {/* STATE B: LOBBY */}
      {match && match.status === 'lobby' && (
        <div style={lobbyGridStyle}>
          {/* QR Code Section */}
          <div className="card-console" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              background: '#FFFFFF',
              padding: '1.5rem',
              borderRadius: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              marginBottom: '1rem'
            }}>
              <QRCodeSVG
                value={joinUrl}
                size={Math.min(320, window.innerWidth * 0.4)}
                level="H"
                includeMargin={false}
              />
            </div>
            <h3 style={{ fontSize: '1.5rem', color: '#FFFFFF', marginBottom: '0.25rem' }}>Scan QR Code to Join</h3>
            <p style={{ color: '#A29BFE', fontSize: '0.85rem', textAlign: 'center', maxWidth: '320px' }}>
              Camera not scanning? Fallback: open <strong>{window.location.origin}/play</strong> and enter <strong>{match.room_code}</strong>
            </p>
          </div>

          {/* Roster & Controls Section */}
          <div className="card-console" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users color="#00B894" size={28} />
                <h3 style={{ fontSize: '1.5rem' }}>Arena Roster</h3>
              </div>
              <span className="timer-pill" style={{ background: '#00B894', color: '#FFFFFF' }}>
                {players.length} / 20 Players Joined
              </span>
            </div>

            {/* Joined Players Roster */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', marginBottom: '1.5rem' }}>
              {players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#A29BFE' }}>
                  <p style={{ fontSize: '1.1rem' }}>Waiting for players to scan QR code...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {players.map((p) => {
                    const avatar = getPlayerAvatar(p.display_name);
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: '#161334',
                          border: '1px solid #2D2856',
                          borderRadius: '16px',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                          <div className="avatar-badge" style={{ background: avatar.bgColor }}>
                            {avatar.emoji}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.display_name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemovePlayer(p.id, p.display_name)}
                          title="Remove player from match"
                          style={{
                            background: 'rgba(255, 118, 117, 0.15)',
                            border: '1px solid #FF7675',
                            color: '#FF7675',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Host Control Area */}
            <div style={{ background: '#161334', padding: '1.25rem', borderRadius: '16px', border: '1px solid #2D2856' }}>
              {players.length > 0 && players.length < 5 && (
                <p style={{ color: '#FDCB6E', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                  💡 Recommended: at least 5 players for a full arena experience
                </p>
              )}
              <button
                disabled={players.length === 0}
                onClick={() => updateMatchStatus('round1', 1)}
                className={`btn btn-green ${players.length === 0 ? 'btn-disabled' : ''}`}
                style={{ width: '100%', fontSize: '1.3rem' }}
              >
                <Play size={24} /> START ROUND 1
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE C: ROUND IN PROGRESS / BETWEEN ROUNDS */}
      {match && match.status !== 'lobby' && match.status !== 'final_results' && match.status !== 'archived' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Host Controls & Round Banner */}
          <div className="card-console" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#FDCB6E', fontWeight: 800, fontSize: '1rem', letterSpacing: '1px' }}>
                CURRENT MATCH STATUS
              </span>
              <h2 style={{ fontSize: '2rem', textTransform: 'uppercase', color: '#FFFFFF' }}>
                {match.status.replace('_', ' ')}
              </h2>
            </div>

            {/* Answered Progress Indicator for Host */}
            {(match.status === 'round1' || match.status === 'round2' || match.status === 'round3') && (
              <div style={{ background: '#161334', border: '1px solid #00B894', padding: '0.5rem 1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                <span style={{ color: '#A29BFE', fontSize: '0.8rem', fontWeight: 700, display: 'block' }}>ANSWERED PROGRESS</span>
                <strong style={{ fontSize: '1.25rem', color: '#00B894' }}>
                  {answeredCount} / {players.length} Players Done
                </strong>
              </div>
            )}

            {/* Sequential Round Progression Controls */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              {match.status === 'round1' && (
                <button onClick={() => updateMatchStatus('round1_results', 1)} className="btn btn-orange" style={{ fontSize: '1.1rem' }}>
                  SHOW ROUND 1 RESULTS <ArrowRight size={20} />
                </button>
              )}

              {match.status === 'round1_results' && (
                <button onClick={() => updateMatchStatus('round2', 2)} className="btn btn-green" style={{ fontSize: '1.1rem' }}>
                  START ROUND 2 <Play size={20} />
                </button>
              )}

              {match.status === 'round2' && (
                <button onClick={() => updateMatchStatus('round2_results', 2)} className="btn btn-orange" style={{ fontSize: '1.1rem' }}>
                  SHOW ROUND 2 RESULTS <ArrowRight size={20} />
                </button>
              )}

              {match.status === 'round2_results' && (
                <button onClick={() => updateMatchStatus('round3', 3)} className="btn btn-green" style={{ fontSize: '1.1rem' }}>
                  START ROUND 3 <Play size={20} />
                </button>
              )}

              {match.status === 'round3' && (
                <button onClick={() => updateMatchStatus('final_results', 3)} className="btn btn-yellow" style={{ fontSize: '1.1rem', color: '#2D3436' }}>
                  SHOW FINAL RESULTS <Award size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Live Re-sorting Leaderboard */}
          <div className="card-console">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#A29BFE' }}>LIVE ARENA STANDINGS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {leaderboard.length === 0 ? (
                <p style={{ color: '#A29BFE', textAlign: 'center', padding: '2rem' }}>Waiting for player scores...</p>
              ) : (
                leaderboard.map((player, idx) => {
                  const avatar = getPlayerAvatar(player.display_name);
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={player.player_id}
                      style={{
                        background: isFirst ? 'linear-gradient(90deg, #1E1A3C, #322A63)' : '#161334',
                        border: isFirst ? '2px solid #FDCB6E' : '1px solid #2D2856',
                        borderRadius: '16px',
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'transform 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{
                          fontSize: '1.5rem',
                          fontWeight: 900,
                          width: '36px',
                          color: isFirst ? '#FDCB6E' : '#A29BFE'
                        }}>
                          #{idx + 1}
                        </span>

                        <div style={{ position: 'relative' }}>
                          {isFirst && (
                            <Crown size={22} color="#FDCB6E" style={{ position: 'absolute', top: '-14px', left: '12px' }} />
                          )}
                          <div className="avatar-badge" style={{ background: avatar.bgColor }}>
                            {avatar.emoji}
                          </div>
                        </div>

                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                          {player.display_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <span style={{ color: '#00B894', fontWeight: 700 }}>
                          {player.correct_count} / {player.total_answers} Correct
                        </span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FDCB6E' }}>
                          {player.total_score} pts
                        </span>
                        <button
                          onClick={() => handleRemovePlayer(player.player_id, player.display_name)}
                          title="Remove player from match"
                          style={{
                            background: 'rgba(255, 118, 117, 0.15)',
                            border: '1px solid #FF7675',
                            color: '#FF7675',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* STATE D: MATCH COMPLETE (PODIUM & STANDINGS) */}
      {match && match.status === 'final_results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Top 3 Podium Highlight */}
          <div className="card-console" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <Award size={48} color="#FDCB6E" style={{ margin: '0 auto 0.5rem' }} />
            <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>ARENA CHAMPIONS</h2>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* 2nd Place */}
              {leaderboard[1] && (
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '200px' }}>
                  <div className="avatar-badge" style={{ background: getPlayerAvatar(leaderboard[1].display_name).bgColor, margin: '0 auto 0.5rem', width: '56px', height: '56px', fontSize: '1.8rem' }}>
                    {getPlayerAvatar(leaderboard[1].display_name).emoji}
                  </div>
                  <strong style={{ display: 'block', fontSize: '1.2rem', color: '#FFFFFF' }}>{leaderboard[1].display_name}</strong>
                  <span style={{ color: '#A29BFE', fontWeight: 700 }}>{leaderboard[1].total_score} pts</span>
                  <div style={{ height: '100px', background: '#2D2856', borderRadius: '16px 16px 0 0', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 900, color: '#DFE6E9' }}>
                    2nd
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {leaderboard[0] && (
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '220px' }}>
                  <Crown size={32} color="#FDCB6E" style={{ margin: '0 auto 0.25rem' }} />
                  <div className="avatar-badge" style={{ background: getPlayerAvatar(leaderboard[0].display_name).bgColor, margin: '0 auto 0.5rem', width: '70px', height: '70px', fontSize: '2.2rem', boxShadow: '0 0 20px rgba(253, 203, 110, 0.6)' }}>
                    {getPlayerAvatar(leaderboard[0].display_name).emoji}
                  </div>
                  <strong style={{ display: 'block', fontSize: '1.4rem', color: '#FDCB6E' }}>{leaderboard[0].display_name}</strong>
                  <span style={{ color: '#00B894', fontWeight: 800, fontSize: '1.1rem' }}>{leaderboard[0].total_score} pts</span>
                  <div style={{ height: '140px', background: 'linear-gradient(180deg, #FDCB6E, #E1B12C)', color: '#2D3436', borderRadius: '16px 16px 0 0', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900 }}>
                    1st
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {leaderboard[2] && (
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '200px' }}>
                  <div className="avatar-badge" style={{ background: getPlayerAvatar(leaderboard[2].display_name).bgColor, margin: '0 auto 0.5rem', width: '56px', height: '56px', fontSize: '1.8rem' }}>
                    {getPlayerAvatar(leaderboard[2].display_name).emoji}
                  </div>
                  <strong style={{ display: 'block', fontSize: '1.2rem', color: '#FFFFFF' }}>{leaderboard[2].display_name}</strong>
                  <span style={{ color: '#A29BFE', fontWeight: 700 }}>{leaderboard[2].total_score} pts</span>
                  <div style={{ height: '80px', background: '#2D2856', borderRadius: '16px 16px 0 0', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#E17055' }}>
                    3rd
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleStartNewMatch} className="btn btn-green" style={{ fontSize: '1.3rem', padding: '1rem 2.5rem' }}>
              <RotateCcw size={24} /> START NEW MATCH FOR NEXT GROUP
            </button>
          </div>

          {/* Full Final Standings List */}
          <div className="card-console">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1.25rem', color: '#A29BFE' }}>FULL FINAL STANDINGS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {leaderboard.map((player, idx) => {
                const avatar = getPlayerAvatar(player.display_name);
                const isTop3 = idx < 3;
                return (
                  <div
                    key={player.player_id}
                    style={{
                      background: isTop3 ? 'linear-gradient(90deg, #1E1A3C, #322A63)' : '#161334',
                      border: isTop3 ? '2px solid #FDCB6E' : '1px solid #2D2856',
                      borderRadius: '16px',
                      padding: '1rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        width: '36px',
                        color: idx === 0 ? '#FDCB6E' : idx === 1 ? '#DFE6E9' : idx === 2 ? '#E17055' : '#A29BFE'
                      }}>
                        #{idx + 1}
                      </span>
                      <div className="avatar-badge" style={{ background: avatar.bgColor }}>
                        {avatar.emoji}
                      </div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                        {player.display_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                      <span style={{ color: '#00B894', fontWeight: 700 }}>
                        {player.correct_count} / {player.total_answers} Correct
                      </span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FDCB6E' }}>
                        {player.total_score} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom CSS Styles for Projector Match Console
const darkPageStyle = {
  minHeight: '100vh',
  backgroundColor: '#0D0B1D',
  color: '#FFFFFF',
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '1rem',
  borderBottom: '1px solid #2D2856'
};

const lobbyGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: '1.5rem',
  flex: 1
};
