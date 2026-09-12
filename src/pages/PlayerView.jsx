import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';
import { getPlayerAvatar } from '../lib/avatar';
import { CheckCircle2, XCircle, Clock, Award, ShieldAlert, ArrowLeft } from 'lucide-react';
import ArenaBackground from '../components/ArenaBackground';
import EmojiRain from '../components/EmojiRain';

export default function PlayerView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCodeParam = searchParams.get('room') || '';

  // Player & Device State
  const [deviceToken, setDeviceToken] = useState('');
  const [player, setPlayer] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [isRepeatPlayer, setIsRepeatPlayer] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  // Match & Gameplay State
  const [match, setMatch] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);

  // Direct Calculated Scores
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(null);
  const [roundScore, setRoundScore] = useState(0);
  const [roundCorrect, setRoundCorrect] = useState(0);

  // Synchronized Timers & Countdown
  const [countdownNum, setCountdownNum] = useState(null);
  const [timeLeftSec, setTimeLeftSec] = useState(15);
  const questionStartTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastBeepedRef = useRef(null);
  const lastCountdownRoundRef = useRef(null);

  // 1. Initialize Device Token
  useEffect(() => {
    let token = localStorage.getItem('arena_device_token');
    if (!token) {
      token = 'dev_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('arena_device_token', token);
    }
    setDeviceToken(token);

    const completedToday = localStorage.getItem('arena_completed_date');
    const todayStr = new Date().toISOString().split('T')[0];
    if (completedToday === todayStr) {
      setIsRepeatPlayer(true);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // 2. Fetch Match by Room Code & Re-hydrate player
  useEffect(() => {
    if (!roomCodeParam) return;
    fetchMatchByCode(roomCodeParam);
  }, [roomCodeParam, deviceToken]);

  const fetchMatchByCode = async (code) => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .single();

    if (data) {
      setMatch(data);

      if (deviceToken) {
        const { data: existingPlayer } = await supabase
          .from('match_players')
          .select('*')
          .eq('match_id', data.id)
          .eq('device_token', deviceToken)
          .single();

        if (existingPlayer) {
          setPlayer(existingPlayer);
        }
      }
    }
  };

  // 3. Realtime Subscription for Match updates
  useEffect(() => {
    if (!match?.id) return;

    const matchChannel = supabase
      .channel(`player_match_${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, (payload) => {
        setMatch(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, [match?.id]);

  // 4. Compute Player Score, Rank, and Round Stats directly from match_answers table
  const fetchPlayerDirectStats = async (matchId, playerId, currentRound) => {
    if (!matchId || !playerId) return;

    // Fetch answers for all players in this match to compute rank & total score
    const { data: allAnswers } = await supabase
      .from('match_answers')
      .select('player_id, round, is_correct, points_earned')
      .eq('match_id', matchId);

    const { data: allPlayers } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', matchId);

    const answers = allAnswers || [];

    if (allPlayers) {
      const scores = allPlayers.map((p) => {
        const pAnswers = answers.filter((a) => a.player_id === p.id);
        const total = pAnswers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
        return { player_id: p.id, totalScore: total };
      });

      scores.sort((a, b) => b.totalScore - a.totalScore);

      const myRow = scores.find((s) => s.player_id === playerId);
      const myRankIndex = scores.findIndex((s) => s.player_id === playerId);

      if (myRow) setPlayerScore(myRow.totalScore);
      if (myRankIndex !== -1) setPlayerRank(myRankIndex + 1);
    }

    // Compute specific round stats for this player
    if (currentRound) {
      const roundAnswers = answers.filter((a) => a.player_id === playerId && a.round === Number(currentRound));
      const rScore = roundAnswers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const rCorrect = roundAnswers.filter((a) => a.is_correct === true).length;
      setRoundScore(rScore);
      setRoundCorrect(rCorrect);
    }
  };

  // 5. Handle Round Changes & Countdown
  useEffect(() => {
    if (!match || !player) return;

    fetchPlayerDirectStats(match.id, player.id, match.current_round);

    if (match.status === 'round1' || match.status === 'round2' || match.status === 'round3') {
      fetchPlayerQuestions(match.id, player.id, match.current_round);
      handleSynchronizedCountdown(match.round_started_at, match.current_round);
    } else if (match.status === 'final_results') {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem('arena_completed_date', todayStr);
      audioManager.playFinalFanfare();
      audioManager.playApplauseClapping(3);
    }
  }, [match?.status, match?.round_started_at, player?.id]);

  const handleSynchronizedCountdown = (startedAtIso, roundNum) => {
    // Avoid double countdowns for the exact same round
    const roundKey = `${roundNum}_${startedAtIso || ''}`;
    if (lastCountdownRoundRef.current === roundKey) return;
    lastCountdownRoundRef.current = roundKey;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    lastBeepedRef.current = null;

    let targetMs = startedAtIso ? new Date(startedAtIso).getTime() : Date.now() + 3500;
    const nowMs = Date.now();
    let remaining = targetMs - nowMs;

    // Fallback: If network latency or clock skew caused targetMs to be in the past or far future,
    // guarantee a smooth local 3.2-second GET READY countdown for the player!
    if (remaining <= 500 || remaining > 8000) {
      targetMs = Date.now() + 3200;
    }

    countdownIntervalRef.current = setInterval(() => {
      const currentNow = Date.now();
      const remainingMs = targetMs - currentNow;

      let currentStep = null;
      if (remainingMs > 2200) {
        currentStep = 3;
      } else if (remainingMs > 1200) {
        currentStep = 2;
      } else if (remainingMs > 200) {
        currentStep = 1;
      } else if (remainingMs > -600) {
        currentStep = 0; // GO!
      } else {
        currentStep = null;
      }

      if (currentStep !== null) {
        setCountdownNum(currentStep);
        if (lastBeepedRef.current !== currentStep) {
          lastBeepedRef.current = currentStep;
          audioManager.playCountdownBeep(currentStep);
        }
      } else {
        setCountdownNum(null);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        startPerQuestionTimer(15);
      }
    }, 40);
  };

  const fetchPlayerQuestions = async (matchId, playerId, roundNum) => {
    const { data } = await supabase
      .from('match_round_questions')
      .select('question_id, position, questions(*)')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .eq('round', roundNum)
      .order('position', { ascending: true });

    if (data && data.length > 0) {
      const formattedQ = data.map((item) => {
        const q = item.questions;
        let isRealOnLeft = Math.random() > 0.5;

        const rawOptions = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
        const shuffledOptions = [...rawOptions];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }

        return {
          id: q.id,
          round: q.round,
          question_type: q.question_type,
          prompt_text: q.prompt_text,
          real_image_url: q.real_image_url,
          ai_image_url: q.ai_image_url,
          isRealOnLeft,
          logo_url: q.logo_url,
          options: shuffledOptions,
          correct_option: q.correct_option,
          explanation: q.explanation
        };
      });

      const { data: answeredRows } = await supabase
        .from('match_answers')
        .select('question_id')
        .eq('match_id', matchId)
        .eq('player_id', playerId)
        .eq('round', roundNum);

      const answeredCount = answeredRows ? answeredRows.length : 0;
      const resumeIndex = Math.min(answeredCount, formattedQ.length - 1);

      setQuestions(formattedQ);
      setCurrentQIndex(resumeIndex);
      if (answeredCount >= formattedQ.length) {
        setIsAnswerSubmitted(true);
      } else {
        setIsAnswerSubmitted(false);
      }
      setSelectedOption(null);
      setAnswerResult(null);
    }
  };

  const startPerQuestionTimer = (durationSec = 15) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    questionStartTimeRef.current = Date.now();
    const targetEndMs = Date.now() + durationSec * 1000;
    let lastUrgencySec = null;

    setTimeLeftSec(durationSec);

    timerIntervalRef.current = setInterval(() => {
      const remainingMs = targetEndMs - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeLeftSec(remainingSec);

      // Play rising urgency warning tick on the last 5 seconds (5, 4, 3, 2, 1)
      if (remainingSec <= 5 && remainingSec > 0 && lastUrgencySec !== remainingSec) {
        lastUrgencySec = remainingSec;
        audioManager.playUrgencyTick(remainingSec);
      }

      if (remainingMs <= 0) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        handleTimeoutOrAutoAdvance();
      }
    }, 150);
  };

  const submitAnswer = async (chosenOption) => {
    if (isAnswerSubmitted || !match || !player || !questions[currentQIndex]) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsAnswerSubmitted(true);
    setSelectedOption(chosenOption);

    const currentQ = questions[currentQIndex];
    const responseTimeMs = Date.now() - questionStartTimeRef.current;

    let isCorrect = false;
    if (currentQ.round === 1) {
      isCorrect = chosenOption === 'ai';
    } else {
      isCorrect = chosenOption === currentQ.correct_option;
    }

    let points = 0;
    if (isCorrect) {
      const speedBonus = Math.max(0, Math.round((15000 - responseTimeMs) / 300));
      points = 100 + speedBonus;
      audioManager.playCorrect();
    } else {
      audioManager.playWrong();
    }

    setAnswerResult({
      isCorrect,
      correctOption: currentQ.round === 1 ? 'AI Image' : currentQ.correct_option,
      points,
      explanation: currentQ.explanation
    });

    try {
      await supabase.from('match_answers').insert([
        {
          match_id: match.id,
          player_id: player.id,
          round: currentQ.round,
          question_id: currentQ.id,
          selected_option: chosenOption,
          is_correct: isCorrect,
          points_earned: points,
          response_time_ms: responseTimeMs
        }
      ]);

      // Instantly refresh player direct score & rank after submitting answer
      fetchPlayerDirectStats(match.id, player.id, match.current_round);
    } catch (err) {
      console.error('Error saving answer:', err);
    }

    setTimeout(() => {
      advanceToNextQuestion();
    }, 2500);
  };

  const handleTimeoutOrAutoAdvance = () => {
    if (!isAnswerSubmitted) {
      submitAnswer('TIMEOUT');
    }
  };

  const advanceToNextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setIsAnswerSubmitted(false);
      setSelectedOption(null);
      setAnswerResult(null);
      startPerQuestionTimer(15);
    } else {
      setIsAnswerSubmitted(true);
      fetchPlayerDirectStats(match.id, player.id, match.current_round);
    }
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName || !match) return;

    try {
      const { data, error } = await supabase
        .from('match_players')
        .insert([
          {
            match_id: match.id,
            display_name: cleanName,
            device_token: deviceToken
          }
        ])
        .select()
        .single();

      if (error) {
        const { data: existingPlayer } = await supabase
          .from('match_players')
          .select('*')
          .eq('match_id', match.id)
          .eq('device_token', deviceToken)
          .single();
        if (existingPlayer) setPlayer(existingPlayer);
      } else if (data) {
        setPlayer(data);
      }
    } catch (err) {
      console.error('Join error:', err);
    }
  };

  const handleOverrideRepeat = (e) => {
    e.preventDefault();
    if (overridePin === '2004') {
      setIsRepeatPlayer(false);
    } else {
      alert('Invalid Host PIN');
    }
  };

  const handleLeaveMatch = async () => {
    if (!player) return;
    try {
      await supabase.from('match_players').update({ has_left: true }).eq('id', player.id);
      setPlayer(null);
    } catch (err) {
      console.error('Error marking player left:', err);
    }
  };

  if (!roomCodeParam) {
    return (
      <div style={playerContainerStyle}>
        <div className="card-light" style={{ textAlign: 'center' }}>
          <ShieldAlert size={48} color="#FF7675" style={{ margin: '0 auto 1rem' }} />
          <h2>QR Code Required</h2>
          <p style={{ color: '#636E72', marginTop: '0.5rem' }}>
            Please scan the live QR code on the arena projector screen to join!
          </p>
        </div>
      </div>
    );
  }

  if (isRepeatPlayer) {
    return (
      <div style={playerContainerStyle}>
        <div className="card-light" style={{ textAlign: 'center' }}>
          <Award size={48} color="#6C5CE7" style={{ margin: '0 auto 1rem' }} />
          <h2>Already Played Today</h2>
          <p style={{ color: '#636E72', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Looks like you have already completed a match today — thanks for joining! Ask the host if you would like another turn.
          </p>
          {!showOverrideInput ? (
            <button onClick={() => setShowOverrideInput(true)} className="btn btn-purple">
              Host Override PIN
            </button>
          ) : (
            <form onSubmit={handleOverrideRepeat}>
              <input
                type="password"
                maxLength={4}
                value={overridePin}
                onChange={(e) => setOverridePin(e.target.value)}
                placeholder="Enter PIN"
                style={{ width: '100%', padding: '0.8rem', textAlign: 'center', fontSize: '1.2rem', marginBottom: '0.75rem', borderRadius: '12px', border: '2px solid #E2E8F0' }}
              />
              <button type="submit" className="btn btn-green" style={{ width: '100%' }}>Unlock</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 1. NAME ENTRY SCREEN
  if (!player) {
    const isNameValid = nameInput.trim().length > 0;
    return (
      <ArenaBackground>
        <div style={playerContainerStyle}>
          <div style={{ width: '100%', maxWidth: '380px', marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => navigate('/')}
              className="btn"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.4rem 0.85rem',
                fontSize: '0.85rem',
                backdropFilter: 'blur(8px)'
              }}
            >
              <ArrowLeft size={16} /> HOME
            </button>
          </div>

          <div className="card-light" style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h1 className="brand-title" style={{ fontSize: '1.8rem' }}>AI-DEATH ARENA</h1>
              <p style={{ color: '#636E72', fontWeight: 600, fontSize: '0.9rem' }}>JOIN ARENA MATCH</p>
            </div>

            <form onSubmit={handleJoinGame}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D3436', display: 'block', marginBottom: '0.5rem' }}>
                YOUR DISPLAY NAME
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name..."
                autoFocus
                maxLength={15}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  borderRadius: '16px',
                  border: '2px solid #6C5CE7',
                  marginBottom: '1rem',
                  outline: 'none'
                }}
              />
              {!isNameValid && (
                <p style={{ color: '#FF7675', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  Please enter your name to join
                </p>
              )}

              <button
                type="submit"
                disabled={!isNameValid}
                className={`btn btn-green ${!isNameValid ? 'btn-disabled' : ''}`}
                style={{ width: '100%', fontSize: '1.25rem', padding: '1rem' }}
              >
                ENTER ARENA
              </button>
            </form>
          </div>
        </div>
      </ArenaBackground>
    );
  }

  // Countdown Overlay
  if (countdownNum !== null) {
    return (
      <div className="countdown-overlay">
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#A29BFE', marginBottom: '1rem' }}>
          GET READY!
        </span>
        <div className="countdown-number">
          {countdownNum === 0 ? 'GO!' : countdownNum}
        </div>
      </div>
    );
  }

  // 2. LOBBY WAIT SCREEN
  if (match?.status === 'lobby') {
    const avatar = getPlayerAvatar(player.display_name);
    return (
      <ArenaBackground>
        <div style={playerContainerStyle}>
          <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
            <div className="avatar-badge" style={{ background: avatar.bgColor, width: '72px', height: '72px', fontSize: '2.5rem', margin: '0 auto 1rem' }}>
              {avatar.emoji}
            </div>
            <h2 style={{ fontSize: '1.8rem', color: '#2D3436' }}>{player.display_name}</h2>
            <span style={{ display: 'inline-block', background: '#E0E7FF', color: '#4338CA', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 700, marginTop: '0.5rem', marginBottom: '2rem' }}>
              YOU ARE IN THE LOBBY
            </span>

            <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
              <p style={{ color: '#636E72', fontWeight: 600 }}>
                Look at the main projector screen! The match will start when the host clicks Start Round 1.
              </p>
            </div>

            <button onClick={handleLeaveMatch} className="btn" style={{ background: '#DFE6E9', color: '#636E72', fontSize: '0.9rem', width: '100%' }}>
              Leave Match
            </button>
          </div>
        </div>
      </ArenaBackground>
    );
  }

  // 3. GAMEPLAY SCREENS (ROUNDS 1, 2, 3)
  const currentQ = questions[currentQIndex];
  const isRoundActive = (match?.status === 'round1' || match?.status === 'round2' || match?.status === 'round3');
  const isFinishedRoundQuestions = isAnswerSubmitted && currentQIndex === 4;

  if (isRoundActive && currentQ && !isFinishedRoundQuestions) {
    const avatar = getPlayerAvatar(player.display_name);

    return (
      <div key={currentQ.id} style={gameplayContainerStyle}>
        {/* Mobile Top Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar-badge" style={{ background: avatar.bgColor, width: '32px', height: '32px', fontSize: '1rem' }}>
              {avatar.emoji}
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D3436' }}>{player.display_name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: '#6C5CE7', color: '#FFFFFF', padding: '0.25rem 0.6rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.85rem' }}>
              {currentQIndex + 1} / 5
            </span>
            <span className="timer-pill" style={{ fontSize: '0.9rem', padding: '0.25rem 0.6rem' }}>
              <Clock size={14} /> {timeLeftSec}s
            </span>
          </div>
        </header>

        {/* Question Title & Prompt */}
        <div style={{ textAlign: 'center', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6C5CE7', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ROUND {currentQ.round} — {currentQ.round === 1 ? 'REAL OR FAKE?' : currentQ.round === 2 ? 'DECODE THE BRAND' : 'EMOJI DECODE'}
          </span>
          <h2 style={{ fontSize: '1.05rem', color: '#2D3436', marginTop: '0.1rem', lineHeight: '1.2' }}>
            {currentQ.round === 3 ? 'Which AI concept or tool do these emojis represent?' : currentQ.prompt_text}
          </h2>
        </div>

        {/* ZERO-SCROLL PLACEMENT: Answer Feedback Banner right below question prompt */}
        {answerResult && (
          <div style={{
            background: answerResult.isCorrect ? '#E6FFFA' : '#FFF5F5',
            border: `2px solid ${answerResult.isCorrect ? '#38B2AC' : '#E53E3E'}`,
            borderRadius: '12px',
            padding: '0.4rem 0.65rem',
            textAlign: 'center',
            marginBottom: '0.35rem',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
              {answerResult.isCorrect ? (
                <>
                  <CheckCircle2 color="#38B2AC" size={18} />
                  <strong style={{ color: '#2C7A7B', fontSize: '0.95rem' }}>CORRECT! +{answerResult.points} pts</strong>
                </>
              ) : (
                <>
                  <XCircle color="#E53E3E" size={18} />
                  <strong style={{ color: '#C53030', fontSize: '0.95rem' }}>INCORRECT</strong>
                </>
              )}
            </div>
            <p style={{ color: '#4A5568', fontSize: '0.78rem', margin: 0 }}>
              {answerResult.explanation}
            </p>
          </div>
        )}

        {/* Content Area (Round 1 Images vs Round 2 Logo vs Round 3 Emoji) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: '0.25rem' }}>

          {/* ROUND 1: Two Images Side by Side */}
          {currentQ.round === 1 && (
            <div key={`r1_${currentQ.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', height: '160px' }}>
              <button
                key={`btn_a_${currentQ.id}`}
                disabled={isAnswerSubmitted}
                onClick={() => submitAnswer(currentQ.isRealOnLeft ? 'real' : 'ai')}
                style={{
                  border: selectedOption === (currentQ.isRealOnLeft ? 'real' : 'ai') ? '4px solid #6C5CE7' : '2px solid #E2E8F0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0,
                  background: '#F1F5F9',
                  cursor: 'pointer'
                }}
              >
                <img
                  key={`img_a_${currentQ.id}`}
                  src={currentQ.isRealOnLeft ? currentQ.real_image_url : currentQ.ai_image_url}
                  alt="Option A"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=Sample+Image'; }}
                />
                <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: '#FFF', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                  IMAGE A
                </span>
              </button>

              <button
                key={`btn_b_${currentQ.id}`}
                disabled={isAnswerSubmitted}
                onClick={() => submitAnswer(currentQ.isRealOnLeft ? 'ai' : 'real')}
                style={{
                  border: selectedOption === (currentQ.isRealOnLeft ? 'ai' : 'real') ? '4px solid #6C5CE7' : '2px solid #E2E8F0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0,
                  background: '#F1F5F9',
                  cursor: 'pointer'
                }}
              >
                <img
                  key={`img_b_${currentQ.id}`}
                  src={currentQ.isRealOnLeft ? currentQ.ai_image_url : currentQ.real_image_url}
                  alt="Option B"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=Sample+Image'; }}
                />
                <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: '#FFF', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                  IMAGE B
                </span>
              </button>
            </div>
          )}

          {/* ROUND 2: Brand Logo Display (Zero-scroll compact centered layout) */}
          {currentQ.round === 2 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem 0' }}>
              <div style={{
                width: '110px',
                height: '110px',
                margin: '0 auto',
                padding: '0.65rem',
                background: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 8px 20px rgba(108, 92, 231, 0.14), 0 2px 8px rgba(0,0,0,0.06)',
                border: '2px solid #EEF2FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={currentQ.logo_url}
                  alt="Brand Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '🤖'; }}
                />
              </div>
            </div>
          )}

          {/* ROUND 3: Emoji Clue Display (Single centered 3.5rem display) */}
          {currentQ.round === 3 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem 0' }}>
              <span style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>
                {currentQ.prompt_text}
              </span>
            </div>
          )}

          {/* Answer Options Grid (Round 2 & 3: 4 Choice Buttons) */}
          {currentQ.round !== 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: 'auto' }}>
              {currentQ.options.map((optionText, idx) => {
                const colors = ['#FF7675', '#0984E3', '#FDCB6E', '#00B894'];
                const optionColor = colors[idx % 4];
                const isSelected = selectedOption === optionText;

                return (
                  <button
                    key={idx}
                    disabled={isAnswerSubmitted}
                    onClick={() => submitAnswer(optionText)}
                    className="btn"
                    style={{
                      backgroundColor: optionColor,
                      color: idx === 2 ? '#2D3436' : '#FFFFFF',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      padding: '0.45rem 0.3rem',
                      minHeight: '44px',
                      borderRadius: '12px',
                      opacity: isAnswerSubmitted && !isSelected ? 0.4 : 1,
                      outline: isSelected ? '4px solid #2D3436' : 'none'
                    }}
                  >
                    {optionText}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. INTERIM ROUND SUMMARY SCREEN (Shown after question 5 or during round results)
  if (match?.status === 'round1_results' || match?.status === 'round2_results' || isFinishedRoundQuestions) {
    const roundNum = match.current_round || (match.status === 'round1_results' ? 1 : 2);
    const avatar = getPlayerAvatar(player.display_name);
    const isFinalOrRound3 = match?.status === 'final_results' || (isFinishedRoundQuestions && roundNum === 3);
    const isTop3Winner = isFinalOrRound3 && (playerRank === 1 || playerRank === 2 || playerRank === 3);

    return (
      <div style={playerContainerStyle}>
        {isTop3Winner && <EmojiRain count={38} />}
        <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <div className="avatar-badge" style={{ background: avatar.bgColor, width: '64px', height: '64px', fontSize: '2rem', margin: '0 auto 0.75rem' }}>
            {avatar.emoji}
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#2D3436' }}>ROUND {roundNum} COMPLETE!</h2>
          <span style={{ display: 'inline-block', background: '#E0E7FF', color: '#4338CA', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 700, marginTop: '0.4rem', marginBottom: '1.25rem' }}>
            {player.display_name}
          </span>

          <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#636E72', fontWeight: 700, display: 'block' }}>ROUND SCORE</span>
                <strong style={{ fontSize: '1.5rem', color: '#00B894' }}>+{roundScore} pts</strong>
              </div>
              <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.75rem', color: '#636E72', fontWeight: 700, display: 'block' }}>ACCURACY</span>
                <strong style={{ fontSize: '1.5rem', color: '#0984E3' }}>{roundCorrect} / 5</strong>
              </div>
            </div>

            <span style={{ fontSize: '0.8rem', color: '#636E72', fontWeight: 700, display: 'block' }}>TOTAL RUNNING SCORE</span>
            <strong style={{ fontSize: '2rem', color: '#6C5CE7' }}>{playerScore} pts</strong>
            {playerRank && (
              <div style={{ marginTop: '0.4rem' }}>
                <span style={{
                  background: playerRank === 1 ? '#FEFCBF' : playerRank === 2 ? '#E2E8F0' : playerRank === 3 ? '#FED7D7' : '#FEFCBF',
                  color: playerRank === 1 ? '#744210' : playerRank === 2 ? '#1E293B' : playerRank === 3 ? '#991B1B' : '#744210',
                  border: `1px solid ${playerRank === 1 ? '#F6E05E' : playerRank === 2 ? '#CBD5E1' : playerRank === 3 ? '#FEB2B2' : '#F6E05E'}`,
                  padding: '0.35rem 0.85rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  display: 'inline-block'
                }}>
                  {playerRank === 1 ? '👑 ARENA RANK #1 (CHAMPION!)' : playerRank === 2 ? '🥈 ARENA RANK #2 (RUNNER UP!)' : playerRank === 3 ? '🥉 ARENA RANK #3 (PODIUM!)' : `ARENA RANK #${playerRank}`}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: '#EEF2FF', padding: '1rem', borderRadius: '16px', border: '1px solid #C7D2FE' }}>
            <p style={{ color: '#4338CA', fontWeight: 600, fontSize: '0.9rem' }}>
              Look at the arena projector display! Waiting for host to reveal round results & start the next round...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. AFTER ROUND 3 / FINAL MATCH COMPLETE SCREEN
  const isTop3Winner = playerRank === 1 || playerRank === 2 || playerRank === 3;

  return (
    <div style={playerContainerStyle}>
      {isTop3Winner && <EmojiRain count={38} />}
      <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <Award size={56} color="#FDCB6E" style={{ margin: '0 auto 0.5rem' }} />
        <h2 style={{ fontSize: '2rem' }}>MATCH COMPLETE</h2>
        <p style={{ color: '#636E72', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Great effort in the AI-DEATH ARENA!
        </p>

        <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#636E72', fontWeight: 700, display: 'block' }}>YOUR FINAL SCORE</span>
          <strong style={{ fontSize: '2.5rem', color: '#6C5CE7' }}>{playerScore} pts</strong>

          {playerRank && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{
                background: playerRank === 1 ? '#FEFCBF' : playerRank === 2 ? '#E2E8F0' : playerRank === 3 ? '#FED7D7' : '#FEFCBF',
                color: playerRank === 1 ? '#744210' : playerRank === 2 ? '#1E293B' : playerRank === 3 ? '#991B1B' : '#744210',
                border: `1px solid ${playerRank === 1 ? '#F6E05E' : playerRank === 2 ? '#CBD5E1' : playerRank === 3 ? '#FEB2B2' : '#F6E05E'}`,
                padding: '0.4rem 1rem',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '1rem',
                display: 'inline-block'
              }}>
                {playerRank === 1 ? '👑 FINAL RANK #1 (CHAMPION!)' : playerRank === 2 ? '🥈 FINAL RANK #2 (RUNNER UP!)' : playerRank === 3 ? '🥉 FINAL RANK #3 (PODIUM!)' : `FINAL RANK #${playerRank}`}
              </span>
            </div>
          )}
        </div>

        <p style={{ color: '#A0AEC0', fontSize: '0.85rem' }}>
          Check the arena projector display for full final standings & podium ceremony!
        </p>
      </div>
    </div>
  );
}

const playerContainerStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  background: 'transparent'
};

const gameplayContainerStyle = {
  minHeight: '100vh',
  maxHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: 'max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-left)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-right))',
  background: '#FFFFFF',
  overflow: 'hidden'
};
