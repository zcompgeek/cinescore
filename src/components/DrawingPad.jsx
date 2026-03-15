import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star, Clock, ArrowLeft, ArrowRight, Lightbulb, Bell } from 'lucide-react';

export const DrawingPad = ({ onSave }) => {
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

  const startDrawing = (e) => { e.preventDefault(); const { x, y } = getCoordinates(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); };
  const draw = (e) => { if (!isDrawing) return; e.preventDefault(); const { x, y } = getCoordinates(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke(); };
  const stopDrawing = () => { if (isDrawing) { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); } };
  const clearCanvas = () => { const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, canvas.width, canvas.height); onSave(null); };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative border-2 border-slate-600 rounded-lg overflow-hidden touch-none">
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '300px', height: 'auto', aspectRatio: '1/1' }}
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
        />
        <button onClick={(e) => { e.preventDefault(); clearCanvas(); }} className="absolute top-2 right-2 p-2 bg-red-600/80 rounded hover:bg-red-500 text-white"><X size={16} /></button>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1">Draw your icon!</p>
    </div>
  );
};




