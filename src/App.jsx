import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  runTransaction,
  arrayUnion,
  increment,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star, Clock, ArrowLeft, ArrowRight, PenTool, MessageCircle, Hourglass } from 'lucide-react';

// --- CONFIGURATION & ENVIRONMENT SETUP ---
const getEnvironmentConfig = () => {
  // 1. Preview Environment (Internal Use)
  if (typeof __firebase_config !== 'undefined') {
    return {
      firebaseConfig: JSON.parse(__firebase_config),
      appId: typeof __app_id !== 'undefined' ? __app_id : 'default-app-id',
      geminiKey: "",
      tmdbAccessToken: "" 
    };
  }

  // 2. Vite / Firebase App Hosting
  try {
    if (import.meta && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        firebaseConfig: {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        },
        appId: "cinescore-prod",
        geminiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
        tmdbAccessToken: import.meta.env.VITE_TMDB_ACCESS_TOKEN || ""
      };
    }
  } catch (e) {}

  // 3. Manual Fallback
  return {
    firebaseConfig: {
      apiKey: "REPLACE_WITH_YOUR_API_KEY",
      authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
      projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
      storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
      messagingSenderId: "REPLACE_WITH_SENDER_ID",
      appId: "REPLACE_WITH_APP_ID"
    },
    appId: "cinescore-manual",
    geminiKey: "REPLACE_WITH_GEMINI_KEY",
    tmdbAccessToken: "REPLACE_WITH_TMDB_READ_ACCESS_TOKEN"
  };
};

const { firebaseConfig, appId, geminiKey: initialGeminiKey, tmdbAccessToken } = getEnvironmentConfig();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TRIVIA DATASETS ---
// NOTE FOR LOCAL DEV: Uncomment the line below and remove/comment out the const CATEGORIES = {} line.
import { CATEGORIES } from './data';

// const CATEGORIES = {};

// --- UTILS ---
const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Gemini Batch Answer Verification
const verifyBatchAnswers = async (submissionsList, correctMovie, apiKey) => {
  if (!apiKey || apiKey === "") {
      console.error("[JUDGE] Error: No API Key provided.");
      return submissionsList.map(s => ({ uid: s.uid, score: 0 })); 
  }
  
  const guessesString = submissionsList.map(s => `ID: ${s.uid}, Guess: "${s.answer}"`).join("\n");

  const prompt = `
    I am a trivia game judge.
    The correct movie answer is: "${correctMovie}".
    
    Here is a list of player guesses:
    ${guessesString}
    
    For each guess, determine the score based on these rules:
    1. If the guess is the exact movie or a very widely accepted distinct title (e.g. "Empire Strikes Back" for "Star Wars: Episode V"), award 100 points.
    2. If the guess is the correct franchise but not the specific movie, award 50 points.
    3. If the guess is wrong, award 0 points.
    
    Return ONLY a raw JSON array of objects with 'uid' and 'score'. Example:
    [{"uid": "user1", "score": 100}, {"uid": "user2", "score": 0}]
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );
    
    if (!response.ok) throw new Error(`API Error ${response.status}`);

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("Empty response from AI");
    
    // Cleanup markdown
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const result = JSON.parse(resultText);
    if (!Array.isArray(result)) throw new Error("Invalid response format: expected array");
    
    return result;
  } catch (e) {
    console.error("[JUDGE] Exception during batch verification:", e);
    // Fallback: simple exact match
    const normalizedCorrect = correctMovie.toLowerCase();
    return submissionsList.map(s => {
        const normalizedGuess = (s.answer || "").toLowerCase();
        let score = 0;
        if (normalizedGuess.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedGuess)) score = 100;
        return { uid: s.uid, score };
    });
  }
};

// Search APIs
const searchItunes = async (query) => {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
    const data = await res.json();
    return data.results[0] || null;
  } catch (e) {
    console.error("iTunes Search failed", e);
    return null;
  }
};

const searchMoviePoster = async (query, type = 'movie', year = null) => {
  if (!tmdbAccessToken || tmdbAccessToken.startsWith("REPLACE")) return null;
  
  try {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    let url = `https://api.themoviedb.org/3/search/${endpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    if (year) url += type === 'movie' ? `&year=${year}` : `&first_air_date_year=${year}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', Authorization: `Bearer ${tmdbAccessToken}` }
    });

    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
        const sortedResults = data.results.sort((a, b) => b.popularity - a.popularity);
        const bestResult = sortedResults[0];
        if (bestResult.poster_path) return `https://image.tmdb.org/t/p/w780${bestResult.poster_path}`;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// --- HELPER: PICK RANDOM SONG ---
const pickRandomSong = async (categoryList, playedSongsHistory = []) => {
    // Normalize played songs to just titles for comparison
    const usedTitles = playedSongsHistory.map(s => (typeof s === 'string' ? s : s.title));
    let availableSongs = categoryList.filter(s => !usedTitles.includes(s.title));

    if (availableSongs.length === 0) return null; // No songs left

    let selectedSong = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!selectedSong && availableSongs.length > 0 && attempts < MAX_ATTEMPTS) {
        attempts++;
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const candidate = availableSongs[randomIndex];

        // Fetch Music and Poster
        const [musicData, posterUrl] = await Promise.all([
            searchItunes(`${candidate.title} ${candidate.artist} soundtrack`),
            searchMoviePoster(candidate.movie, 'movie', candidate.year) 
        ]);

        if (musicData?.previewUrl && (posterUrl || musicData?.artworkUrl100)) {
            selectedSong = {
                ...candidate,
                previewUrl: musicData.previewUrl,
                coverArt: posterUrl || musicData.artworkUrl100?.replace('100x100', '600x600')
            };
        } else {
            // Remove bad candidate and try again
            availableSongs.splice(randomIndex, 1);
        }
    }
    return selectedSong;
};


// --- DRAWING COMPONENT ---
const DrawingPad = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 300; 
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if (event.touches) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e) => {
    e.preventDefault(); 
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSave(null);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative border-2 border-slate-600 rounded-lg overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', maxWidth: '300px', height: 'auto', aspectRatio: '1/1' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button onClick={(e) => { e.preventDefault(); clearCanvas(); }} className="absolute top-2 right-2 p-2 bg-red-600/80 rounded text-white"><X size={16}/></button>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1"><PenTool size={12}/> Draw your icon!</p>
    </div>
  );
};

// --- COMPONENTS ---

// 1. LANDING SCREEN
const Landing = ({ setMode, joinGame }) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [step, setStep] = useState(1); 

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 text-center w-full max-w-4xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="bg-gradient-to-tr from-purple-500 to-blue-500 p-4 rounded-2xl shadow-2xl">
            <Music size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">CineScore</h1>
        <p className="text-slate-400 mb-8 text-lg">The Ultimate Soundtrack Trivia</p>

        <div className="space-y-4 max-w-lg mx-auto w-full">
          {step === 1 ? (
             <>
               <button onClick={() => setMode('host')} className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg">Host a New Game</button>
               <div className="relative my-6">
                 <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
                 <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-500">OR JOIN EXISTING</span></div>
               </div>
               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-3 w-full">
                 <input type="text" placeholder="YOUR NAME" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600" value={name} onChange={e => setName(e.target.value)}/>
                 <input type="text" placeholder="GAME CODE (e.g. ABCD)" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:text-slate-600" maxLength={4} value={code} onChange={e => setCode(e.target.value.toUpperCase())}/>
                 <button disabled={!name || code.length !== 4} onClick={() => setStep(2)} className="w-full py-3 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2">Next: Draw Avatar <ArrowRight size={18} className="inline ml-1" /></button>
               </div>
             </>
          ) : (
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 w-full">
                 <h2 className="text-xl font-bold text-white">Draw Your Icon</h2>
                 <DrawingPad onSave={setAvatar} />
                 <div className="flex gap-2">
                     <button onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-600 transition-colors">Back</button>
                     <button onClick={() => joinGame(code, name, avatar)} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 transition-colors">Join Game</button>
                 </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. HOST SCREEN
const HostView = ({ gameId, user }) => {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [category, setCategory] = useState("all_stars");
  const [totalRounds, setTotalRounds] = useState(10);
  const [showSettings, setShowSettings] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [roundTimeLeft, setRoundTimeLeft] = useState(60);
  const audioRef = useRef(null);

  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (docSnap) => {
      if (docSnap.exists()) setGame(docSnap.data());
    });
    const unsubPlayers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players'), (snap) => {
      const pList = [];
      snap.forEach(d => pList.push({id: d.id, ...d.data()}));
      setPlayers(pList.sort((a,b) => b.score - a.score));
    });
    return () => { unsubGame(); unsubPlayers(); };
  }, [gameId]);

  // Global Round Timer
  useEffect(() => {
      if (game?.status === 'playing') {
          if (roundTimeLeft > 0) {
              const timer = setTimeout(() => setRoundTimeLeft(t => t - 1), 1000);
              return () => clearTimeout(timer);
          }
      } else {
          setRoundTimeLeft(60); // Reset for next round
      }
  }, [roundTimeLeft, game?.status]);

  // Audio Player Effect - CONTINUOUS PLAY
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

  // ROUND MANAGEMENT LOGIC
  useEffect(() => {
    if (!game || game.status !== 'playing') return;

    // Check End of Round Conditions
    const activePlayerCount = players.length;
    const submissions = game.submissions || {};
    const skips = game.skips || [];
    
    const submittedUids = Object.keys(submissions);
    // A player is "done" if they have submitted OR they voted to skip
    const donePlayers = new Set([...submittedUids, ...skips]);
    const allDone = activePlayerCount > 0 && donePlayers.size >= activePlayerCount;
    const timeUp = roundTimeLeft === 0;

    if (allDone || timeUp) {
        // ROUND COMPLETE - VERIFY BATCH AND SCORE
        const finalizeRound = async () => {
            const apiKey = initialGeminiKey;
            
            // Prepare unverified submissions
            const submissionsList = Object.keys(submissions).map(uid => ({
                uid,
                answer: submissions[uid].answer
            }));
            
            let results = [];
            if (submissionsList.length > 0) {
                 results = await verifyBatchAnswers(submissionsList, game.currentSong.movie, apiKey);
            }

            const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
            const buzzes = game.buzzes || [];
            const batch = writeBatch(db);
            
            // Assign points with penalty logic
            let correctCountBefore = 0;
            let roundWinnerCount = 0;
            
            // Sort buzzes by timestamp just in case
            const sortedBuzzes = [...buzzes].sort((a,b) => a.timestamp - b.timestamp);

            for (const buzz of sortedBuzzes) {
                // Find verification result
                const res = results.find(r => r.uid === buzz.uid);
                const score = res ? res.score : 0;
                const isCorrect = score > 0;

                if (isCorrect) {
                    // This player was correct. 
                    // Calculate their score: Base (from Gemini) - (10 * correctCountBefore)
                    const finalScore = Math.max(10, score - (correctCountBefore * 10)); // Min 10 points
                    
                    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', buzz.uid);
                    batch.update(playerRef, { score: increment(finalScore) });
                    
                    // Increment penalty counter for NEXT correct person
                    correctCountBefore++;
                    roundWinnerCount++;
                    
                    // Inject actual awarded score back into result for UI display
                    res.actualScore = finalScore;
                } else {
                    if (res) res.actualScore = 0;
                }
            }
            
            // Update game state to revealed
            batch.update(gameRef, {
                status: 'revealed',
                lastRoundScore: 0, 
                roundWinnerCount: roundWinnerCount,
                roundResults: results
            });
            
            await batch.commit();
        };
        // Ensure we only run this once by checking status is still 'playing' inside effect trigger
        // The effect dependency on roundTimeLeft=0 or allDone=true triggers this.
        // We add a small flag or check to ensure we don't spam.
        // For simplicity, we rely on the state transition to 'revealed' to stop re-execution, 
        // but we need to prevent double-fire in React 18 strict mode or race conditions.
        // Since we check game.status !== 'playing' at start, once we commit the batch update to 'revealed', this effect won't run.
        finalizeRound();
    }

  }, [game?.submissions, game?.skips, players.length, game?.status, roundTimeLeft]);


  // Auto-Advance
  useEffect(() => {
      let timer;
      if (game?.status === 'revealed') {
          timer = setTimeout(() => { nextRound(); }, 6000);
      }
      return () => clearTimeout(timer);
  }, [game?.status]);


  const startGame = async () => {
    setShowSettings(false);
    
    // Determine category and media type
    const mediaType = (category === 'modern_tv' || category === 'classic_tv') ? 'tv' : 'movie';
    // const allSongs = CATEGORIES[category]; // In local, use import
    const allSongs = CATEGORIES[category]; 
    if (!allSongs || Object.keys(allSongs).length === 0) {
        // Fallback for empty/missing data in preview
         console.warn("CATEGORY DATA MISSING. Using placeholder.");
         return; 
    }
    
    const trackList = allSongs;
    if (!trackList || trackList.length === 0) { alert("Empty Category"); return; }
    
    const trackData = trackList[Math.floor(Math.random() * trackList.length)];

    // Fetch First Song
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
      round: 1, 
      totalRounds: totalRounds,
      playedSongs: [ { title: trackData.title, artist: trackData.artist, movie: trackData.movie, coverArt } ], 
      skips: [],
      buzzes: [],      
      submissions: {}, 
      currentSong: { ...trackData, previewUrl, coverArt },
      feedbackMessage: null,
      roundResults: []
    });
    
    await batch.commit();
  };

  const nextRound = async () => {
    // Check if Game Over
    if (game?.round >= game?.totalRounds) {
        const sortedPlayers = [...players].sort((a,b) => b.score - a.score);
        const winner = sortedPlayers.length > 0 ? sortedPlayers[0] : null; 
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
            status: 'game_over',
            winner: winner ? { uid: winner.id, username: winner.username, score: winner.score, avatar: winner.avatar } : null
        });
        return;
    }

    const allSongs = CATEGORIES[category];
    if (!allSongs) return;

    const playedSongs = game?.playedSongs || [];
    const usedTitles = playedSongs.map(s => (typeof s === 'string' ? s : s.title));
    const availableSongs = allSongs.filter(s => !usedTitles.includes(s.title));

    if (availableSongs.length === 0) {
        alert("Ran out of unique songs in this category!");
        return;
    }

    const mediaType = (category === 'modern_tv' || category === 'classic_tv') ? 'tv' : 'movie';
    let selectedSong = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!selectedSong && availableSongs.length > 0 && attempts < MAX_ATTEMPTS) {
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
                coverArt: posterUrl || musicData.artworkUrl100?.replace('100x100', '600x600')
            };
        } else {
            availableSongs.splice(randomIndex, 1);
        }
    }

    if (!selectedSong) {
        alert("Error: Could not find a valid song. Please try another category.");
        return;
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentSong: selectedSong,
      status: 'playing',
      round: increment(1),
      playedSongs: arrayUnion({
          title: selectedSong.title,
          artist: selectedSong.artist,
          movie: selectedSong.movie,
          coverArt: selectedSong.coverArt
      }),
      skips: [],
      buzzes: [],
      submissions: {},
      feedbackMessage: null,
      roundResults: []
    });
  };

  const giveUp = async () => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
       status: 'revealed'
     });
  };

  const handleNewGame = async () => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
          status: 'lobby',
          winner: null,
          currentSong: null,
          buzzerWinner: null,
          buzzes: [],
          submissions: {}
      });
      setShowSettings(true);
      setShowHistory(false);
  };
  
  const getPlayer = (uid) => players.find(p => p.id === uid);
  
  // Guard clause for HostView render to prevent white screen crash
  if (!game) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 animate-pulse">Loading Game...</div>;

  const buzzerPlayer = game?.buzzerWinner ? getPlayer(game.buzzerWinner.uid) : null;

  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6">Game Setup</h2>
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl w-full max-w-6xl border border-slate-700">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">GAME CODE</label>
            <div className="text-4xl font-mono font-black text-center bg-black/30 p-4 rounded-lg tracking-widest text-blue-400">{gameId}</div>
          </div>
          <div className="mt-6">
             <label className="block text-sm font-bold mb-2 text-slate-400">CATEGORY</label>
             <div className="grid grid-cols-2 gap-2 mb-4">
               {Object.keys(CATEGORIES).map(c => (
                 <button key={c} onClick={() => setCategory(c)} className={`p-2 rounded capitalize font-bold text-xs md:text-sm ${category === c ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}>{c.replace('_', ' ')}</button>
               ))}
             </div>
             <label className="block text-sm font-bold mb-2 text-slate-400">NUMBER OF SONGS</label>
             <div className="flex gap-2">
                {[10, 25, 50].map(num => (
                    <button key={num} onClick={() => setTotalRounds(num)} className={`flex-1 p-2 rounded font-bold ${totalRounds === num ? 'bg-green-600 ring-2 ring-green-400' : 'bg-slate-700'}`}>{num}</button>
                ))}
             </div>
          </div>
          <div className="pt-4 border-t border-slate-700 mt-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18}/> Players Joined ({players.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
              {players.map(p => (
                <div key={p.id} className="bg-slate-700/50 p-3 rounded-xl flex items-center gap-3 border border-slate-600">
                  <div className="relative">
                    {p.avatar ? (
                        <img src={p.avatar} alt={p.username} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-blue-400 object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-500 flex items-center justify-center">
                            <span className="text-xs font-bold">{p.username.charAt(0)}</span>
                        </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                      <div className="font-bold truncate text-sm">{p.username}</div>
                      <div className="text-xs text-blue-300 font-mono">{p.score} pts</div>
                  </div>
                </div>
              ))}
              {players.length === 0 && <div className="col-span-full text-slate-500 italic text-center py-4">Waiting for players to join...</div>}
            </div>
          </div>
          <button onClick={startGame} disabled={players.length === 0} className="w-full py-4 mt-6 bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-xl hover:scale-105 transition-transform">Start Game</button>
        </div>
      </div>
    );
  }

  // Calculate stats for display
  const buzzes = game?.buzzes || [];
  const submissions = game?.submissions || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col h-screen overflow-hidden">
       <audio ref={audioRef} loop />
       <div className="bg-slate-900 p-4 shadow-lg flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
             <div className="bg-blue-600 px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm whitespace-nowrap">R {game?.round} / {game?.totalRounds}</div>
             <div className="text-slate-400 font-mono text-lg md:text-xl">{gameId}</div>
          </div>
          {game?.status === 'playing' && (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded text-yellow-400 font-mono font-bold">
                  <Clock size={16} /> {roundTimeLeft}s
              </div>
          )}
          <div className="flex gap-2">
             <button onClick={giveUp} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700">Skip Song</button>
             <button onClick={() => setShowSettings(true)} className="text-xs text-slate-500 hover:text-white">Settings</button>
          </div>
       </div>
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full mx-auto">
          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto w-full">
             {(game?.status === 'revealed' || game?.status === 'game_over') && game?.currentSong?.coverArt ? (
                <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl transition-all duration-1000" style={{ backgroundImage: `url(${game.currentSong.coverArt})`}} />
             ) : (
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600 rounded-full blur-[100px] animate-pulse"></div>
                </div>
             )}
             <div className="z-10 w-full max-w-4xl text-center">
                <div className="mb-4 md:mb-8">
                   
                   {/* SHOW LIVE BUZZES */}
                   {game?.status === 'playing' && buzzes.length > 0 && (
                       <div className="flex flex-col items-center gap-4 mb-8">
                           <h3 className="text-2xl font-bold animate-pulse text-yellow-400">Guessing...</h3>
                           <div className="flex flex-wrap justify-center gap-3">
                               {buzzes.map((b, i) => {
                                   const player = getPlayer(b.uid);
                                   const hasSubmitted = submissions[b.uid]?.status === 'pending' || submissions[b.uid]?.status === 'verified';
                                   
                                   return (
                                       <div key={b.uid} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${hasSubmitted ? 'bg-green-600/50 border-green-400' : 'bg-slate-800/80 border-yellow-500'}`}>
                                           {player?.avatar ? <img src={player.avatar} className="w-8 h-8 rounded-full border border-white" /> : <div className="w-8 h-8 bg-white/20 rounded-full"/>}
                                           <span className="font-bold">{b.username}</span>
                                           {hasSubmitted && <Check size={16} className="text-green-400"/>}
                                       </div>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {/* GAME OVER STATE */}
                   {game?.status === 'game_over' && (
                       <div className="bg-slate-900/90 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm animate-bounce-short">
                           {game.winner?.avatar && <img src={game.winner.avatar} className="w-24 h-24 rounded-full border-4 border-yellow-500 mx-auto mb-4 object-cover bg-slate-800" />}
                           <Trophy size={60} className="text-yellow-400 mx-auto mb-4 md:w-20 md:h-20" />
                           <h1 className="text-3xl md:text-4xl font-black mb-2">GAME OVER</h1>
                           <div className="text-xl md:text-2xl mb-6 md:mb-8">
                               Winner: <span className="text-yellow-400 font-bold">{game.winner?.username || "Unknown"}</span>
                               <div className="text-slate-400 text-lg">Score: {game.winner?.score}</div>
                           </div>
                           <button 
                             onClick={handleNewGame}
                             className="px-6 py-3 md:px-8 md:py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 mx-auto"
                           >
                             <RefreshCw size={20}/> Setup New Game
                           </button>
                       </div>
                   )}

                   {/* PLAYING STATE */}
                   {game?.status === 'playing' && buzzes.length === 0 && (
                     <div className="animate-pulse flex flex-col items-center text-blue-400">
                        <Volume2 size={48} className="mb-4 md:w-16 md:h-16" />
                        <h2 className="text-2xl md:text-3xl font-bold">Listen Closely...</h2>
                        <div className="mt-4 flex gap-2">
                             {game.skips?.length > 0 && (
                                 <span className="text-slate-400 text-sm">{game.skips.length} vote(s) to skip</span>
                             )}
                        </div>
                     </div>
                   )}

                   {game?.status === 'revealed' && (
                     <div className="bg-slate-900/90 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm w-full max-w-5xl">
                        <div className="mb-6 flex flex-col items-center">
                           <img 
                             src={game.currentSong.coverArt} 
                             className="max-h-[40vh] w-auto max-w-full object-contain rounded-lg shadow-2xl mb-6" 
                             alt="Movie Poster"
                           />
                           <h2 className="text-3xl md:text-5xl font-black text-white text-center leading-tight mb-2">{game.currentSong.movie}</h2>
                           <p className="text-blue-400 text-xl md:text-2xl font-bold">{game.currentSong.title}</p>
                           <p className="text-slate-500 text-lg">{game.currentSong.artist}</p>
                        </div>
                        
                        <div className="text-center mb-6">
                            <p className="text-green-400 font-bold text-xl">{game.roundWinnerCount || 0} Correct Guesses!</p>
                        </div>

                        <button 
                          onClick={nextRound}
                          className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-110 transition-transform flex items-center gap-2 mx-auto text-xl shadow-lg"
                        >
                          Next Round <SkipForward size={24}/>
                        </button>
                     </div>
                   )}
                </div>
             </div>
          </div>

          {/* Leaderboard Sidebar - Scrollable at bottom on mobile, side on desktop */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 md:p-6 flex flex-col h-48 md:h-auto shrink-0">
             <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-6 flex items-center gap-2 sticky top-0 bg-slate-900 z-10">
               <Trophy className="text-yellow-500" size={20} /> Leaderboard
             </h3>
             <div className="space-y-2 md:space-y-3 overflow-y-auto flex-1 pb-2 pr-1">
               {players.map((p, idx) => (
                 <div key={p.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg transition-all ${idx === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-transparent border border-yellow-600/30' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                       <span className={`font-mono font-bold w-6 text-center shrink-0 ${idx===0 ? 'text-yellow-500' : 'text-slate-500'}`}>#{idx+1}</span>
                       <div className="flex items-center gap-2 overflow-hidden min-w-0">
                           {p.avatar ? (
                               <img src={p.avatar} className="w-8 h-8 rounded-full border border-slate-500 shrink-0 bg-slate-700 object-cover" />
                           ) : (
                               <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{p.username.charAt(0)}</div>
                           )}
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

// 3. PLAYER SCREEN
const PlayerView = ({ gameId, user, username }) => {
  const [game, setGame] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [myAvatar, setMyAvatar] = useState(null);
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showHistory, setShowHistory] = useState(false); 
  const [buzzerTime, setBuzzerTime] = useState(null);

  useEffect(() => {
    // Game Listener
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        if (data.status === 'playing') {
            // Check if I have buzzed
            const myBuzz = data.buzzes?.find(b => b.uid === user.uid);
            if (myBuzz && !buzzerTime) setBuzzerTime(Date.now()); // Start timer ref
            
            // New round reset for answer input
            if (!myBuzz && buzzerTime) {
                setBuzzerTime(null);
                setHasAnswered(false);
                setAnswer("");
            }
        }
        if (data.status === 'lobby') {
             setShowHistory(false);
             setBuzzerTime(null);
             setHasAnswered(false);
        }
      }
    });

    // My Score Listener
    const unsubPlayer = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', user.uid), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setMyScore(data.score);
            setMyAvatar(data.avatar);
        }
    });

    return () => { unsubGame(); unsubPlayer(); };
  }, [gameId, hasAnswered, user.uid, buzzerTime]); // Added buzzerTime dependency

  const hasBuzzed = game?.buzzes?.some(b => b.uid === user.uid);
  const hasSubmitted = game?.submissions?.[user.uid];

  const buzzIn = async () => {
    if (!game || hasBuzzed || game.status !== 'playing') return;
    
    // Add to buzzes array (order matters)
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
        buzzes: arrayUnion({ uid: user.uid, username: username, timestamp: Date.now() })
    });
  };

  const submitAnswer = async (forceContent = null) => {
    const content = forceContent !== null ? forceContent : answer;
    if (!content.trim()) return;

    setHasAnswered(true);
    // Use object map update for submission
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { 
        [`submissions.${user.uid}`]: {
            answer: content,
            status: 'pending',
            uid: user.uid,
            timestamp: Date.now()
        }
    });
  };

  const voteSkip = async () => {
      if (game.skips?.includes(user.uid)) return; // Already voted
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
          skips: arrayUnion(user.uid)
      });
  };

  // -- RENDER STATES --

  if (!game) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  const isMe = hasBuzzed;
  
  // 1. GAME OVER - Victory or Defeat
  if (game.status === 'game_over') {
       // Check if user wants to see history
       if (showHistory) {
           return (
               <div className="min-h-screen bg-slate-900 flex flex-col p-6 text-white">
                   <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2"><Clock /> Song History</h2>
                   <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                        {game.playedSongs && game.playedSongs.length > 0 ? (
                           game.playedSongs.map((song, i) => (
                               <div key={i} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                                   {typeof song === 'object' ? (
                                       <>
                                           <img src={song.coverArt || "https://placehold.co/100"} className="w-12 h-12 rounded object-cover bg-slate-700" />
                                           <div className="text-left overflow-hidden">
                                               <div className="font-bold truncate text-sm text-white">{song.movie}</div>
                                               <div className="text-xs text-slate-400 truncate">{song.title}</div>
                                           </div>
                                       </>
                                   ) : (
                                       <span className="text-slate-400">{song}</span>
                                   )}
                               </div>
                           ))
                        ) : (
                           <div className="text-center text-slate-500 italic">No songs recorded.</div>
                        )}
                   </div>
                   <button 
                     onClick={() => setShowHistory(false)}
                     className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-white"
                   >
                     <ArrowLeft size={20} /> Back
                   </button>
               </div>
           );
       }

       const isWinner = game.winner?.uid === user.uid;
       if (isWinner) {
           return (
               <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-yellow-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <Trophy size={80} className="text-yellow-200 mb-6 animate-bounce md:w-32 md:h-32" />
                   <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-xl">VICTORY!</h1>
                   <div className="text-xl md:text-2xl font-bold bg-black/30 px-8 py-4 rounded-xl text-white">
                       Final Score: {myScore}
                   </div>
                   
                   {/* History Button for Winner */}
                   <button 
                     onClick={() => setShowHistory(true)}
                     className="mt-8 px-6 py-3 bg-black/20 hover:bg-black/40 rounded-full font-bold text-sm flex items-center gap-2 backdrop-blur-sm text-white"
                   >
                     <Clock size={16}/> View Songs
                   </button>

                   <div className="mt-8 flex gap-2">
                       <Star className="text-yellow-300 animate-spin-slow" size={32}/>
                       <Star className="text-yellow-300 animate-spin-slow" size={32}/>
                       <Star className="text-yellow-300 animate-spin-slow" size={32}/>
                   </div>
               </div>
           );
       } else {
           return (
               <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <h1 className="text-3xl md:text-4xl font-black mb-4 text-slate-500">GAME OVER</h1>
                   <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm border border-slate-700">
                       <div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Winner</div>
                       <div className="flex flex-col items-center mb-6">
                           {game.winner?.avatar && <img src={game.winner.avatar} className="w-16 h-16 rounded-full border-2 border-yellow-500 mb-2 object-cover bg-slate-800" />}
                           <div className="text-2xl md:text-3xl font-bold text-yellow-500">{game.winner?.username}</div>
                       </div>
                       
                       <div className="border-t border-slate-700 pt-6 mb-6">
                           <div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Your Score</div>
                           <div className="text-2xl font-bold text-white">{myScore}</div>
                       </div>

                       <button 
                         onClick={() => setShowHistory(true)}
                         className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-white"
                       >
                         <Clock size={18}/> View Song History
                       </button>
                   </div>
                   <p className="mt-8 text-slate-500 animate-pulse">Waiting for host...</p>
               </div>
           );
       }
  }

  // 3. I Buzzed! Input time.
  if (hasBuzzed && game.status !== 'revealed') {
    if (!hasSubmitted) {
        return (
          <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-6">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 animate-bounce">YOU'RE UP!</h1>
            <div className="text-slate-300 mb-6 text-sm">You have until the round ends...</div>
            <div className="w-full max-w-4xl space-y-4">
               <input 
                 autoFocus
                 className="w-full bg-white p-4 rounded-xl text-black text-xl font-bold text-center uppercase placeholder:text-gray-500"
                 placeholder="MOVIE TITLE?"
                 value={answer}
                 onChange={e => setAnswer(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submitAnswer()}
               />
               <div className="flex gap-2">
                 <button onClick={() => submitAnswer()} className="flex-1 bg-white text-green-900 py-4 rounded-xl font-black text-xl shadow-xl active:scale-95 transition-transform">SUBMIT</button>
               </div>
            </div>
          </div>
        );
    } else {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="animate-pulse flex flex-col items-center">
                    <MessageCircle size={48} className="mb-4" />
                    <h2 className="text-2xl font-bold">Answer Submitted</h2>
                    <p className="text-slate-400">Waiting for round to end...</p>
                </div>
            </div>
        );
    }
  }

  if (game.status === 'revealed') {
    const myResult = game.roundResults?.find(r => r.uid === user.uid);
    const score = myResult ? myResult.score : 0;
    const isCorrect = score > 0;
    
    // Calculate if we got penalized (base score > awarded score)
    // The client doesn't have the base score easily, so we just show what we got
    
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
         <div className="mb-6 relative w-full flex justify-center">
            <img src={game.currentSong.coverArt || "https://placehold.co/400x400/1e293b/ffffff?text=Soundtrack"} className="max-h-[50vh] w-auto max-w-full rounded-xl shadow-2xl object-contain" />
            <div className="absolute -bottom-4 bg-blue-600 text-white p-3 rounded-full shadow-lg font-bold">
               {game.lastRoundScore > 0 ? <Check size={24}/> : <X size={24}/>}
            </div>
         </div>
         <h2 className="text-2xl font-bold mb-1 text-white">{game.currentSong.movie}</h2>
         <p className="text-slate-400 mb-8">{game.currentSong.title}</p>
         
         {hasBuzzed && (<div className={`text-3xl md:text-4xl font-black ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>{isCorrect ? `CORRECT! (+${myResult?.actualScore || score})` : "WRONG!"}</div>)}
         {!hasBuzzed && (<div className="text-xl text-slate-500">Time's Up!</div>)}
      </div>
    );
  }

  const votedSkip = game.skips?.includes(user.uid);
  
  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col relative h-screen">
       <div className="bg-slate-800 p-4 flex justify-between items-center shadow-lg z-10 shrink-0">
           <div className="flex items-center gap-2">
               {myAvatar && <img src={myAvatar} className="w-10 h-10 rounded-full border border-slate-500 object-cover bg-slate-700" />}
               <div>
                   <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Score</div>
                   <div className="text-xl font-black text-blue-400">{myScore}</div>
               </div>
           </div>
           <div className="text-center">
               <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Room</div>
               <div className="font-mono text-lg text-white">{gameId}</div>
           </div>
           <div className="text-right">
               <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Song</div>
               <div className="text-xl font-bold text-white">{game.round}/{game.totalRounds}</div>
           </div>
       </div>

       {game.feedbackMessage && (
           <div className="absolute top-20 left-0 right-0 p-4 flex justify-center z-50 animate-bounce-short">
               <div className="bg-red-600 text-white px-4 py-2 rounded-full font-bold shadow-lg text-sm text-center">
                   {game.feedbackMessage}
               </div>
           </div>
       )}
       
       <div className="flex-1 flex flex-col items-center justify-center relative p-4 w-full max-w-full">
          <button onClick={buzzIn} className="w-56 h-56 md:w-80 md:h-80 rounded-full bg-red-600 border-b-8 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.5)] active:border-b-0 active:translate-y-2 active:shadow-none transition-all flex flex-col items-center justify-center group">
             <span className="text-5xl md:text-7xl font-black text-red-100 group-hover:text-white transition-colors">BUZZ</span>
          </button>
          <p className="mt-8 text-slate-400 font-medium animate-pulse text-center">Wait for the music...</p>
       </div>

       <div className="p-4 md:p-6 shrink-0 safe-area-bottom">
           <button onClick={voteSkip} disabled={votedSkip} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${votedSkip ? 'bg-slate-700 text-slate-500' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
               <FastForward size={20} />
               {votedSkip ? "Voted to Skip" : "Vote to Skip Song"}
           </button>
       </div>
    </div>
  );
};

// 4. MAIN APP CONTROLLER
export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // 'host' | 'player'
  const [gameId, setGameId] = useState(null);
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY") {
        setAuthError("Configuration Missing: Please set up your Firebase keys in the code.");
        return;
    }

    let mounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
           await signInWithCustomToken(auth, __initial_auth_token);
        } else {
           await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth failed", e);
        if (mounted) setAuthError(e.message);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => {
        if (mounted) setUser(u);
    });
    return () => {
        mounted = false;
        unsub();
    }
  }, []);

  const handleCreateGame = async () => {
    if (!user) return;
    const newCode = generateCode();
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', newCode);
    
    await setDoc(gameRef, {
      hostId: user.uid,
      status: 'lobby',
      createdAt: new Date(),
      round: 0,
      buzzerWinner: null,
      scores: {}
    });
    
    setGameId(newCode);
  };

  const handleJoinGame = async (code, name, avatar) => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code);
    const snap = await getDoc(gameRef);
    
    if (snap.exists()) {
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code, 'players', user.uid);
      await setDoc(playerRef, {
        username: name,
        score: 0,
        joinedAt: new Date(),
        avatar: avatar || null
      });
      setGameId(code);
      setUsername(name);
      setMode('player');
    } else {
      alert("Game not found!");
    }
  };

  if (authError) return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p className="text-slate-400 mb-4">{authError}</p>
          <p className="text-sm text-slate-600">If running locally, check your firebaseConfig settings.</p>
      </div>
  );

  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500 animate-pulse">Connecting to CineScore...</div>;

  if (mode === 'host' && gameId) return <HostView gameId={gameId} user={user} />;
  if (mode === 'player' && gameId) return <PlayerView gameId={gameId} user={user} username={username} />;

  if (mode === 'host' && !gameId) {
    handleCreateGame();
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Creating Room...</div>;
  }

  return <Landing setMode={setMode} joinGame={handleJoinGame} />;
}