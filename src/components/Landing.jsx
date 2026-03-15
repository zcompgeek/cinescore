import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star, Clock, ArrowLeft, ArrowRight, Lightbulb, Bell } from 'lucide-react';
import { DrawingPad } from './DrawingPad';

export const Landing = ({ setMode, joinGame, hostGame }) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [step, setStep] = useState(1);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setCode(codeParam.toUpperCase().slice(0, 4));
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
      </div>
      <div className="z-10 text-center w-full max-w-4xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="bg-gradient-to-tr from-purple-500 to-blue-500 p-4 rounded-2xl shadow-2xl"><Music size={48} className="text-white" /></div>
        </div>
        <h1 className="text-5xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">CineScore</h1>
        <p className="text-slate-400 mb-8 text-lg">The Ultimate Soundtrack Trivia</p>
        <div className="space-y-4 max-w-lg mx-auto w-full">
          {step === 1 ? (
             <>
               <button onClick={() => hostGame()} className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg">Host a New Game</button>
               <div className="relative my-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-500">OR JOIN EXISTING</span></div></div>
               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-3 w-full">
                 <input ref={nameInputRef} type="text" placeholder="YOUR NAME" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600" value={name} onChange={e => setName(e.target.value)} />
                 <input type="text" placeholder="GAME CODE (e.g. ABCD)" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:text-slate-600" maxLength={4} value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
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


