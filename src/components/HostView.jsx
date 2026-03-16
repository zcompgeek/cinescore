import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, collection, writeBatch, increment, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { CATEGORIES } from '../data';
import { verifyBatchAnswers } from '../utils/gameUtils';
import { searchItunes, searchMoviePoster } from '../services/api';
import { Volume2, Trophy, Users, SkipForward, AlertCircle, Check, X, RefreshCw, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const HostView = ({ gameId, user }) => {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [category, setCategory] = useState("all_time_scores");
  const [totalRounds, setTotalRounds] = useState(10);
  const [gameMode, setGameMode] = useState("competitive");
  const [showSettings, setShowSettings] = useState(true);
  const [roundTimeLeft, setRoundTimeLeft] = useState(30);
  const audioRef = useRef(null);
  const processingRef = useRef(new Set()); 
  const initRef = useRef(false);

  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGame(data);
        if (!initRef.current && data.status !== 'lobby') {
          initRef.current = true;
          setShowSettings(false);
        }
      }
    });
    const unsubPlayers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players'), (snap) => {
      const pList = [];
      snap.forEach(d => pList.push({id: d.id, ...d.data()}));
      setPlayers(pList.sort((a,b) => b.score - a.score));
    });
    return () => { unsubGame(); unsubPlayers(); };
  }, [gameId]);

  useEffect(() => {
      if (game?.status === 'playing') {
          if (roundTimeLeft > 0) {
              const timer = setTimeout(() => setRoundTimeLeft(t => t - 1), 1000);
              return () => clearTimeout(timer);
          }
      } else {
          setRoundTimeLeft(30);
      }
  }, [roundTimeLeft, game?.status]);
  
  useEffect(() => {
    if (audioRef.current) {
      if (game?.status === 'playing' && game?.currentSong?.previewUrl) {
        if (audioRef.current.src !== game.currentSong.previewUrl) {
            audioRef.current.src = game.currentSong.previewUrl;
            audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        } else if (audioRef.current.paused) {
            audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        }
      } else if (game?.status === 'revealed' || game?.status === 'game_over') {
        audioRef.current.pause();
      }
    }
  }, [game?.currentSong?.previewUrl, game?.status]);

  // --- UPDATED SCORE PROCESSING ---
  useEffect(() => {
    if (!game || game.status !== 'playing') {
        processingRef.current.clear();
        return;
    }

    const submissions = game.submissions || {};
    const pendingSubmissions = Object.values(submissions).filter(s => s.status === 'pending');
    const toProcess = pendingSubmissions.filter(s => !processingRef.current.has(s.uid));
    
    if (toProcess.length > 0) {
        toProcess.forEach(s => processingRef.current.add(s.uid));
        
        const verify = async () => {
             const results = await verifyBatchAnswers(toProcess, game.currentSong);
             
             const batch = writeBatch(db);
             const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
             
             // Sort buzzes to determine rank. Timestamp is client-side but generally acceptable for casual play order.
             const sortedBuzzes = (game.buzzes || []).sort((a,b) => a.timestamp - b.timestamp);

             results.forEach(res => {
                  const uid = res.uid;
                  
                  // 1. Calculate Base Potential (Buzz Rank)
                  let basePoints = 0;
                  if (game.gameMode === 'chill' || game.gameMode === 'coop') {
                      basePoints = 100;
                  } else {
                      const buzzIndex = sortedBuzzes.findIndex(b => b.uid === uid);
                      if (buzzIndex !== -1) {
                          // Start at 100, -10 per rank, min 50.
                          basePoints = Math.max(50, 100 - (buzzIndex * 10));
                      } else {
                          // Fallback if not in buzz list (shouldn't happen with correct flow)
                          basePoints = 50;
                      }
                  }

                  let finalScore = 0;
                  let outcome = 'wrong';

                  // 2. Apply Verification Result
                  if (res.score === 100) {
                      finalScore = basePoints;
                      outcome = 'correct';
                  } else if (res.score === 50) {
                      // Close Answer: Half credit
                      finalScore = Math.floor(basePoints / 2);
                      outcome = 'close';
                  } else {
                      // Wrong Answer: Penalty
                      finalScore = (game.gameMode === 'chill' || game.gameMode === 'coop') ? 0 : -25;
                      outcome = 'wrong';
                  }

                  // 3. Apply Hint Penalty (25% off earned points)
                  const hasHint = game.hints?.[uid];
                  if (hasHint && finalScore > 0 && game.gameMode !== 'chill') {
                      finalScore = Math.floor(finalScore * 0.75);
                  }

                  const submissionUpdate = {
                      [`submissions.${uid}.status`]: 'verified',
                      [`submissions.${uid}.score`]: finalScore,
                      [`submissions.${uid}.outcome`]: outcome
                  };
                  batch.update(gameRef, submissionUpdate);
                  
                  const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', uid);
                  batch.update(playerRef, { score: increment(finalScore) });
             });
             
             await batch.commit();
             toProcess.forEach(s => processingRef.current.delete(s.uid));
        };
        verify();
    }

    const allSubs = Object.values(submissions);
    const verifiedSubs = allSubs.filter(s => s.status === 'verified');
    const correctCount = verifiedSubs.filter(s => s.outcome === 'correct').length;
    const timeUp = roundTimeLeft === 0;
    
    // Check if ALL players have submitted/skipped
    const submittedUids = Object.keys(submissions);
    const skippedUids = game.skips || [];
    const allParticipated = players.length > 0 && new Set([...submittedUids, ...skippedUids]).size >= players.length;
    const allProcessed = allParticipated && allSubs.every(s => s.status === 'verified');
    
    // Round ends if 3 correct, time up, or everyone done
    const isCoopSuccess = game?.gameMode === 'coop' && correctCount >= 1;
    if (correctCount >= 3 || timeUp || allProcessed || isCoopSuccess) {
        const endRound = async () => {
             const finalResults = verifiedSubs.map(s => ({
                 uid: s.uid,
                 actualScore: s.score || 0,
                 outcome: s.outcome
             }));

             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
                status: 'revealed',
                lastRoundScore: 0, 
                roundWinnerCount: correctCount,
                roundResults: finalResults,
                ...(game.gameMode === 'coop' && correctCount > 0 ? { groupScore: increment(1) } : {})
            });
        };
        endRound();
    }

  }, [game?.submissions, game?.skips, roundTimeLeft, game?.status, players.length, game?.buzzes]);

  const nextRound = async () => {
    if (game?.round >= game?.totalRounds) {
        const sortedPlayers = [...players].sort((a,b) => b.score - a.score);
        const winner = sortedPlayers.length > 0 ? sortedPlayers[0] : null; 
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
            status: 'game_over',
            winner: winner ? { uid: winner.id, username: winner.username, score: winner.score, avatar: winner.avatar } : null
        });
        return;
    }

    const activeCategory = game?.category || category;
    const allSongs = CATEGORIES[activeCategory];
    const playedSongs = game?.playedSongs || [];
    const usedTitles = playedSongs.map(s => (typeof s === 'string' ? s : s.title));
    const availableSongs = allSongs.filter(s => !usedTitles.includes(s.title));
    const mediaType = (activeCategory === 'modern_tv' || activeCategory === 'classic_tv') ? 'tv' : 'movie';
    let selectedSong = null;
    let attempts = 0;
    while (!selectedSong && availableSongs.length > 0 && attempts < 5) {
        attempts++;
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const candidate = availableSongs[randomIndex];
        const [musicData, posterUrl] = await Promise.all([
            searchItunes(`${candidate.title} ${candidate.artist} soundtrack`),
            searchMoviePoster(candidate.movie, mediaType, candidate.year)
        ]);
        if (musicData?.previewUrl && (posterUrl || musicData?.artworkUrl100)) {
            selectedSong = {
                ...candidate,
                previewUrl: musicData.previewUrl,
                coverArt: posterUrl || musicData.artworkUrl100?.replace('100x100', '600x600'),
                hint: candidate.hint
            };
        } else {
            availableSongs.splice(randomIndex, 1);
        }
    }

    if (!selectedSong) { alert("Error: No valid song found."); return; }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentSong: selectedSong,
      status: 'playing',
      round: increment(1),
      playedSongs: arrayUnion({ title: selectedSong.title, artist: selectedSong.artist, movie: selectedSong.movie, coverArt: selectedSong.coverArt }),
      skips: [],
      buzzes: [],
      submissions: {},
      hints: {},
      roundResults: [],
      roundStart: Date.now()
    });
  };

  useEffect(() => {
      let timer;
      if (game?.status === 'revealed') {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          timer = setTimeout(() => { nextRound(); }, 6000);
      }
      return () => clearTimeout(timer);
  }, [game?.status]);


  const startGame = async () => {
    setShowSettings(false);
    const mediaType = (category === 'modern_tv' || category === 'classic_tv') ? 'tv' : 'movie';
    const allSongs = CATEGORIES[category]; 
    const trackData = allSongs[Math.floor(Math.random() * allSongs.length)];
    const [musicData, posterUrl] = await Promise.all([
        searchItunes(`${trackData.title} ${trackData.artist} soundtrack`),
        searchMoviePoster(trackData.movie, mediaType, trackData.year)
    ]);
    const previewUrl = musicData?.previewUrl || null;
    const coverArt = posterUrl || musicData?.artworkUrl100?.replace('100x100', '600x600') || null;

    const batch = writeBatch(db);
    players.forEach(p => {
        const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', p.id);
        batch.update(pRef, { score: 0 });
    });
    
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    batch.update(gameRef, {
      status: 'playing',
      gameMode: gameMode,
      round: 1, 
      category: category,
      totalRounds: totalRounds,
      playedSongs: [ { title: trackData.title, artist: trackData.artist, movie: trackData.movie, coverArt } ], 
      skips: [],
      buzzes: [],      
      submissions: {}, 
      hints: {},
      groupScore: 0,
      currentSong: { ...trackData, previewUrl, coverArt },
      feedbackMessage: null,
      roundResults: [],
      roundStart: Date.now(),
      hintRevealed: false
    });
    
    await batch.commit();
  };


  const giveUp = async () => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { status: 'revealed' });
  };
  const handleNewGame = async () => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { status: 'lobby', winner: null, currentSong: null, buzzes: [], submissions: {} });
      setShowSettings(true);
  };
  const getPlayer = (uid) => players.find(p => p.id === uid);
  
  if (!game) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 animate-pulse">Loading Game...</div>;
  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6">Game Setup</h2>
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl w-full max-w-6xl border border-slate-700">
          <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-900/50 p-6 rounded-xl border border-slate-700">
            <div className="flex-1 text-center">
              <label className="block text-sm font-bold mb-2 text-slate-400">GAME CODE</label>
              <div className="text-6xl font-mono font-black tracking-widest text-blue-400">{gameId}</div>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className="bg-white p-2 rounded-lg shadow-lg">
                <QRCodeSVG value={`${window.location.origin}?code=${gameId}`} size={140} />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">Scan to Join</p>
            </div>
          </div>
          <div className="mt-6">
             <label className="block text-sm font-bold mb-2 text-slate-400">CATEGORY</label>
             <div className="grid grid-cols-2 gap-2 mb-4">{Object.keys(CATEGORIES).map(c => (<button key={c} onClick={() => setCategory(c)} className={`p-2 rounded capitalize font-bold text-xs md:text-sm ${category === c ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}>{c.replace(/_/g, ' ')}</button>))}</div>
             <label className="block text-sm font-bold mb-2 text-slate-400">GAME MODE</label>
             <div className="flex gap-2 mb-4">
                 {[
                     { id: 'competitive', label: 'Competitive' },
                     { id: 'coop', label: 'Cooperative' },
                     { id: 'chill', label: 'Chill' }
                 ].map(m => (
                     <button key={m.id} onClick={() => setGameMode(m.id)} className={`flex-1 p-2 rounded font-bold transition-all ${gameMode === m.id ? 'bg-purple-600 ring-2 ring-purple-400' : 'bg-slate-700 hover:bg-slate-600'}`}>{m.label}</button>
                 ))}
             </div>
             <label className="block text-sm font-bold mb-2 text-slate-400">NUMBER OF SONGS</label>
             <div className="flex gap-2">{[10, 25, 50].map(num => (<button key={num} onClick={() => setTotalRounds(num)} className={`flex-1 p-2 rounded font-bold ${totalRounds === num ? 'bg-green-600 ring-2 ring-green-400' : 'bg-slate-700'}`}>{num}</button>))}</div>
          </div>
          <div className="pt-4 border-t border-slate-700 mt-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18}/> Players Joined ({players.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
              {players.map(p => (
                <div key={p.id} className="bg-slate-700/50 p-4 rounded-xl flex flex-col items-center gap-3 border border-slate-600 text-center">
                  <div className="relative">{p.avatar ? (<img src={p.avatar} alt={p.username} className="w-24 h-24 rounded-full bg-slate-800 border-4 border-blue-400 object-cover" />) : (<div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-500 flex items-center justify-center"><span className="text-4xl font-bold">{p.username.charAt(0)}</span></div>)}</div>
                  <div className="overflow-hidden w-full"><div className="font-bold truncate text-lg">{p.username}</div><div className="text-sm text-blue-300 font-mono">{p.score} pts</div></div>
                </div>
              ))}
              {players.length === 0 && <div className="col-span-full text-slate-500 italic text-center py-4">Waiting for players to join...</div>}
            </div>
          </div>
          <button onClick={startGame} disabled={players.length === 0 || !category} className="w-full py-4 mt-6 bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-xl hover:scale-105 transition-transform">Start Game</button>
        </div>
      </div>
    );
  }

  const buzzes = game?.buzzes || [];
  const submissions = game?.submissions || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col h-screen overflow-hidden">
       <audio ref={audioRef} loop />
       <div className="bg-slate-900 p-4 shadow-lg flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 md:gap-4"><div className="bg-blue-600 px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm whitespace-nowrap">R {game?.round} / {game?.totalRounds}</div><div className="text-slate-400 font-mono text-lg md:text-xl">{gameId}</div></div>
          {game?.status === 'playing' && (<div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded text-yellow-400 font-mono font-bold"><Clock size={16} /> {roundTimeLeft}s</div>)}
          <div className="flex gap-2"><button onClick={giveUp} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700">Skip Song</button><button onClick={() => setShowSettings(true)} className="text-xs text-slate-500 hover:text-white">Settings</button></div>
       </div>
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full mx-auto">
          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto w-full">
             {(game?.status === 'revealed' || game?.status === 'game_over') && game?.currentSong?.coverArt ? (
                <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl transition-all duration-1000" style={{ backgroundImage: `url(${game.currentSong.coverArt})`}} />
             ) : (
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden"><div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600 rounded-full blur-[100px] animate-pulse"></div><div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600 rounded-full blur-[100px] animate-pulse"></div></div>
             )}
             <div className="z-10 w-full max-w-4xl text-center">
                <div className="mb-4 md:mb-8">
                   {game?.status === 'playing' && buzzes.length > 0 && (
                       <div className="flex flex-col items-center gap-4 mb-8">
                           <h3 className="text-2xl font-bold animate-pulse text-yellow-400">Guessing...</h3>
                           <div className="flex flex-wrap justify-center gap-3">
                               {buzzes.map((b) => {
                                   const player = getPlayer(b.uid);
                                   const sub = submissions[b.uid];
                                   const hasSubmitted = sub?.status === 'pending' || sub?.status === 'verified';
                                   let bgClass = 'bg-slate-800/80';
                                   let borderClass = 'border-yellow-500';
                                   let Icon = null;
                                   if (sub?.status === 'verified') {
                                       if (sub.outcome === 'correct') {
                                           bgClass = 'bg-green-600/50';
                                           borderClass = 'border-green-400';
                                           Icon = <Check size={16} className="text-green-400"/>;
                                       } else if (sub.outcome === 'close') {
                                           bgClass = 'bg-yellow-600/50';
                                           borderClass = 'border-yellow-400';
                                           Icon = <AlertCircle size={16} className="text-yellow-400"/>;
                                       } else if (sub.outcome === 'wrong') {
                                           bgClass = 'bg-red-900/50';
                                           borderClass = 'border-red-500';
                                           Icon = <X size={16} className="text-red-400"/>;
                                       }
                                   } else if (hasSubmitted) {
                                       bgClass = 'bg-blue-600/50';
                                       borderClass = 'border-blue-400';
                                       Icon = <RefreshCw size={16} className="text-blue-400 animate-spin"/>;
                                   }
                                   return (
                                       <div key={b.uid} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${bgClass} ${borderClass}`}>
                                           {player?.avatar ? <img src={player.avatar} className="w-8 h-8 rounded-full border border-white" /> : <div className="w-8 h-8 bg-white/20 rounded-full"/>}
                                           <span className="font-bold">{b.username}</span>
                                           {Icon}
                                       </div>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {game?.status === 'game_over' && (
                       <div className="bg-slate-900/90 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm animate-bounce-short">
                           {game.gameMode === 'coop' ? (
                               <>
                                   <Users size={60} className="text-blue-400 mx-auto mb-4 md:w-20 md:h-20" />
                                   <h1 className="text-3xl md:text-4xl font-black mb-2">GAME OVER</h1>
                                   <div className="text-xl md:text-2xl mb-6 md:mb-8">
                                       Group Success: <span className="text-blue-400 font-bold">{Math.round((game.groupScore / game.totalRounds) * 100) || 0}%</span>
                                       <div className="text-slate-400 text-lg">{game.groupScore || 0} out of {game.totalRounds} correct</div>
                                   </div>
                               </>
                           ) : (
                               <>
                                   {game.winner?.avatar && <img src={game.winner.avatar} className="w-24 h-24 rounded-full border-4 border-yellow-500 mx-auto mb-4 object-cover bg-slate-800" />}
                                   <Trophy size={60} className="text-yellow-400 mx-auto mb-4 md:w-20 md:h-20" />
                                   <h1 className="text-3xl md:text-4xl font-black mb-2">GAME OVER</h1>
                                   <div className="text-xl md:text-2xl mb-6 md:mb-8">Winner: <span className="text-yellow-400 font-bold">{game.winner?.username || "Unknown"}</span><div className="text-slate-400 text-lg">Score: {game.winner?.score}</div></div>
                               </>
                           )}
                           <button onClick={handleNewGame} className="px-6 py-3 md:px-8 md:py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 mx-auto"><RefreshCw size={20}/> Setup New Game</button>
                       </div>
                   )}

                   {game?.status === 'playing' && buzzes.length === 0 && (
                     <div className="animate-pulse flex flex-col items-center text-blue-400">
                        <Volume2 size={48} className="mb-4 md:w-16 md:h-16" />
                        <h2 className="text-2xl md:text-3xl font-bold">Listen Closely...</h2>
                        <div className="mt-4 flex gap-2">{game.skips?.length > 0 && (<span className="text-slate-400 text-sm">{game.skips.length} vote(s) to skip</span>)}</div>
                        <div className="mt-4 text-xs text-slate-500">
                             {game.gameMode === 'coop' ? "First correct answer ends the round!" : "First 3 correct answers end the round!"}
                        </div>
                     </div>
                   )}

                   {game?.status === 'revealed' && (
                     <div className="bg-slate-900/90 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm w-full max-w-5xl">
                        <div className="mb-6 flex flex-col items-center">
                           <img src={game.currentSong?.coverArt} className="max-h-[40vh] w-auto max-w-full object-contain rounded-lg shadow-2xl mb-6" alt="Movie Poster"/>
                           <h2 className="text-3xl md:text-5xl font-black text-white text-center leading-tight mb-2">{game.currentSong?.movie}</h2>
                           <p className="text-blue-400 text-xl md:text-2xl font-bold">{game.currentSong?.title}</p>
                           <p className="text-slate-500 text-lg">{game.currentSong?.artist}</p>
                        </div>
                        <div className="text-center mb-6">
                           {game.gameMode === 'coop' ? (
                               <p className={`font-bold text-xl ${game.roundWinnerCount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                   {game.roundWinnerCount > 0 ? "Team Guessed Correctly!" : "Team Missed!"}
                               </p>
                           ) : (
                               <p className="text-green-400 font-bold text-xl">{game.roundWinnerCount || 0} Correct Guesses!</p>
                           )}
                        </div>
                        <button onClick={nextRound} className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-110 transition-transform flex items-center gap-2 mx-auto text-xl shadow-lg">Next Round <SkipForward size={24}/></button>
                     </div>
                   )}
                </div>
             </div>
          </div>
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 md:p-6 flex flex-col h-48 md:h-auto shrink-0">
             <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-6 flex items-center gap-2 sticky top-0 bg-slate-900 z-10"><Trophy className="text-yellow-500" size={20} /> Leaderboard</h3>
             <div className="space-y-2 md:space-y-3 overflow-y-auto flex-1 pb-2 pr-1">
               {players.map((p, idx) => (
                 <div key={p.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-all ${idx === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-transparent border border-yellow-600/30' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                       <span className={`font-mono font-bold w-6 text-center shrink-0 ${idx===0 ? 'text-yellow-500' : 'text-slate-500'}`}>#{idx+1}</span>
                       <div className="flex items-center gap-2 overflow-hidden min-w-0">
                           {p.avatar ? (<img src={p.avatar} className="w-8 h-8 rounded-full border border-slate-500 shrink-0 bg-slate-700 object-cover" />) : (<div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{p.username.charAt(0)}</div>)}
                           <span className="font-semibold text-sm md:text-base truncate">{p.username}</span>
                       </div>
                    </div>
                    <span className="font-bold text-blue-400 text-sm md:text-base shrink-0">{p.score}</span>
                 </div>
               ))}
             </div>
          </div>
       </div>
    </div>
  );
};


