import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import './Dashboard.css';

const suggestions = {
  joy: "Embrace this positive energy! It's a great time to tackle creative tasks or share your happiness with loved ones.",
  sadness: "It's okay to feel down. Give yourself permission to rest, take deep breaths, and process your feelings gently.",
  anger: "Take a moment to pause. Try stepping away from the situation or engaging in physical activity to release tension safely.",
  fear: "Acknowledge your anxiety without judgment. Try a grounding exercise like the 5-4-3-2-1 method to center yourself.",
  love: "What a beautiful emotion! Cultivate this feeling by practicing gratitude or expressing your affection to people you care about.",
  surprise: "Unexpected moments keep life interesting! Take a moment to process this new information and adapt at your own pace."
};

const emotionEmojis = {
  joy: "✨",
  sadness: "🌧️",
  anger: "🔥",
  fear: "🌪️",
  love: "💗",
  surprise: "🤯",
  neutral: "😐"
};

const emotionColors = {
  joy: "#facc15", 
  sadness: "#3b82f6", 
  anger: "#ef4444", 
  fear: "#a855f7", 
  love: "#ec4899", 
  surprise: "#22c55e",
  neutral: "#94a3b8" 
};

const emotionsList = ['joy', 'sadness', 'anger', 'fear', 'love', 'surprise'];

const Dashboard = () => {
  const { user, token } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState('analyze'); // 'analyze' | 'analytics'
  
  // Predict State
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);

  // Analytics State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    // Only fetch history if switching to analytics tab and we haven't loaded it yet
    const fetchHistory = async () => {
      if (activeTab === 'analytics' && historyRecords.length === 0) {
        setLoadingAnalytics(true);
        try {
          const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/predict/history`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setHistoryRecords(res.data);
        } catch (err) {
          toast.error("Failed to fetch analytics history.");
        } finally {
          setLoadingAnalytics(false);
        }
      }
    };
    fetchHistory();
  }, [activeTab, token, historyRecords.length]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoadingAnalyze(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/predict/predict`,
        { text },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setResult(response.data);
      console.log("RESULT:", response.data);
      setText(''); // Clear input on success
      toast.success("Reflection successfully analyzed!");
      
      // Force refresh of analytics if we successfully added a new prediction
      if (historyRecords.length > 0) {
        setHistoryRecords([response.data, ...historyRecords]);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Failed to analyze text. Please try again.'
      );
    } finally {
      setLoadingAnalyze(false);
    }
  };

  // Compute Analytics Data
  const analyticsData = useMemo(() => {
    if (!historyRecords || historyRecords.length === 0) {
      return { pieData: [], lineData: [] };
    }

    // 1. Pie Chart Distribution
    const distribution = historyRecords.reduce((acc, r) => {
      const e = r.predicted_emotion;
      if (e && emotionsList.includes(e)) {
        acc[e] = (acc[e] || 0) + 1;
      }
      return acc;
    }, {});
    
    const pieData = Object.entries(distribution).map(([name, value]) => ({
      name,
      value
    }));

    // 2. Line Chart (Last 14 days)
    const datesMap = new Map();
    // Pre-fill the last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const template = { date: dateStr.substring(5) }; // visually show MM-DD
      emotionsList.forEach(emo => template[emo] = 0);
      datesMap.set(dateStr, template);
    }

    historyRecords.forEach(r => {
      if (!r.timestamp || !r.predicted_emotion) return;
      const rDate = new Date(r.timestamp).toISOString().split('T')[0];
      if (datesMap.has(rDate) && emotionsList.includes(r.predicted_emotion)) {
        datesMap.get(rDate)[r.predicted_emotion] += 1;
      }
    });

    const lineData = Array.from(datesMap.values());

    return { pieData, lineData };
  }, [historyRecords]);

  // Custom Pie Chart Label
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null; // Don't show tiny labels
    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px" fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header-block">
        <div className="dashboard-header-text">
          <h2>Welcome back, {user?.username || 'User'} 👋</h2>
          <p>Explore your mind and review your emotional history.</p>
        </div>
        
        <div className="dashboard-tab-control">
          <button 
            className={`tab-btn ${activeTab === 'analyze' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyze')}
          >
            Reflect & Analyze
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics Insights
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analyze' && (
          <motion.div 
            key="tab-analyze"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="dashboard-grid"
          >
            {/* Left Side: Input Area */}
            <div className="dashboard-left">
              <div className="chat-card global-card">
                <h3>New Reflection</h3>
                <form onSubmit={handleAnalyze} className="chat-form">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your thoughts, feelings, or a moment from your day here..."
                    rows={6}
                    className="chat-textarea"
                  />
                  <button 
                    type="submit" 
                    className="analyze-btn"
                    disabled={loadingAnalyze || !text.trim()}
                  >
                    {loadingAnalyze ? 'Analyzing Mindset...' : 'Analyze Now'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Side: Results Area */}
            <div className="dashboard-right">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="empty-results-card"
                  >
                    <div className="empty-icon">🧠</div>
                    <p>Submit a reflection to see your cognitive and emotional analysis appear here.</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="results"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="results-card global-card"
                  >
                    {/* Top Emotion Focus */}
                    <div className="top-emotion-section">
                      <div className="emotion-icon-large">
                        {emotionEmojis[result.predicted_emotion] || emotionEmojis.neutral}
                      </div>
                      <div className="emotion-title-wrapper">
                        <h3>{(result.predicted_emotion || 'neutral').toUpperCase()}</h3>
                        <div className="confidence-label">
                          {(result.confidence * 100).toFixed(1)}% Confidence
                        </div>
                      </div>
                    </div>

                    {/* Primary Confidence Bar */}
                    <div className="confidence-bar-bg main-bar">
                      <motion.div 
                        className="confidence-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ 
                          backgroundColor: emotionColors[result.predicted_emotion] || emotionColors.neutral 
                        }}
                      />
                    </div>

                    {/* Top 3 Emotons */}
                    <div className="sub-emotions-section">
                      <h4>Emotional Breakdown</h4>
                      <div className="sub-emotions-list">
                        {result.top_3?.map((emo, idx) => (
                          <div key={idx} className="sub-emotion-item">
                            <div className="sub-emotion-header">
                              <span>
                                {emotionEmojis[emo.label]} {emo.label}
                              </span>
                              <span>{(emo.score * 100).toFixed(1)}%</span>
                            </div>
                            <div className="confidence-bar-bg sub-bar">
                              <motion.div 
                                className="confidence-bar-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${emo.score * 100}%` }}
                                transition={{ duration: 0.8, delay: 0.2 + (idx * 0.1) }}
                                style={{ 
                                  backgroundColor: emotionColors[emo.label] || emotionColors.neutral 
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explainability Highlight Chips */}
                    {result.highlight_words && result.highlight_words.length > 0 && (
                      <div className="explainability-section">
                        <h4>Key words that influenced this prediction</h4>
                        <div className="chips-container">
                          {result.highlight_words.map((item, idx) => (
                            <span 
                              key={idx} 
                              className="highlight-chip" 
                              title={`Importance score: ${item.score}`}
                              style={{ 
                                color: emotionColors[result.predicted_emotion] || '#fff',
                                borderColor: `${emotionColors[result.predicted_emotion]}40`,
                                cursor: 'help'
                              }}
                            >
                              {item.word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Smart Suggestion */}
                    <div className="suggestion-section" style={{ borderLeftColor: emotionColors[result.predicted_emotion] }}>
                      <h4>Actionable Insight ✨</h4>
                      <p>{suggestions[result.predicted_emotion] || "Keep observing your thoughts without judgment."}</p>
                    </div>

                    {/* Cognitive Distortions Section */}
                    {result?.cognitive_distortions?.length > 0 && (
                      <div className="cognitive-section" style={{ 
                        marginTop: '1.5rem', 
                        padding: '1.25rem', 
                        backgroundColor: 'rgba(217, 119, 6, 0.1)', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(217, 119, 6, 0.2)' 
                      }}>
                        <h4 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>
                          Cognitive Patterns Detected 🧠
                        </h4>
                        <div className="distortions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {result.cognitive_distortions.map((distortion, idx) => (
                            <div key={idx} className="distortion-item" style={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.25)', 
                              padding: '1rem', 
                              borderRadius: '8px',
                              border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={{ 
                                  backgroundColor: '#d97706', 
                                  color: '#fff', 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: '4px', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>
                                  {distortion.name}
                                </span>
                              </div>
                              <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: '#e2e8f0', margin: '0 0 0.5rem 0' }}>
                                "{distortion.matched_phrase}"
                              </p>
                              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                                {distortion.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div 
            key="tab-analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="analytics-grid"
          >
            {loadingAnalytics ? (
              <div className="loading-spinner">Processing Analytics Insights...</div>
            ) : historyRecords.length === 0 ? (
              <div className="empty-results-card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-icon">📊</div>
                <p>No data available yet. Start tracking your emotions to see your charts.</p>
              </div>
            ) : (
              <>
                <div className="chart-card line-chart-card global-card">
                  <h3>14-Day Emotional Variance</h3>
                  <div className="chart-wrapper line-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.lineData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(20,20,30,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {emotionsList.map(emotion => (
                          <Line 
                            key={emotion}
                            type="monotone" 
                            dataKey={emotion} 
                            stroke={emotionColors[emotion]} 
                            strokeWidth={3}
                            activeDot={{ r: 8 }}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card pie-chart-card global-card">
                  <h3>Overall Distribution</h3>
                  <div className="chart-wrapper pie-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.pieData}
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomizedLabel}
                        >
                          {analyticsData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={emotionColors[entry.name] || emotionColors.neutral} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(20,20,30,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', textTransform: 'capitalize' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
