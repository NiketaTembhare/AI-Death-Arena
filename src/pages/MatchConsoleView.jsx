import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { audioManager } from '../lib/audioManager';
import { getPlayerAvatar } from '../lib/avatar';
import { syncServerClock, getServerTimeMs, getClockOffsetMs } from '../lib/serverClock';
import { getSeededShuffledOptions, getSeededIsRealOnLeft } from '../lib/questionUtils';
import { Volume2, VolumeX, Play, Award, RotateCcw, Crown, Users, ArrowRight, X, ArrowLeft, Clock } from 'lucide-react';
import ArenaBackground from '../components/ArenaBackground';
import EmojiRain from '../components/EmojiRain';
import ArenaIntroOverlay from '../components/ArenaIntroOverlay';

export default function MatchConsoleView() {
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [activeRoundQuestions, setActiveRoundQuestions] = useState([]);
  const [nowMs, setNowMs] = useState(getServerTimeMs());
  const [isMuted, setIsMuted] = useState(audioManager.isMuted);
  const [countdownNum, setCountdownNum] = useState(null);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const previousStatusRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastBeepedRef = useRef(null);
  const hasFiredFinalCelebrationRef = useRef(false);

  const lastCountdownRoundRef = useRef(null);

  const triggerSynchronizedCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    lastBeepedRef.current = null;

    let step = 3;
    setCountdownNum(3);
    if (lastBeepedRef.current !== 3) {
      lastBeepedRef.current = 3;
      audioManager.playCountdownBeep(3);
    }

    countdownIntervalRef.current = setInterval(() => {
      step -= 1;
      if (step >= 0) {
        setCountdownNum(step);
        if (lastBeepedRef.current !== step) {
          lastBeepedRef.current = step;
          audioManager.playCountdownBeep(step);
        }
      } else {
        setCountdownNum(null);
        setIsStartingRound(false);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 950);
  };

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

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

  const matchRef = useRef(match);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  // 1. Fetch current active match on mount & sync server clock
  const fetchActiveMatch = async () => {
    syncServerClock().then((offset) => {
      console.log('Device clock vs server clock offset (ms):', offset);
    });

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

    // Fetch assigned questions count per player for the current round
    let assignedCountMap = {};
    if (currentRound && Number(currentRound) > 0) {
      const { data: assignedRows } = await supabase
        .from('match_round_questions')
        .select('player_id, round')
        .eq('match_id', matchId)
        .eq('round', Number(currentRound));

      if (assignedRows) {
        assignedRows.forEach((r) => {
          assignedCountMap[r.player_id] = (assignedCountMap[r.player_id] || 0) + 1;
        });
      }
    }

    // Fetch submitted answers
    const { data: answerRows } = await supabase
      .from('match_answers')
      .select('player_id, round, is_correct, points_earned')
      .eq('match_id', matchId);

    const answers = answerRows || [];

    let donePlayersCount = 0;

    const aggregated = playerRows.map((p) => {
      const pAnswers = answers.filter((a) => a.player_id === p.id);

      const r1Answers = pAnswers.filter((a) => Number(a.round) === 1);
      const r2Answers = pAnswers.filter((a) => Number(a.round) === 2);
      const r3Answers = pAnswers.filter((a) => Number(a.round) === 3);

      const r1Score = r1Answers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const r2Score = r2Answers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const r3Score = r3Answers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const totalScore = r1Score + r2Score + r3Score;

      const correctCount = pAnswers.filter((a) => a.is_correct === true).length;

      const roundAnswersCount = (currentRound && Number(currentRound) > 0)
        ? pAnswers.filter((a) => Number(a.round) === Number(currentRound)).length
        : 0;

      const targetRoundCount = assignedCountMap[p.id] || 5;

      if (!p.has_left && roundAnswersCount > 0 && roundAnswersCount >= targetRoundCount) {
        donePlayersCount++;
      }

      return {
        player_id: p.id,
        match_id: matchId,
        display_name: p.display_name,
        device_token: p.device_token,
        has_left: p.has_left,
        r1_score: r1Score,
        r2_score: r2Score,
        r3_score: r3Score,
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

  // 3. Fetch active round questions for Host Display
  const fetchActiveRoundQuestions = async (matchId, currentRound) => {
    if (!matchId || !currentRound || Number(currentRound) <= 0) {
      setActiveRoundQuestions([]);
      return;
    }
    const { data } = await supabase
      .from('match_round_questions')
      .select('question_id, position, questions(*)')
      .eq('match_id', matchId)
      .eq('round', Number(currentRound))
      .order('position', { ascending: true });

    if (data && data.length > 0) {
      const uniqueMap = new Map();
      data.forEach((item) => {
        if (item.questions && !uniqueMap.has(item.question_id)) {
          uniqueMap.set(item.question_id, item.questions);
        }
      });
      setActiveRoundQuestions(Array.from(uniqueMap.values()));
    } else {
      const { data: pool } = await supabase
        .from('questions')
        .select('*')
        .eq('round', Number(currentRound))
        .eq('is_active', true)
        .order('id', { ascending: true })
        .limit(5);

      if (pool) setActiveRoundQuestions(pool);
    }
  };

  useEffect(() => {
    if (match?.id && match?.current_round && Number(match.current_round) > 0) {
      fetchActiveRoundQuestions(match.id, match.current_round);
    }
  }, [match?.id, match?.current_round, match?.status]);

  useEffect(() => {
    if (match?.status === 'round1' || match?.status === 'round2' || match?.status === 'round3') {
      const interval = setInterval(() => {
        setNowMs(getServerTimeMs());
      }, 250);
      return () => clearInterval(interval);
    }
  }, [match?.status]);

  const DARK_BRIGHT_COLORS = ['#F59E0B', '#7C3AED', '#EC4899', '#06B6D4', '#EF4444', '#10B981', '#F97316'];
  const CELEBRATION_EMOJIS = ['👏🏻', '👏🏼', '✨', '💸', '🥳', '🎉', '🎊', '🪩'];

  const getEmojiShapes = () => {
    if (typeof confetti.shapeFromText === 'function') {
      return CELEBRATION_EMOJIS.map((emoji) =>
        confetti.shapeFromText({ text: emoji, scalar: 2.5 })
      );
    }
    return [];
  };

  const triggerRoundResultsCelebration = () => {
    // Round 1 & Round 2 Results: Large dark-bright paper strips (scalar: 1.8 - 2.8)
    setTimeout(() => {
      confetti({
        zIndex: 999999,
        particleCount: 130,
        spread: 90,
        startVelocity: 55,
        origin: { y: 0.6 },
        scalar: 2.2,
        shapes: ['square'],
        colors: DARK_BRIGHT_COLORS
      });
    }, 150);

    setTimeout(() => {
      confetti({
        zIndex: 999999,
        particleCount: 80,
        angle: 60,
        spread: 75,
        startVelocity: 60,
        origin: { x: 0, y: 0.75 },
        scalar: 2.6,
        shapes: ['square'],
        colors: DARK_BRIGHT_COLORS
      });
      confetti({
        zIndex: 999999,
        particleCount: 80,
        angle: 120,
        spread: 75,
        startVelocity: 60,
        origin: { x: 1, y: 0.75 },
        scalar: 2.6,
        shapes: ['square'],
        colors: DARK_BRIGHT_COLORS
      });
    }, 600);

    setTimeout(() => {
      confetti({
        zIndex: 999999,
        particleCount: 100,
        spread: 120,
        startVelocity: 45,
        origin: { y: 0.5 },
        scalar: 2.8,
        shapes: ['square'],
        colors: DARK_BRIGHT_COLORS
      });
    }, 1100);
  };

  const triggerFinalChampionsCelebration = () => {
    if (hasFiredFinalCelebrationRef.current) return;
    hasFiredFinalCelebrationRef.current = true;

    audioManager.playFinalFanfare();
    audioManager.playApplauseClapping(5);

    const emojiShapes = getEmojiShapes();
    const mixedShapes = ['square', ...emojiShapes];

    // 1. INSTANT (0ms) Center Explosive Mega Burst - 300 Particles!
    confetti({
      zIndex: 999999,
      particleCount: 300,
      spread: 120,
      startVelocity: 70,
      origin: { y: 0.6 },
      scalar: 2.8,
      shapes: mixedShapes,
      colors: DARK_BRIGHT_COLORS
    });

    // 2. 250ms Dual Cannon Blast from Left & Right Sides (300 total particles)
    setTimeout(() => {
      confetti({
        zIndex: 999999,
        particleCount: 150,
        angle: 55,
        spread: 90,
        startVelocity: 75,
        origin: { x: 0, y: 0.7 },
        scalar: 3.0,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS
      });
      confetti({
        zIndex: 999999,
        particleCount: 150,
        angle: 125,
        spread: 90,
        startVelocity: 75,
        origin: { x: 1, y: 0.7 },
        scalar: 3.0,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS
      });
    }, 250);

    // 3. 500ms High-Altitude Center Explosion (200 particles)
    setTimeout(() => {
      confetti({
        zIndex: 999999,
        particleCount: 200,
        spread: 140,
        startVelocity: 60,
        origin: { y: 0.4 },
        scalar: 3.2,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS
      });
    }, 500);

    // 4. Continuous High-Density Shower (Raining down for 6 full seconds)
    const duration = 6000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.2 },
        scalar: 2.5,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS,
        zIndex: 999999
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.2 },
        scalar: 2.5,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS,
        zIndex: 999999
      });
      confetti({
        particleCount: 6,
        angle: 90,
        spread: 100,
        origin: { x: 0.5, y: 0.1 },
        scalar: 2.8,
        shapes: mixedShapes,
        colors: DARK_BRIGHT_COLORS,
        zIndex: 999999
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    setTimeout(frame, 600);
  };

  const handleStatusSoundCue = (status) => {
    // Explicitly NO celebration/confetti/sound on Round Start (round1, round2, round3)
    if (status === 'round1_results' || status === 'round2_results') {
      audioManager.playDrumroll(1.3);
      audioManager.playApplauseClapping(4);
      setTimeout(() => audioManager.playRoundEnd(), 1300);
      triggerRoundResultsCelebration();
    } else if (status === 'final_results') {
      audioManager.playFinalFanfare();
      audioManager.playApplauseClapping(4);
      triggerFinalChampionsCelebration();
    }
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

        if (newMatch.round_started_at && (newMatch.status === 'round1' || newMatch.status === 'round2' || newMatch.status === 'round3')) {
          const roundKey = `${newMatch.current_round}_${newMatch.round_started_at}`;
          if (lastCountdownRoundRef.current !== roundKey) {
            lastCountdownRoundRef.current = roundKey;
            triggerSynchronizedCountdown();
          }
        }

        if (previousStatusRef.current !== newMatch.status) {
          handleStatusSoundCue(newMatch.status);
          previousStatusRef.current = newMatch.status;
        }
      })
      .subscribe();

    // Subscribe to joined players
    const playerChannel = supabase
      .channel(`players_${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${match.id}` }, (payload) => {
        fetchLiveLeaderboardAndProgress(match.id, matchRef.current?.current_round);
        if (payload.eventType === 'INSERT' && matchRef.current?.status === 'lobby') {
          audioManager?.playPlayerJoined?.();
        }
      })
      .subscribe();

    // Subscribe to submitted answers
    const answersChannel = supabase
      .channel(`answers_${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_answers', filter: `match_id=eq.${match.id}` }, () => {
        fetchLiveLeaderboardAndProgress(match.id, matchRef.current?.current_round);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(playerChannel);
      supabase.removeChannel(answersChannel);
    };
  }, [match?.id]);

  // Derived timer & question states for active round
  const totalQuestionsCount = activeRoundQuestions.length || 5;
  const totalRoundDuration = totalQuestionsCount * 10;

  const isRoundActive = match?.status === 'round1' || match?.status === 'round2' || match?.status === 'round3';
  const startedAtMs = (isRoundActive && match?.round_started_at) ? new Date(match.round_started_at).getTime() : nowMs;
  const elapsedSec = Math.max(0, (nowMs - startedAtMs) / 1000);
  const isCountdownActive = isRoundActive && elapsedSec < 4.5;
  const gameElapsedSec = isCountdownActive ? 0 : Math.max(0, elapsedSec - 4.5);
  const currentQIndex = Math.min(Math.max(0, totalQuestionsCount - 1), Math.floor(gameElapsedSec / 10));
  const questionTimeLeftSec = isCountdownActive ? 10 : (gameElapsedSec >= totalRoundDuration ? 0 : Math.max(0, Math.ceil(10 - (gameElapsedSec % 10))));
  const isRoundQuestionsComplete = isRoundActive && gameElapsedSec >= totalRoundDuration;
  const currentLiveQuestion = activeRoundQuestions[currentQIndex] || null;

  // Guarded Auto-Transition to Round Results / Final Results on 10s Timer Expiry of Final Question
  const autoTransitionKeyRef = useRef(null);
  useEffect(() => {
    if (!match?.id || !isRoundActive) return;

    if (gameElapsedSec >= totalRoundDuration) {
      const key = `${match.id}_${match.status}`;
      if (autoTransitionKeyRef.current !== key) {
        autoTransitionKeyRef.current = key;
        if (match.status === 'round1') {
          updateMatchStatus('round1_results', 1);
        } else if (match.status === 'round2') {
          updateMatchStatus('round2_results', 2);
        } else if (match.status === 'round3') {
          updateMatchStatus('final_results', 3);
        }
      }
    }
  }, [match?.id, match?.status, gameElapsedSec, isRoundActive, totalRoundDuration]);

  // Play Urgency Ticks on Host during the last 5 seconds of every question
  const lastHostUrgencyKeyRef = useRef(null);
  useEffect(() => {
    if (!isRoundActive || isCountdownActive || isRoundQuestionsComplete) return;
    if (questionTimeLeftSec <= 5 && questionTimeLeftSec > 0) {
      const key = `${match?.current_round}_${currentQIndex}_${questionTimeLeftSec}`;
      if (lastHostUrgencyKeyRef.current !== key) {
        lastHostUrgencyKeyRef.current = key;
        audioManager?.playUrgencyTick?.(questionTimeLeftSec);
      }
    }
  }, [isRoundActive, isCountdownActive, isRoundQuestionsComplete, match?.current_round, currentQIndex, questionTimeLeftSec]);

  // State A action: Start New Match (auto-archive non-final active matches)
  const handleStartNewMatch = async () => {
    hasFiredFinalCelebrationRef.current = false;
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

      if (!error && data) {
        setMatch(data);
        previousStatusRef.current = 'lobby';
      }
    } catch (err) {
      console.error('Failed to create match:', err);
      alert('Error creating match. Check Supabase database setup.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to assign random round questions per player (guaranteeing 5 DISTINCT questions per player per round, same set & order for all players, avoiding recent matches)
  const assignRoundQuestionsForPlayers = async (matchId, roundNum) => {
    // 1 & 2. Load current players
    const { data: currentPlayers } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', matchId);

    if (!currentPlayers || currentPlayers.length === 0) return;

    // 3. Find the last 3 previous matches, excluding the current match
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('id')
      .neq('id', matchId)
      .order('created_at', { ascending: false })
      .limit(3);

    const recentMatchIds = (recentMatches || []).map((m) => m.id);

    // 4. Find question IDs used in the same round of those previous matches
    let recentQuestionIds = new Set();
    if (recentMatchIds.length > 0) {
      const { data: recentRoundQuestions } = await supabase
        .from('match_round_questions')
        .select('question_id')
        .in('match_id', recentMatchIds)
        .eq('round', roundNum);

      if (recentRoundQuestions && recentRoundQuestions.length > 0) {
        recentRoundQuestions.forEach((r) => {
          if (r.question_id) recentQuestionIds.add(r.question_id);
        });
      }
    }

    // 5. Load the active question pool for this round
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id')
      .eq('round', roundNum)
      .eq('is_active', true);

    if (!allQuestions || allQuestions.length === 0) return;

    // Deduplicate available question pool by ID
    const uniqueQuestionsMap = new Map();
    allQuestions.forEach((q) => uniqueQuestionsMap.set(q.id, q));
    const fullPool = Array.from(uniqueQuestionsMap.values());

    if (fullPool.length < 5) return;

    // 6. Remove recently used question IDs from the pool
    let eligiblePool = fullPool.filter((q) => !recentQuestionIds.has(q.id));

    // 7. Fallback: If fewer than 5 remain, use the full active question pool
    if (eligiblePool.length < 5) {
      eligiblePool = [...fullPool];
    }

    // 8. Shuffle the eligible pool once
    const shuffled = [...eligiblePool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 9. Select exactly 5 question IDs
    const selectedQuestions = shuffled.slice(0, 5);

    // 10. Delete old assignments for this match and round
    await supabase
      .from('match_round_questions')
      .delete()
      .eq('match_id', matchId)
      .eq('round', roundNum);

    // 11. Loop through currentPlayers: Insert the same 5 question IDs in the same order for each player
    const rowsToInsert = [];
    currentPlayers.forEach((player) => {
      selectedQuestions.forEach((q, idx) => {
        rowsToInsert.push({
          match_id: matchId,
          player_id: player.id,
          round: roundNum,
          question_id: q.id,
          position: idx + 1
        });
      });
    });

    // 12. Insert rows and return
    if (rowsToInsert.length > 0) {
      await supabase.from('match_round_questions').insert(rowsToInsert);
    }
  };

  // Advance round status
  const updateMatchStatus = async (nextStatus, roundNum) => {
    if (isStartingRound || countdownNum !== null) return;
    audioManager.initContext();

    if (nextStatus === 'final_results') {
      // INSTANTLY launch celebration & podium view on host click (0ms delay!)
      triggerFinalChampionsCelebration();
      setMatch((prev) => (prev ? { ...prev, status: 'final_results', current_round: 3 } : prev));
    }

    const isStarting = nextStatus === 'round1' || nextStatus === 'round2' || nextStatus === 'round3';
    if (isStarting) {
      setIsStartingRound(true);
    }

    try {
      if (isStarting) {
        // Assign questions first so DB latency doesn't burn the countdown window
        await assignRoundQuestionsForPlayers(match.id, roundNum);
      }

      const updatePayload = {
        status: nextStatus,
        current_round: roundNum
      };

      if (isStarting) {
        updatePayload.round_started_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', match.id)
        .select()
        .single();

      if (!error && data) {
        setMatch(data);
        if (isStarting) {
          const roundKey = `${data.current_round}_${data.round_started_at}`;
          lastCountdownRoundRef.current = roundKey;
          triggerSynchronizedCountdown();
        }
      } else {
        setIsStartingRound(false);
      }
    } catch (err) {
      console.error('Error updating match status:', err);
      setIsStartingRound(false);
    }
  };

  if (loading) {
    return (
      <ArenaBackground>
        <div style={darkPageStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="card-console" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #6C5CE7',
                borderTopColor: '#FDCB6E',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1.5rem auto'
              }} />
              <h2 style={{ fontSize: '1.6rem', color: '#FFFFFF', marginBottom: '0.5rem' }}>Loading Match Console...</h2>
              <p style={{ color: '#A29BFE', fontSize: '0.9rem', fontWeight: 600 }}>Connecting to IAE AI-BATTLEGROUND server</p>
            </div>
          </div>
        </div>
      </ArenaBackground>
    );
  }

  const renderLeaderboardTable = () => {
    if (leaderboard.length === 0) {
      return <p style={{ color: '#A29BFE', textAlign: 'center', padding: '2rem' }}>Waiting for player scores...</p>;
    }
    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: '580px' }}>
          {/* Table Column Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 2fr 1fr 1fr 1fr 1.2fr 35px',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            marginBottom: '0.5rem',
            color: '#A29BFE',
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            borderBottom: '1px solid #2D2856'
          }}>
            <div>RANK</div>
            <div>PLAYER</div>
            <div style={{ textAlign: 'center' }}>ROUND 1</div>
            <div style={{ textAlign: 'center' }}>ROUND 2</div>
            <div style={{ textAlign: 'center' }}>ROUND 3</div>
            <div style={{ textAlign: 'right' }}>TOTAL SCORE</div>
            <div></div>
          </div>

          {/* Animated Rows Container */}
          <div style={{
            position: 'relative',
            height: `${leaderboard.length * 68}px`,
            transition: 'height 300ms ease'
          }}>
            {leaderboard.map((player, idx) => {
              const avatar = getPlayerAvatar(player.display_name);
              const isFirst = idx === 0;

              return (
                <div
                  key={player.player_id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '56px',
                    transform: `translateY(${idx * 68}px)`,
                    transition: 'transform 450ms cubic-bezier(0.2, 0, 0, 1), background-color 300ms ease, border-color 300ms ease',
                    background: isFirst ? 'linear-gradient(90deg, #1E1A3C, #322A63)' : '#161334',
                    border: isFirst ? '2px solid #FDCB6E' : '1px solid #2D2856',
                    borderRadius: '16px',
                    padding: '0 0.85rem',
                    display: 'grid',
                    gridTemplateColumns: '60px 2fr 1fr 1fr 1fr 1.2fr 35px',
                    gap: '0.5rem',
                    alignItems: 'center',
                    boxShadow: isFirst ? '0 4px 20px rgba(253, 203, 110, 0.2)' : 'none'
                  }}
                >
                  {/* RANK */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {isFirst && <Crown size={16} color="#FDCB6E" />}
                    <span style={{
                      fontSize: '1.15rem',
                      fontWeight: 900,
                      color: isFirst ? '#FDCB6E' : idx === 1 ? '#DFE6E9' : idx === 2 ? '#E17055' : '#A29BFE'
                    }}>
                      #{idx + 1}
                    </span>
                  </div>

                  {/* PLAYER */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    <div className="avatar-badge" style={{ background: avatar.bgColor, width: '32px', height: '32px', fontSize: '1.1rem', flexShrink: 0 }}>
                      {avatar.emoji}
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.display_name}
                    </span>
                  </div>

                  {/* ROUND 1 */}
                  <div style={{ textAlign: 'center', fontWeight: 700, color: player.r1_score > 0 ? '#00B894' : '#636E72', fontSize: '0.95rem' }}>
                    {player.r1_score > 0 ? `+${player.r1_score}` : '—'}
                  </div>

                  {/* ROUND 2 */}
                  <div style={{ textAlign: 'center', fontWeight: 700, color: player.r2_score > 0 ? '#00B894' : '#636E72', fontSize: '0.95rem' }}>
                    {player.r2_score > 0 ? `+${player.r2_score}` : '—'}
                  </div>

                  {/* ROUND 3 */}
                  <div style={{ textAlign: 'center', fontWeight: 700, color: player.r3_score > 0 ? '#00B894' : '#636E72', fontSize: '0.95rem' }}>
                    {player.r3_score > 0 ? `+${player.r3_score}` : '—'}
                  </div>

                  {/* TOTAL */}
                  <div style={{ textAlign: 'right', fontSize: '1.2rem', fontWeight: 900, color: '#FDCB6E' }}>
                    {player.total_score} <span style={{ fontSize: '0.8rem', color: '#A29BFE' }}>pts</span>
                  </div>

                  {/* REMOVE ACTION */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleRemovePlayer(player.player_id, player.display_name)}
                      title="Remove player from match"
                      style={{
                        background: 'rgba(255, 118, 117, 0.15)',
                        border: '1px solid #FF7675',
                        color: '#FF7675',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const joinUrl = match ? `${window.location.origin}/play?room=${match.room_code}` : '';

  return (
    <ArenaBackground>
      {showIntroOverlay && (
        <ArenaIntroOverlay onClose={() => setShowIntroOverlay(false)} />
      )}
      <div style={darkPageStyle}>
        {/* Console Header */}
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/')}
              className="btn"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                padding: '0.55rem 1.1rem',
                fontSize: '0.95rem',
                backdropFilter: 'blur(8px)'
              }}
            >
              <ArrowLeft size={20} /> BACK TO HOME
            </button>

            <div>
              <h1 className="brand-title" style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', whiteSpace: 'nowrap' }}>IAE AI-BATTLEGROUND</h1>
              <p style={{ color: '#A29BFE', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '1px' }}>AI KNOWLEDGE CHECK ⚡ GEN-Z ARENA EDITION</p>
            </div>
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
                  disabled={players.length === 0 || isStartingRound || countdownNum !== null}
                  onClick={() => !isStartingRound && countdownNum === null && updateMatchStatus('round1', 1)}
                  className={`btn btn-green ${players.length === 0 || isStartingRound || countdownNum !== null ? 'btn-disabled' : ''}`}
                  style={{ width: '100%', fontSize: '1.3rem' }}
                >
                  <Play size={24} /> {isStartingRound || countdownNum !== null ? 'STARTING ROUND 1...' : 'START ROUND 1'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATE C: ROUND IN PROGRESS / BETWEEN ROUNDS */}
        {match && match.status !== 'lobby' && match.status !== 'final_results' && match.status !== 'archived' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* FULL-WIDTH TOP SECTION: Current Match Status */}
            <div
              className="card-console"
              style={{
                padding: '1.1rem 1.5rem',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              {/* Header Title & Current Round */}
              <div>
                <span style={{ color: '#FDCB6E', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '1px' }}>
                  CURRENT MATCH STATUS
                </span>
                <h2 style={{ fontSize: '1.85rem', textTransform: 'uppercase', color: '#FFFFFF', lineHeight: '1.1' }}>
                  {match.status.replace('_', ' ')}
                </h2>
              </div>

              {/* Right Controls Container (Answered Progress + Round Action Buttons) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
                {/* Answered Progress Indicator for Host */}
                {(match.status === 'round1' || match.status === 'round2' || match.status === 'round3') && (
                  <div style={{ background: '#161334', border: '1px solid #00B894', padding: '0.45rem 1.2rem', borderRadius: '14px', textAlign: 'center' }}>
                    <span style={{ color: '#A29BFE', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>ANSWERED PROGRESS</span>
                    <strong style={{ fontSize: '1.2rem', color: '#00B894' }}>
                      {answeredCount} / {players.length} Players Done
                    </strong>
                  </div>
                )}

                {/* Sequential Round Progression Controls */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {match.status === 'round1' && (
                    <button onClick={() => updateMatchStatus('round1_results', 1)} className="btn btn-orange" style={{ fontSize: '1rem', padding: '0.6rem 1.25rem' }}>
                      SHOW ROUND 1 RESULTS <ArrowRight size={18} />
                    </button>
                  )}

                  {match.status === 'round1_results' && (
                    <button
                      disabled={isStartingRound || countdownNum !== null}
                      onClick={() => !isStartingRound && countdownNum === null && updateMatchStatus('round2', 2)}
                      className={`btn btn-green ${isStartingRound || countdownNum !== null ? 'btn-disabled' : ''}`}
                      style={{ fontSize: '1rem', padding: '0.6rem 1.25rem' }}
                    >
                      {isStartingRound || countdownNum !== null ? 'STARTING ROUND 2...' : 'START ROUND 2'} <Play size={18} />
                    </button>
                  )}

                  {match.status === 'round2' && (
                    <button onClick={() => updateMatchStatus('round2_results', 2)} className="btn btn-orange" style={{ fontSize: '1rem', padding: '0.6rem 1.25rem' }}>
                      SHOW ROUND 2 RESULTS <ArrowRight size={18} />
                    </button>
                  )}

                  {match.status === 'round2_results' && (
                    <button
                      disabled={isStartingRound || countdownNum !== null}
                      onClick={() => !isStartingRound && countdownNum === null && updateMatchStatus('round3', 3)}
                      className={`btn btn-green ${isStartingRound || countdownNum !== null ? 'btn-disabled' : ''}`}
                      style={{ fontSize: '1rem', padding: '0.6rem 1.25rem' }}
                    >
                      {isStartingRound || countdownNum !== null ? 'STARTING ROUND 3...' : 'START ROUND 3'} <Play size={18} />
                    </button>
                  )}

                  {match.status === 'round3' && (
                    <button onClick={() => updateMatchStatus('final_results', 3)} className="btn btn-yellow" style={{ fontSize: '1rem', padding: '0.6rem 1.25rem', color: '#2D3436' }}>
                      SHOW FINAL RESULTS <Award size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* MAIN ARENA CONTENT: 2 columns when round active (Left = Question Area, Right = Leaderboard) */}
            {isRoundActive ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.25rem',
                alignItems: 'start'
              }}>
                {/* LEFT SIDE — LIVE QUESTION AREA */}
                <div className="card-console" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '340px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      background: 'rgba(108, 92, 231, 0.25)',
                      border: '1px solid #6C5CE7',
                      color: '#A29BFE',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      letterSpacing: '0.5px'
                    }}>
                      QUESTION {currentQIndex + 1} / {activeRoundQuestions.length || 5}
                    </span>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: questionTimeLeftSec <= 5 ? '#FF7675' : '#00B894',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      background: '#161334',
                      border: `1px solid ${questionTimeLeftSec <= 5 ? '#FF7675' : '#00B894'}`,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px'
                    }}>
                      <Clock size={18} /> {questionTimeLeftSec}s
                    </span>
                  </div>

                  {/* Question Content */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FDCB6E', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      ROUND {match.current_round} — {match.current_round === 1 ? 'REAL OR FAKE?' : match.current_round === 2 ? 'DECODE THE BRAND' : 'EMOJI DECODE'}
                    </span>

                    <h3 style={{
                      color: '#FFFFFF',
                      fontSize: 'clamp(1.15rem, 2.2vw, 1.45rem)',
                      fontWeight: 800,
                      lineHeight: '1.35',
                      marginBottom: '1rem',
                      maxWidth: '92%'
                    }}>
                      {currentLiveQuestion ? (
                        currentLiveQuestion.round === 3
                          ? (currentLiveQuestion.prompt_text?.length < 10 ? 'WHICH AI CONCEPT DO THESE EMOJIS REPRESENT?' : currentLiveQuestion.prompt_text)
                          : currentLiveQuestion.prompt_text
                      ) : 'Loading active question...'}
                    </h3>

                    {/* ROUND 2: Brand Logo Display (Fixed Visibility on Host) */}
                    {currentLiveQuestion && currentLiveQuestion.round === 2 && currentLiveQuestion.logo_url && (
                      <div style={{
                        background: '#FFFFFF',
                        borderRadius: '20px',
                        padding: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 'clamp(130px, 15vw, 170px)',
                        height: 'clamp(130px, 15vw, 170px)',
                        margin: '0.4rem 0 0.6rem 0',
                        boxShadow: '0 10px 28px rgba(108, 92, 231, 0.25), 0 4px 12px rgba(0,0,0,0.12)',
                        border: '3px solid #EEF2FF'
                      }}>
                        <img
                          src={currentLiveQuestion.logo_url}
                          alt="Brand Logo"
                          style={{ width: '80%', height: '80%', maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.parentNode) e.target.parentNode.innerHTML = '<span style="font-size:3rem;">🤖</span>';
                          }}
                        />
                      </div>
                    )}

                    {/* ROUND 3: Large Emojis Display */}
                    {currentLiveQuestion && currentLiveQuestion.round === 3 && (
                      <div style={{ margin: '0.5rem 0 0.75rem 0' }}>
                        <span style={{
                          fontSize: 'clamp(3.5rem, 7vw, 4.8rem)',
                          filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.4))',
                          lineHeight: 1,
                          letterSpacing: '0.25em'
                        }}>
                          {(() => {
                            const text = currentLiveQuestion.prompt_text || '';
                            try {
                              const matched = text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu);
                              return matched && matched.length > 0 ? matched.join(' ') : text;
                            } catch (e) {
                              return text;
                            }
                          })()}
                        </span>
                      </div>
                    )}

                    {/* ROUND 1: Answer Options Cards Displayed on Host (Display-Only for Audience) */}
                    {currentLiveQuestion && currentLiveQuestion.round === 1 && (() => {
                      const seedStr = `${match.id}_${currentLiveQuestion.id}`;

                      // Check if question has real_image_url & ai_image_url (Image Comparison format)
                      if (currentLiveQuestion.real_image_url || currentLiveQuestion.ai_image_url) {
                        const isRealOnLeft = getSeededIsRealOnLeft(seedStr);
                        const imgA = isRealOnLeft ? currentLiveQuestion.real_image_url : currentLiveQuestion.ai_image_url;
                        const imgB = isRealOnLeft ? currentLiveQuestion.ai_image_url : currentLiveQuestion.real_image_url;

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%', maxWidth: '560px', margin: '0.5rem 0' }}>
                            <div style={{
                              background: '#161334',
                              border: '2px solid #2D2856',
                              borderRadius: '16px',
                              overflow: 'hidden',
                              height: 'clamp(160px, 22vw, 240px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              padding: '0.4rem'
                            }}>
                              <img
                                src={imgA}
                                alt="Option A"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/300x200?text=Image+A'; }}
                              />
                              <span style={{
                                position: 'absolute',
                                bottom: '8px',
                                left: '8px',
                                background: 'rgba(0, 0, 0, 0.75)',
                                color: '#FFF',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                backdropFilter: 'blur(4px)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                              }}>
                                IMAGE A
                              </span>
                            </div>
                            <div style={{
                              background: '#161334',
                              border: '2px solid #2D2856',
                              borderRadius: '16px',
                              overflow: 'hidden',
                              height: 'clamp(160px, 22vw, 240px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              padding: '0.4rem'
                            }}>
                              <img
                                src={imgB}
                                alt="Option B"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/300x200?text=Image+B'; }}
                              />
                              <span style={{
                                position: 'absolute',
                                bottom: '8px',
                                left: '8px',
                                background: 'rgba(0, 0, 0, 0.75)',
                                color: '#FFF',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                backdropFilter: 'blur(4px)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                              }}>
                                IMAGE B
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Otherwise, check if question has options array (Text Choice format)
                      const rawOptions = currentLiveQuestion.options ? (typeof currentLiveQuestion.options === 'string' ? JSON.parse(currentLiveQuestion.options) : currentLiveQuestion.options) : [];
                      if (rawOptions && rawOptions.length > 0) {
                        const shuffledOptions = getSeededShuffledOptions(rawOptions, seedStr);
                        const colors = ['#FF7675', '#0984E3', '#FDCB6E', '#00B894'];
                        const letters = ['A', 'B', 'C', 'D'];

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%', maxWidth: '420px', margin: '0.35rem 0' }}>
                            {shuffledOptions.map((optText, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: '#161334',
                                  border: `2px solid ${colors[idx % 4]}`,
                                  borderRadius: '12px',
                                  padding: '0.45rem 0.6rem',
                                  textAlign: 'center',
                                  color: '#FFFFFF',
                                  fontSize: '0.85rem',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem'
                                }}
                              >
                                <span style={{ background: colors[idx % 4], color: idx === 2 ? '#2D3436' : '#FFF', padding: '0.15rem 0.45rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900 }}>
                                  {letters[idx] || idx + 1}
                                </span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                  {optText}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>

                {/* RIGHT SIDE — LIVE ARENA STANDINGS */}
                <div className="card-console" style={{ overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#A29BFE' }}>LIVE ARENA STANDINGS</h3>
                  {renderLeaderboardTable()}
                </div>
              </div>
            ) : (
              /* Between Rounds (Results Stage): Full-width Leaderboard */
              <div className="card-console">
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#A29BFE' }}>LIVE ARENA STANDINGS</h3>
                {renderLeaderboardTable()}
              </div>
            )}
          </div>
        )}

        {/* STATE D: MATCH COMPLETE (PODIUM & STANDINGS) */}
        {match && match.status === 'final_results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <EmojiRain count={85} />
            {/* Top 3 Podium Highlight */}
            <div className="card-console" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <Award size={48} color="#FDCB6E" style={{ margin: '0 auto 0.5rem' }} />
              <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>ARENA CHAMPIONS</h2>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* 2nd Place */}
                {leaderboard[1] && (
                  <div className="podium-pillar-2" style={{ textAlign: 'center', flex: 1, maxWidth: '200px' }}>
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
                  <div className="podium-pillar-1" style={{ textAlign: 'center', flex: 1, maxWidth: '220px' }}>
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
                  <div className="podium-pillar-3" style={{ textAlign: 'center', flex: 1, maxWidth: '200px' }}>
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

              {leaderboard.length === 0 ? (
                <p style={{ color: '#A29BFE', textAlign: 'center', padding: '2rem' }}>No player standings available.</p>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <div style={{ minWidth: '680px' }}>
                    {/* Table Column Headers */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 2fr 1fr 1fr 1fr 1.2fr 40px',
                      gap: '0.75rem',
                      padding: '0.5rem 1.25rem',
                      marginBottom: '0.5rem',
                      color: '#A29BFE',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #2D2856'
                    }}>
                      <div>RANK</div>
                      <div>PLAYER</div>
                      <div style={{ textAlign: 'center' }}>ROUND 1</div>
                      <div style={{ textAlign: 'center' }}>ROUND 2</div>
                      <div style={{ textAlign: 'center' }}>ROUND 3</div>
                      <div style={{ textAlign: 'right' }}>TOTAL SCORE</div>
                      <div></div>
                    </div>

                    {/* Animated Rows Container */}
                    <div style={{
                      position: 'relative',
                      height: `${leaderboard.length * 72}px`,
                      transition: 'height 300ms ease'
                    }}>
                      {leaderboard.map((player, idx) => {
                        const avatar = getPlayerAvatar(player.display_name);
                        const isFirst = idx === 0;

                        return (
                          <div
                            key={player.player_id}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '60px',
                              transform: `translateY(${idx * 72}px)`,
                              transition: 'transform 450ms cubic-bezier(0.2, 0, 0, 1), background-color 300ms ease, border-color 300ms ease',
                              background: isFirst ? 'linear-gradient(90deg, #1E1A3C, #322A63)' : '#161334',
                              border: isFirst ? '2px solid #FDCB6E' : '1px solid #2D2856',
                              borderRadius: '16px',
                              padding: '0 1.25rem',
                              display: 'grid',
                              gridTemplateColumns: '70px 2fr 1fr 1fr 1fr 1.2fr 40px',
                              gap: '0.75rem',
                              alignItems: 'center',
                              boxShadow: isFirst ? '0 4px 20px rgba(253, 203, 110, 0.2)' : 'none'
                            }}
                          >
                            {/* RANK */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isFirst && <Crown size={18} color="#FDCB6E" />}
                              <span style={{
                                fontSize: '1.25rem',
                                fontWeight: 900,
                                color: isFirst ? '#FDCB6E' : idx === 1 ? '#DFE6E9' : idx === 2 ? '#E17055' : '#A29BFE'
                              }}>
                                #{idx + 1}
                              </span>
                            </div>

                            {/* PLAYER */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                              <div className="avatar-badge" style={{ background: avatar.bgColor, width: '36px', height: '36px', fontSize: '1.2rem', flexShrink: 0 }}>
                                {avatar.emoji}
                              </div>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {player.display_name}
                              </span>
                            </div>

                            {/* ROUND 1 */}
                            <div style={{ textAlign: 'center', fontWeight: 700, color: player.r1_score > 0 ? '#00B894' : '#636E72', fontSize: '1rem' }}>
                              {player.r1_score > 0 ? `+${player.r1_score}` : '—'}
                            </div>

                            {/* ROUND 2 */}
                            <div style={{ textAlign: 'center', fontWeight: 700, color: player.r2_score > 0 ? '#00B894' : '#636E72', fontSize: '1rem' }}>
                              {player.r2_score > 0 ? `+${player.r2_score}` : '—'}
                            </div>

                            {/* ROUND 3 */}
                            <div style={{ textAlign: 'center', fontWeight: 700, color: player.r3_score > 0 ? '#00B894' : '#636E72', fontSize: '1rem' }}>
                              {player.r3_score > 0 ? `+${player.r3_score}` : '—'}
                            </div>

                            {/* TOTAL */}
                            <div style={{ textAlign: 'right', fontSize: '1.3rem', fontWeight: 900, color: '#FDCB6E' }}>
                              {player.total_score} <span style={{ fontSize: '0.85rem', color: '#A29BFE' }}>pts</span>
                            </div>

                            <div></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Synchronized Countdown Overlay */}
        {countdownNum !== null && (
          <div className="countdown-overlay">
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#A29BFE', marginBottom: '1rem', letterSpacing: '2px' }}>
              ROUND {match?.current_round || 1} STARTING
            </span>
            <div className="countdown-number">
              {countdownNum === 0 ? 'GO!' : countdownNum}
            </div>
          </div>
        )}
      </div>
    </ArenaBackground>
  );
}

// Custom CSS Styles for Projector Match Console
const darkPageStyle = {
  minHeight: '100vh',
  backgroundColor: 'transparent',
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
