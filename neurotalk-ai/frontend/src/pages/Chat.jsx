import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './Chat.css';

const emotionColors = {
  joy: "#facc15", 
  sadness: "#3b82f6", 
  anger: "#ef4444", 
  fear: "#a855f7", 
  love: "#ec4899", 
  surprise: "#22c55e",
  neutral: "#94a3b8" 
};

const Chat = () => {
  const { token } = useAuth();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Compute dominant emotion based on frequencies
  const dominantEmotion = React.useMemo(() => {
    const userMessages = history.filter(m => m.role === 'user' && m.detected_emotion);
    if (userMessages.length === 0) return null;
    
    const counts = {};
    userMessages.forEach(m => {
      counts[m.detected_emotion] = (counts[m.detected_emotion] || 0) + 1;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }, [history]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input.trim();
    setInput('');
    
    // Add temporary user message to UI immediately without emotion data yet
    const tempUserMsg = { role: 'user', content: userMessageText, id: Date.now() };
    setHistory(prev => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        message: userMessageText,
        conversation_history: history.map(h => ({ role: h.role, content: h.content }))
      };

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat`, payload, config);
      const data = res.data;

      // Update the temporary user message with the newly detected emotion data
      setHistory(prev => {
        const updated = [...prev];
        const lastUserIdx = updated.findLastIndex(m => m.id === tempUserMsg.id);
        if (lastUserIdx !== -1) {
          updated[lastUserIdx] = {
            ...updated[lastUserIdx],
            detected_emotion: data.detected_emotion,
            confidence: data.confidence,
            cognitive_distortions: data.cognitive_distortions
          };
        }
        
        // Add AI response
        updated.push({
          role: 'ai',
          content: data.ai_reply,
          id: Date.now() + 1
        });
        
        return updated;
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to get AI response.");
      // Rollback last message on failure
      setHistory(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    if (window.confirm("Start a new reflection session? This will clear the current chat.")) {
      setHistory([]);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h2>Emotional Reflection Chat</h2>
        <div className="chat-header-actions" style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
          {dominantEmotion && (
            <div className="dominant-emotion">
              <span>Dominant Emotion:</span>
              <span 
                className="emotion-badge" 
                style={{ backgroundColor: emotionColors[dominantEmotion] || '#94a3b8' }}
              >
                {dominantEmotion}
              </span>
            </div>
          )}
          <button onClick={handleNewSession} className="btn-new-session">New Session</button>
        </div>
      </header>

      <div className="chat-messages">
        {history.length === 0 && !isLoading && (
          <div style={{textAlign: 'center', color: '#94a3b8', marginTop: '2rem'}}>
            <p>Start reflecting on your thoughts and feelings. The AI is here to listen and support you.</p>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {history.map((msg) => (
            <motion.div 
              key={msg.id}
              className={`message-wrapper ${msg.role}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-bubble">
                {msg.content}
              </div>
              
              {/* Display badges for user messages if data exists */}
              {msg.role === 'user' && msg.detected_emotion && (
                <div className="message-tags">
                  <span 
                    className="emotion-badge"
                    style={{ backgroundColor: emotionColors[msg.detected_emotion] || '#94a3b8' }}
                  >
                    {msg.detected_emotion} {(msg.confidence * 100).toFixed(0)}%
                  </span>
                  
                  {msg.cognitive_distortions && msg.cognitive_distortions.map((dist, idx) => (
                    <span key={idx} className="distortion-tag" title={dist.explanation}>
                      {dist.name}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <div className="message-wrapper ai">
            <div className="message-bubble" style={{padding: '12px 18px'}}>
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form onSubmit={handleSend} className="chat-form">
          <input 
            type="text" 
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your thoughts here..."
            disabled={isLoading}
          />
          <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
