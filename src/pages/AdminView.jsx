import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, ToggleLeft, ToggleRight, Trash2, Edit3, Settings } from 'lucide-react';

export default function AdminView() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [filterRound, setFilterRound] = useState('all');
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formRound, setFormRound] = useState(1);
  const [promptText, setPromptText] = useState('');
  const [realImageUrl, setRealImageUrl] = useState('');
  const [aiImageUrl, setAiImageUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState('');
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('round', { ascending: true })
      .order('created_at', { ascending: false });

    if (data) setQuestions(data);
    setLoading(false);
  };

  // Inline Active/Inactive Toggle
  const toggleQuestionActive = async (qId, currentStatus) => {
    const { error } = await supabase
      .from('questions')
      .update({ is_active: !currentStatus })
      .eq('id', qId);

    if (!error) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, is_active: !currentStatus } : q))
      );
    }
  };

  const handleOpenAddForm = () => {
    setEditingId(null);
    setFormRound(1);
    setPromptText('Which image is AI-generated?');
    setRealImageUrl('/images/round1/q21_real.jpg');
    setAiImageUrl('/images/round1/q21_ai.jpg');
    setLogoUrl('/images/round2/custom.svg');
    setOptions(['Option A', 'Option B', 'Option C', 'Option D']);
    setCorrectOption('Option A');
    setExplanation('Sample explanation text.');
    setShowForm(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();

    let questionType = 'image_comparison';
    if (formRound === 2) questionType = 'logo_mcq';
    if (formRound === 3) questionType = 'emoji_mcq';

    const payload = {
      round: Number(formRound),
      question_type: questionType,
      prompt_text: promptText,
      explanation: explanation,
      is_active: true
    };

    if (formRound === 1) {
      payload.real_image_url = realImageUrl;
      payload.ai_image_url = aiImageUrl;
      payload.correct_option = 'ai';
    } else if (formRound === 2) {
      payload.logo_url = logoUrl;
      payload.options = JSON.stringify(options);
      payload.correct_option = correctOption;
    } else if (formRound === 3) {
      payload.options = JSON.stringify(options);
      payload.correct_option = correctOption;
    }

    if (editingId) {
      await supabase.from('questions').update(payload).eq('id', editingId);
    } else {
      await supabase.from('questions').insert([payload]);
    }

    setShowForm(false);
    fetchQuestions();
  };

  const filteredQuestions = questions.filter((q) => {
    if (filterRound === 'all') return true;
    return q.round === Number(filterRound);
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F5F9',
      padding: '2rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        {/* Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate('/')} className="btn" style={{ background: '#FFFFFF', color: '#2D3436' }}>
            <ArrowLeft size={20} /> BACK TO HOME
          </button>

          <button onClick={handleOpenAddForm} className="btn btn-green">
            <Plus size={20} /> ADD NEW QUESTION
          </button>
        </div>

        <div className="card-light" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Settings color="#6C5CE7" size={32} />
            <div>
              <h1 style={{ fontSize: '1.8rem', color: '#2D3436' }}>GAME CONFIG & QUESTIONS</h1>
              <p style={{ color: '#636E72', fontSize: '0.9rem' }}>Manage arena questions & inline active toggles</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
            {['all', '1', '2', '3'].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRound(r)}
                className="btn"
                style={{
                  background: filterRound === r ? '#6C5CE7' : '#EDF2F7',
                  color: filterRound === r ? '#FFFFFF' : '#4A5568',
                  padding: '0.4rem 1rem',
                  fontSize: '0.9rem'
                }}
              >
                {r === 'all' ? 'All Rounds' : `Round ${r}`}
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        <div className="card-light">
          {loading ? (
            <p style={{ textAlign: 'center', color: '#636E72', padding: '2rem' }}>Loading questions...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '16px',
                    background: q.is_active ? '#FFFFFF' : '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    opacity: q.is_active ? 1 : 0.6
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>
                        Round {q.round}
                      </span>
                      <strong style={{ fontSize: '1.05rem', color: '#2D3436' }}>{q.prompt_text}</strong>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                      {q.explanation}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                      onClick={() => toggleQuestionActive(q.id, q.is_active)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: q.is_active ? '#38B2AC' : '#A0AEC0', fontWeight: 700 }}
                    >
                      {q.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      <span style={{ fontSize: '0.85rem' }}>{q.is_active ? 'Active' : 'Hidden'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Question Modal */}
      {showForm && (
        <div className="countdown-overlay">
          <div className="card-light" style={{ width: '90%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Question' : 'Add New Question'}</h2>

            <form onSubmit={handleSaveQuestion}>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Select Round</label>
              <select
                value={formRound}
                onChange={(e) => setFormRound(Number(e.target.value))}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
              >
                <option value={1}>Round 1 (Image Comparison)</option>
                <option value={2}>Round 2 (Logo MCQ)</option>
                <option value={3}>Round 3 (Emoji MCQ)</option>
              </select>

              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Prompt / Clue Text</label>
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                required
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
              />

              {formRound === 1 && (
                <>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Real Image URL Path</label>
                  <input
                    type="text"
                    value={realImageUrl}
                    onChange={(e) => setRealImageUrl(e.target.value)}
                    placeholder="/images/round1/q21_real.jpg"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
                  />

                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>AI Image URL Path</label>
                  <input
                    type="text"
                    value={aiImageUrl}
                    onChange={(e) => setAiImageUrl(e.target.value)}
                    placeholder="/images/round1/q21_ai.jpg"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
                  />
                </>
              )}

              {formRound === 2 && (
                <>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Logo SVG / PNG URL</label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="/images/round2/chatgpt.svg"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
                  />
                </>
              )}

              {(formRound === 2 || formRound === 3) && (
                <>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>4 MCQ Answer Options</label>
                  {options.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[i] = e.target.value;
                        setOptions(newOpts);
                      }}
                      placeholder={`Option ${i + 1}`}
                      required
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E0', marginBottom: '0.5rem' }}
                    />
                  ))}

                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Correct Answer Option</label>
                  <input
                    type="text"
                    value={correctOption}
                    onChange={(e) => setCorrectOption(e.target.value)}
                    placeholder="Must match one option exactly"
                    required
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1rem' }}
                  />
                </>
              )}

              <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Explanation Text</label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '2px solid #E2E8F0', marginBottom: '1.5rem' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn" style={{ flex: 1, background: '#DFE6E9', color: '#2D3436' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-green" style={{ flex: 1 }}>
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
