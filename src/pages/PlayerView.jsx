import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';
import { getPlayerAvatar } from '../lib/avatar';
import { CheckCircle2, XCircle, Clock, Award, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

export default function PlayerView() {
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
  const [answerResult, setAnswerResult] = useState(null); // { isCorrect, correctOption, points, explanation }
  const [playerScore, setPlayerScore] = useState(0);
  const [playerRank, setPlayerRank] = useState(null);

  // Synchronized Timers & Countdown
  const [countdownNum, setCountdownNum] = useState(null); // 3, 2, 1, 0 (GO!) or null
  const [timeLeftSec, setTimeLeftSec] = useState(15);
  const questionStartTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);

  // 1. Initialize Device Token
  useEffect(() => {
    let token = localStorage.getItem('arena_device_token');
    if (!token) {
      token = 'dev_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('arena_device_token', token);
    }
    setDeviceToken(token);

    // Check soft repeat player deterrent
    const completedToday = localStorage.getItem('arena_completed_date');
    const todayStr = new Date().toISOString().split('T')[0];
    if (completedToday === todayStr) {
      setIsRepeatPlayer(true);
    }
  }, []);

  // 2. Fetch Match by Room Code & Re-hydrate existing player by deviceToken
  useEffect(() => {
    if (!roomCodeParam) return;
    fetchMatchByCode(roomCodeParam);
  }, [roomCodeParam, deviceToken]);

  const fetchMatchByCode = async (code) => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .single();

    if (data) {
      setMatch(data);

      // Re-hydrate player state on page refresh if already joined
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

  // 3. Realtime Subscription for Match status updates
  useEffect(() => {
    if (!match?.id) return;

    const matchChannel = supabase
      .channel(`player_match_${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, (payload) => {
        const updatedMatch = payload.new;
        setMatch(updatedMatch);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, [match?.id]);

  // 4. Handle Round Changes & Synchronized Countdown
  useEffect(() => {
    if (!match || !player) return;

    if (match.status === 'round1' || match.status === 'round2' || match.status === 'round3') {
      const currentRoundNum = match.current_round;
      fetchPlayerQuestions(match.id, player.id, currentRoundNum);
      handleSynchronizedCountdown(match.round_started_at);
    } else if (match.status.includes('results')) {
      if (match.status === 'final_results') {
        // Flag completed date in localStorage for repeat player deterrent
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem('arena_completed_date', todayStr);
      }
      fetchPlayerScoreAndRank(match.id, player.id);
    }
  }, [match?.status, match?.round_started_at, player?.id]);

  // Synchronized countdown computed from server timestamp round_started_at
  const handleSynchronizedCountdown = (startedAtIso) => {
    if (!startedAtIso) return;
    const targetMs = new Date(startedAtIso).getTime();

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const diffSec = Math.ceil((targetMs - nowMs) / 1000);

      if (diffSec > 0) {
        setCountdownNum(diffSec);
        audioManager.playCountdownBeep(diffSec);
      } else if (diffSec === 0) {
        setCountdownNum(0); // GO!
        audioManager.playCountdownBeep(0);
      } else {
        setCountdownNum(null); // Countdown finished
        clearInterval(interval);
        startPerQuestionTimer(15); // Start 15s timer for question 1
      }
    }, 500);
  };

  // Fetch 5 assigned questions for this player & round
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

        // For Round 1 (Image Comparison), randomize left vs right image fresh per question
        let isRealOnLeft = Math.random() > 0.5;

        const rawOptions = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];

        // Fisher-Yates shuffle MCQ options array fresh per player per question
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

      // Check already answered questions for this round to resume exact position on refresh
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

  // Start server-authoritative timer for current question
  const startPerQuestionTimer = (durationSec = 15) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    questionStartTimeRef.current = Date.now();
    const targetEndMs = Date.now() + durationSec * 1000;

    setTimeLeftSec(durationSec);

    timerIntervalRef.current = setInterval(() => {
      const remainingMs = targetEndMs - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeLeftSec(remainingSec);

      if (remainingMs <= 0) {
        clearInterval(timerIntervalRef.current);
        handleTimeoutOrAutoAdvance();
      }
    }, 200);
  };

  // Submit Answer Action
  const submitAnswer = async (chosenOption) => {
    if (isAnswerSubmitted || !match || !player || !questions[currentQIndex]) return;

    setIsAnswerSubmitted(true);
    setSelectedOption(chosenOption);

    const currentQ = questions[currentQIndex];
    const responseTimeMs = Date.now() - questionStartTimeRef.current;

    // Check correctness
    let isCorrect = false;
    if (currentQ.round === 1) {
      // Round 1 option is 'ai' or 'real'
      isCorrect = chosenOption === 'ai';
    } else {
      isCorrect = chosenOption === currentQ.correct_option;
    }

    // Points calculation: 100 base + speed bonus up to 50
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

    // Save to Supabase DB
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
    } catch (err) {
      console.error('Error saving answer:', err);
    }

    // Auto advance after 2.5s reveal
    setTimeout(() => {
      advanceToNextQuestion();
    }, 2500);
  };

  // Timeout handling
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
      // Round complete for this player!
      setIsAnswerSubmitted(true);
    }
  };

  // Fetch final player score and rank from leaderboard view
  const fetchPlayerScoreAndRank = async (matchId, playerId) => {
    const { data } = await supabase
      .from('match_leaderboard')
      .select('*')
      .eq('match_id', matchId)
      .order('total_score', { ascending: false });

    if (data) {
      const playerRowIndex = data.findIndex((row) => row.player_id === playerId);
      if (playerRowIndex !== -1) {
        setPlayerScore(data[playerRowIndex].total_score);
        setPlayerRank(playerRowIndex + 1);
      }
    }
  };

  // Player Join Submit Action (STRICT validation requirement)
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
        // If unique constraint error (device already joined this match), fetch existing row
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

  // Host PIN Override for repeat player (Single global Host PIN: 1234)
  const handleOverrideRepeat = (e) => {
    e.preventDefault();
    if (overridePin === '1234') {
      setIsRepeatPlayer(false);
    } else {
      alert('Invalid Host PIN');
    }
  };

  // Screen Rendering
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
      <div style={playerContainerStyle}>
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
    );
  }

  // Synchronized 3-2-1 Countdown Overlay
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
      <div style={playerContainerStyle}>
        <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div className="avatar-badge" style={{ background: avatar.bgColor, width: '72px', height: '72px', fontSize: '2.5rem', margin: '0 auto 1rem' }}>
            {avatar.emoji}
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#2D3436' }}>{player.display_name}</h2>
          <span style={{ display: 'inline-block', background: '#E0E7FF', color: '#4338CA', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 700, marginTop: '0.5rem', marginBottom: '2rem' }}>
            YOU ARE IN THE LOBBY
          </span>

          <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ color: '#636E72', fontWeight: 600 }}>
              Look at the main projector screen! The match will start when the host clicks Start Round 1.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. GAMEPLAY SCREENS (ROUNDS 1, 2, 3)
  const currentQ = questions[currentQIndex];

  if ((match?.status === 'round1' || match?.status === 'round2' || match?.status === 'round3') && currentQ) {
    const avatar = getPlayerAvatar(player.display_name);

    return (
      <div style={gameplayContainerStyle}>
        {/* Mobile Top Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="avatar-badge" style={{ background: avatar.bgColor, width: '36px', height: '36px', fontSize: '1.2rem' }}>
              {avatar.emoji}
            </div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#2D3436' }}>{player.display_name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Question Progress Pill */}
            <span style={{ background: '#6C5CE7', color: '#FFFFFF', padding: '0.3rem 0.75rem', borderRadius: '999px', fontWeight: 800, fontSize: '0.9rem' }}>
              {currentQIndex + 1} / 5
            </span>

            {/* Timer Pill */}
            <span className="timer-pill" style={{ fontSize: '1rem', padding: '0.3rem 0.75rem' }}>
              <Clock size={16} /> {timeLeftSec}s
            </span>
          </div>
        </header>

        {/* Question Title & Prompt */}
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6C5CE7', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ROUND {currentQ.round} — {currentQ.round === 1 ? 'REAL OR FAKE?' : currentQ.round === 2 ? 'DECODE THE BRAND' : 'EMOJI DECODE'}
          </span>
          <h2 style={{ fontSize: '1.25rem', color: '#2D3436', marginTop: '0.2rem' }}>
            {currentQ.prompt_text}
          </h2>
        </div>

        {/* Content Area (Round 1 Images vs Round 2 Logo vs Round 3 Emoji) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: '0.75rem' }}>

          {/* ROUND 1: Two Images Side by Side */}
          {currentQ.round === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', height: '220px' }}>
              {/* Left Image */}
              <button
                disabled={isAnswerSubmitted}
                onClick={() => submitAnswer(currentQ.isRealOnLeft ? 'real' : 'ai')}
                style={{
                  border: selectedOption === (currentQ.isRealOnLeft ? 'real' : 'ai') ? '4px solid #6C5CE7' : '2px solid #E2E8F0',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0,
                  background: '#F1F5F9',
                  cursor: 'pointer'
                }}
              >
                <img
                  src={currentQ.isRealOnLeft ? currentQ.real_image_url : currentQ.ai_image_url}
                  alt="Option A"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=Sample+Image'; }}
                />
                <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#FFF', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
                  IMAGE A
                </span>
              </button>

              {/* Right Image */}
              <button
                disabled={isAnswerSubmitted}
                onClick={() => submitAnswer(currentQ.isRealOnLeft ? 'ai' : 'real')}
                style={{
                  border: selectedOption === (currentQ.isRealOnLeft ? 'ai' : 'real') ? '4px solid #6C5CE7' : '2px solid #E2E8F0',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0,
                  background: '#F1F5F9',
                  cursor: 'pointer'
                }}
              >
                <img
                  src={currentQ.isRealOnLeft ? currentQ.ai_image_url : currentQ.real_image_url}
                  alt="Option B"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=Sample+Image'; }}
                />
                <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#FFF', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
                  IMAGE B
                </span>
              </button>
            </div>
          )}

          {/* ROUND 2: Brand Logo Display */}
          {currentQ.round === 2 && (
            <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
              <div style={{ width: '120px', height: '120px', margin: '0 auto', padding: '1rem', background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={currentQ.logo_url}
                  alt="Brand Logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '🤖'; }}
                />
              </div>
            </div>
          )}

          {/* ROUND 3: Emoji Clue Display */}
          {currentQ.round === 3 && (
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <span style={{ fontSize: '4.5rem', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))' }}>
                {currentQ.prompt_text}
              </span>
            </div>
          )}

          {/* Answer Options Grid (Round 2 & 3: 4 Choice Buttons) */}
          {currentQ.round !== 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                      fontSize: '1rem',
                      padding: '0.9rem 0.5rem',
                      minHeight: '60px',
                      borderRadius: '16px',
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

        {/* Answer Result & Explanation Overlay */}
        {answerResult && (
          <div style={{
            background: answerResult.isCorrect ? '#E6FFFA' : '#FFF5F5',
            border: `2px solid ${answerResult.isCorrect ? '#38B2AC' : '#E53E3E'}`,
            borderRadius: '16px',
            padding: '0.85rem 1rem',
            textAlign: 'center',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              {answerResult.isCorrect ? (
                <>
                  <CheckCircle2 color="#38B2AC" size={24} />
                  <strong style={{ color: '#2C7A7B', fontSize: '1.1rem' }}>CORRECT! +{answerResult.points} pts</strong>
                </>
              ) : (
                <>
                  <XCircle color="#E53E3E" size={24} />
                  <strong style={{ color: '#C53030', fontSize: '1.1rem' }}>INCORRECT</strong>
                </>
              )}
            </div>
            <p style={{ color: '#4A5568', fontSize: '0.85rem' }}>
              {answerResult.explanation}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 4. INTERIM ROUND RESULTS WAIT SCREEN (Round 1 & Round 2 Results)
  if (match?.status === 'round1_results' || match?.status === 'round2_results') {
    const roundNum = match.status === 'round1_results' ? 1 : 2;
    const avatar = getPlayerAvatar(player.display_name);

    return (
      <div style={playerContainerStyle}>
        <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div className="avatar-badge" style={{ background: avatar.bgColor, width: '64px', height: '64px', fontSize: '2rem', margin: '0 auto 0.75rem' }}>
            {avatar.emoji}
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#2D3436' }}>ROUND {roundNum} COMPLETE!</h2>
          <span style={{ display: 'inline-block', background: '#E0E7FF', color: '#4338CA', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 700, marginTop: '0.4rem', marginBottom: '1.5rem' }}>
            {player.display_name}
          </span>

          <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#636E72', fontWeight: 700, display: 'block' }}>YOUR CURRENT SCORE</span>
            <strong style={{ fontSize: '2.5rem', color: '#6C5CE7' }}>{playerScore} pts</strong>
            {playerRank && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ background: '#FEFCBF', color: '#744210', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem' }}>
                  CURRENT RANK #{playerRank}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: '#EEF2FF', padding: '1rem', borderRadius: '16px', border: '1px solid #C7D2FE' }}>
            <p style={{ color: '#4338CA', fontWeight: 600, fontSize: '0.9rem' }}>
              Look at the arena projector display! Waiting for host to start Round {roundNum + 1}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. AFTER ROUND 3 / FINAL MATCH COMPLETE SCREEN
  return (
    <div style={playerContainerStyle}>
      <div className="card-light" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
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
              <span style={{ background: '#FEFCBF', color: '#744210', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem' }}>
                RANK #{playerRank}
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
  background: 'linear-gradient(135deg, #F4F5F9 0%, #E2E8F0 100%)'
};

const gameplayContainerStyle = {
  minHeight: '100vh',
  maxHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-right))',
  background: '#FFFFFF',
  overflow: 'hidden'
};
