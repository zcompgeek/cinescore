// --- UTILS ---
export const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Local Batch Answer Verification utilizing Levenshtein distance
export const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    return matrix[b.length][a.length];
};

export const verifyBatchAnswers = async (submissionsList, currentSong) => {
  const acceptableAnswers = currentSong.acceptableAnswers || [currentSong.movie.toLowerCase().trim()];
  
  return submissionsList.map(s => {
      const guess = s.answer.toLowerCase().trim();
      const cleanGuess = guess.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      
      let bestScore = 0;
      let exp = "Incorrect.";
      
      if (cleanGuess.length > 0) {
        for (const ans of acceptableAnswers) {
          const cleanAns = ans.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
          const dist = levenshtein(cleanAns, cleanGuess);
          
          if (dist <= 3) {
              bestScore = 100;
              exp = `Matched acceptable answer: "${ans}"`;
              break; // max score
          } 
          
          // Substring match for partial points if guess is reasonably long
          if (bestScore < 50 && cleanAns.length > 3 && cleanGuess.length > 2 && (cleanAns.includes(cleanGuess) || cleanGuess.includes(cleanAns))) {
              bestScore = 50;
              exp = `Partial match with: "${ans}"`;
          }
        }
      }
      
      console.log(`[JUDGE] Evaluated "${s.answer}" -> ${bestScore} points. Explanation: ${exp}`);
      return { uid: s.uid, score: bestScore, explanation: exp };
  });
};


