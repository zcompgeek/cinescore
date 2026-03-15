import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, arrayUnion, updateDoc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { Volume2, Trophy, Users, AlertCircle, Check, X, FastForward, Clock, ArrowLeft, Lightbulb, Bell } from 'lucide-react';

export const PlayerView = ({ gameId, user, username }) => {
  const [game, setGame] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [myAvatar, setMyAvatar] = useState(null);
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showHistory, setShowHistory] = useState(false); 
  const [buzzedIn, setBuzzedIn] = useState(false);
  const [typingTime, setTypingTime] = useState(30);

  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        if (data.status === 'playing') {
             const mySub = data.submissions?.[user.uid];
             // Reset for new round if no submission and no buzz record on server
             const hasServerBuzz = data.buzzes?.some(b => b.uid === user.uid);
             if (!mySub && !hasServerBuzz) {
                 setHasAnswered(false);
                 setBuzzedIn(false);
                 setTypingTime(30);
                 setAnswer("");
             }
        }
        if (data.status === 'lobby') {
             setShowHistory(false);
             setHasAnswered(false);
             setBuzzedIn(false);
        }
      }
    });

    const unsubPlayer = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', user.uid), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setMyScore(data.score);
            setMyAvatar(data.avatar);
        }
    });

    return () => { unsubGame(); unsubPlayer(); };
  }, [gameId, user.uid]);

  const submitAnswer = async (forceContent = null) => {
    const content = forceContent !== null ? forceContent : answer;
    // Even empty string allowed if timeout
    setHasAnswered(true);
    const updates = {
        [`submissions.${user.uid}`]: {
            answer: content,
            status: 'pending',
            uid: user.uid,
            timestamp: Date.now()
        }
    };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), updates);
  };

  // Typing timer effect
  useEffect(() => {
      if (buzzedIn && !hasAnswered && typingTime > 0) {
          const timer = setTimeout(() => setTypingTime(t => t - 1), 1000);
          return () => clearTimeout(timer);
      }
      if (buzzedIn && !hasAnswered && typingTime === 0) {
          submitAnswer();
      }
  }, [buzzedIn, hasAnswered, typingTime, gameId, user.uid, answer]);

  const dbSubmission = game?.submissions?.[user.uid];
  const isWaiting = hasAnswered || !!dbSubmission;
  const hintTaken = game?.hints?.[user.uid];
  const votedSkip = game?.skips?.includes(user.uid);

  const buzzIn = async () => {
    if (!game || buzzedIn || game.status !== 'playing') return;
    setBuzzedIn(true);
    setTypingTime(30);
    // Add to buzzes list to secure rank
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
        buzzes: arrayUnion({ uid: user.uid, username: username, timestamp: Date.now() })
    });
  };

  const takeHint = async () => {
    if (!game || hintTaken || game.status !== 'playing') return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
        [`hints.${user.uid}`]: true
    });
  };


  const voteSkip = async () => {
      if (game.skips?.includes(user.uid)) return; 
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { skips: arrayUnion(user.uid) });
  };

  if (!game) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  if (game.status === 'lobby') {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="animate-bounce mb-6">{myAvatar ? (<img src={myAvatar} className="w-32 h-32 rounded-full border-4 border-blue-500 bg-slate-800 object-cover" />) : (<Users size={64} className="text-blue-500" />)}</div>
            <h1 className="text-3xl font-bold mb-2">Welcome, {username}!</h1>
            <p className="text-slate-400 text-lg">Waiting for host to start...</p>
            <div className="mt-8 p-4 bg-slate-800 rounded-xl border border-slate-700"><p className="text-xs uppercase font-bold text-slate-500 mb-1">Room Code</p><p className="text-4xl font-mono font-black tracking-widest text-blue-400">{gameId}</p></div>
        </div>
      );
  }

  if (game.status === 'game_over') {
       if (showHistory) {
           return (
               <div className="min-h-screen bg-slate-900 flex flex-col p-6 text-white">
                   <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><Clock /> Song History</h2>
                   <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                        {game.playedSongs && game.playedSongs.length > 0 ? (
                           game.playedSongs.map((song, i) => (
                               <div key={i} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                                   {typeof song === 'object' ? (<><img src={song.coverArt || "https://placehold.co/100"} className="w-12 h-12 rounded object-cover bg-slate-700" /><div className="text-left overflow-hidden"><div className="font-bold truncate text-sm text-white">{song.movie}</div><div className="text-xs text-slate-400 truncate">{song.title}</div></div></>) : (<span className="text-slate-400">{song}</span>)}
                               </div>
                           ))
                        ) : (<div className="text-center text-slate-500 italic">No songs recorded.</div>)}
                   </div>
                   <button onClick={() => setShowHistory(false)} className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-white"><ArrowLeft size={20} /> Back</button>
               </div>
           );
       }
       
       if (game.gameMode === 'coop') {
           return (
               <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <Users size={80} className="text-blue-200 mb-6 animate-bounce md:w-32 md:h-32" />
                   <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-xl">GAME OVER</h1>
                   <div className="text-xl md:text-2xl font-bold bg-black/30 px-8 py-4 rounded-xl text-white mb-6">Group Score: {Math.round((game.groupScore / game.totalRounds) * 100) || 0}%</div>
                   <div className="text-lg text-blue-200">You got {game.groupScore || 0} out of {game.totalRounds} correct.</div>
                   <button onClick={() => setShowHistory(true)} className="mt-8 px-6 py-3 bg-black/20 hover:bg-black/40 rounded-full font-bold text-sm flex items-center gap-2 backdrop-blur-sm text-white"><Clock size={16}/> View Songs</button>
               </div>
           );
       }

       const isWinner = game.winner?.uid === user.uid;
       if (isWinner) {
           return (
               <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-yellow-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <Trophy size={80} className="text-yellow-200 mb-6 animate-bounce md:w-32 md:h-32" />
                   <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-xl">VICTORY!</h1>
                   <div className="text-xl md:text-2xl font-bold bg-black/30 px-8 py-4 rounded-xl text-white">Final Score: {myScore}</div>
                   <button onClick={() => setShowHistory(true)} className="mt-8 px-6 py-3 bg-black/20 hover:bg-black/40 rounded-full font-bold text-sm flex items-center gap-2 backdrop-blur-sm text-white"><Clock size={16}/> View Songs</button>
               </div>
           );
       } else {
           return (
               <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <h1 className="text-3xl md:text-4xl font-black mb-4 text-slate-500">GAME OVER</h1>
                   <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm border border-slate-700">
                       <div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Winner</div>
                       <div className="flex flex-col items-center mb-6">{game.winner?.avatar && <img src={game.winner.avatar} className="w-16 h-16 rounded-full border-2 border-yellow-500 mb-2 object-cover bg-slate-800" />}<div className="text-2xl md:text-3xl font-bold text-yellow-500">{game.winner?.username}</div></div>
                       <div className="border-t border-slate-700 pt-6 mb-6"><div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Your Score</div><div className="text-2xl font-bold text-white">{myScore}</div></div>
                       <button onClick={() => setShowHistory(true)} className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-white"><Clock size={18}/> View Song History</button>
                   </div>
                   <p className="mt-8 text-slate-500 animate-pulse">Waiting for host...</p>
               </div>
           );
       }
  }

  if (game.status === 'playing') {
    if (votedSkip) {
         return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="animate-pulse flex flex-col items-center"><FastForward size={48} className="mb-4 text-yellow-500" /><h2 className="text-2xl font-bold">Voted to Skip</h2><p className="text-slate-400">Waiting for round to end...</p></div>
            </div>
        );
    }
    if (isWaiting) {
        if (dbSubmission?.status === 'verified') {
            const outcome = dbSubmission.outcome;
            const score = dbSubmission.score || 0;
            let msg = "Processing...";
            let color = "text-slate-400";
            if (outcome === 'correct') { msg = `CORRECT! (+${score})`; color = "text-green-400"; }
            else if (outcome === 'close') { msg = `CLOSE! (+${score})`; color = "text-yellow-400"; }
            else if (outcome === 'wrong') { msg = `WRONG! (${score})`; color = "text-red-400"; }
            
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                    <div className="flex flex-col items-center">
                        {outcome === 'correct' && <Check size={48} className="mb-4 text-green-400" />}
                        {outcome === 'close' && <AlertCircle size={48} className="mb-4 text-yellow-400" />}
                        {outcome === 'wrong' && <X size={48} className="mb-4 text-red-500" />}
                        <h2 className="text-2xl font-bold mb-4">Answer Verified</h2>
                        <div className={`text-3xl md:text-4xl font-black ${color}`}>{msg}</div>
                        <p className="mt-8 text-slate-400 animate-pulse">Waiting for round to end...</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="animate-pulse flex flex-col items-center"><Check size={48} className="mb-4 text-green-400" /><h2 className="text-2xl font-bold">Answer Submitted</h2><p className="text-slate-400">Waiting for verification...</p></div>
            </div>
        );
    }

    if (!buzzedIn) {
        return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
            <Volume2 size={64} className="mb-8 text-blue-400 animate-pulse" />
            <h1 className="text-3xl md:text-4xl font-black text-white mb-8 text-center">Listen & Buzz In!</h1>
            <button 
                onClick={buzzIn}
                className="w-full max-w-sm aspect-square rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 border-8 border-red-800 shadow-2xl flex flex-col items-center justify-center transition-all active:scale-95"
            >
                <Bell size={64} className="text-white mb-2" />
                <span className="text-3xl font-black text-white tracking-widest">BUZZ</span>
            </button>
            <button onClick={voteSkip} disabled={votedSkip} className="mt-12 text-slate-500 font-bold flex items-center gap-2 hover:text-white"><FastForward size={20} /> Don't know? Vote to Skip</button>
          </div>
        );
    }

    // Buzzed in: Show Input & Timer
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="mb-6 flex flex-col items-center">
             <div className="text-5xl font-black text-yellow-400 mb-2">{typingTime}s</div>
             <p className="text-slate-400 text-sm">Time to type!</p>
        </div>
        
        <div className="mb-6 w-full max-w-md">
             {(!hintTaken && game.gameMode !== 'chill') ? (
                 <button onClick={takeHint} className="w-full py-3 border-2 border-dashed border-slate-600 text-slate-400 rounded-xl hover:border-yellow-500 hover:text-yellow-500 transition-colors flex items-center justify-center gap-2"><Lightbulb size={18} /> Need a Hint? (25% Penalty)</button>
             ) : (
                 <div className="w-full py-4 bg-yellow-900/30 border border-yellow-600/50 rounded-xl text-yellow-200 text-center animate-fade-in px-4"><div className="text-xs font-bold uppercase tracking-widest text-yellow-500 mb-1">HINT</div><div className="font-bold text-lg">{game.currentSong?.hint || "No hint available."}</div></div>
             )}
        </div>

        <div className="w-full max-w-4xl space-y-4">
           <input autoFocus className="w-full bg-white p-4 rounded-xl text-black text-xl font-bold text-center uppercase placeholder:text-gray-500 shadow-xl" placeholder="TYPE MOVIE TITLE HERE..." value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAnswer()} />
           <div className="flex gap-2"><button onClick={() => submitAnswer()} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-xl shadow-xl active:scale-95 transition-transform">SUBMIT</button></div>
        </div>
      </div>
    );
  }
  
  if (game.status === 'revealed') {
    const myResult = game.roundResults?.find(r => r.uid === user.uid);
    const score = myResult?.actualScore || 0;
    const outcome = myResult?.outcome;
    let msg = "DID NOT BUZZ";
    let color = "text-slate-400";
    
    if (game.gameMode === 'coop') {
        if (game.roundWinnerCount > 0) {
            msg = "TEAM CORRECT!"; color = "text-green-400";
        } else {
            msg = "TEAM MISSED!"; color = "text-red-400";
        }
    } else {
        if (outcome === 'correct') { msg = `CORRECT! (+${score})`; color = "text-green-400"; }
        else if (outcome === 'close') { msg = `CLOSE! (+${score})`; color = "text-yellow-400"; }
        else if (outcome === 'wrong') { msg = `WRONG! (${score})`; color = "text-red-400"; }
        else if (buzzedIn && !hasAnswered) { msg = "TIME UP!"; color = "text-red-400"; }
    }
    
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
         <div className="mb-6 relative w-full flex justify-center">
            <img src={game.currentSong?.coverArt || "https://placehold.co/400x400/1e293b/ffffff?text=Soundtrack"} className="max-h-[50vh] w-auto max-w-full rounded-xl shadow-2xl object-contain" />
            <div className="absolute -bottom-4 bg-blue-600 text-white p-3 rounded-full shadow-lg font-bold">
               {((game.gameMode === 'coop' && game.roundWinnerCount > 0) || outcome === 'correct' || outcome === 'close') ? <Check size={24}/> : <X size={24}/>}
            </div>
         </div>
         <h2 className="text-2xl font-bold mb-1 text-white">{game.currentSong?.movie}</h2>
         <p className="text-slate-400 mb-8">{game.currentSong?.title}</p>
         <div className={`text-3xl md:text-4xl font-black ${color}`}>{msg}</div>
      </div>
    );
  }
  return null; 
};


