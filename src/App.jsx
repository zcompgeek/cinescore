import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, writeBatch, increment, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth, db, appId, firebaseConfig } from './firebase/config';
import { generateCode } from './utils/gameUtils';
import { Landing } from './components/Landing';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star, Clock, ArrowLeft, ArrowRight, Lightbulb, Bell } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); 
  const [gameId, setGameId] = useState(null);
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY" && window.location.hostname !== 'localhost') { setAuthError("Configuration Missing"); return; }
    let mounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } 
        else { await signInAnonymously(auth); }
      } catch (e) { if (mounted) setAuthError(e.message); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => { if (mounted) setUser(u); });
    return () => { mounted = false; unsub(); }
  }, []);

  const handleCreateGame = async () => {
    if (!user) return;
    setMode('creating_host');
    const newCode = generateCode();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', newCode), { hostId: user.uid, status: 'lobby', createdAt: new Date(), round: 0, buzzerWinner: null, scores: {} });
    setGameId(newCode);
    setMode('host');
  };

  const handleJoinGame = async (code, name, avatar) => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code);
    const snap = await getDoc(gameRef);
    if (snap.exists()) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', code, 'players', user.uid), { username: name, score: 0, joinedAt: new Date(), avatar: avatar || null });
      setGameId(code); setUsername(name); setMode('player');
    } else { alert("Game not found!"); }
  };

  if (authError) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center"><AlertCircle className="text-red-500 mb-4" size={48} /><h2 className="text-2xl font-bold mb-2">Connection Error</h2><p className="text-slate-400 mb-4">{authError}</p></div>;
  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500 animate-pulse">Connecting to CineScore...</div>;
  if (mode === 'host' && gameId) return <HostView gameId={gameId} user={user} />;
  if (mode === 'player' && gameId) return <PlayerView gameId={gameId} user={user} username={username} />;
  if (mode === 'creating_host') return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Creating Room...</div>;
  return <Landing setMode={setMode} joinGame={handleJoinGame} hostGame={handleCreateGame} />;
}
