import fs from 'fs';

const obscureTitles = [
  "Le Professionnel",
  "Somewhere in Time",
  "Midnight Cowboy",
  "Out of Africa",
  "Pat Garrett & Billy the Kid",
  "Above the Rim",
  "Honeysuckle Rose",
  "Gentlemen Prefer Blondes",
  "Peter Gunn",
  "Dragnet",
  "Rawhide",
  "St. Elsewhere",
  "L.A. Law",
  "Hill Street Blues",
  "Airwolf",
  "The Greatest American Hero",
  "Moonlighting",
  "The Partridge Family",
  "Jem",
  "She-Ra: Princess of Power",
  "The Love Boat",
  "Fantasy Island",
  "Miami Vice",
  "Knight Rider",
  "The Dukes of Hazzard",
  "Magnum, P.I.",
  "Dallas",
  "Dynasty",
  "Superfly",
  "Shaft",
  "An Officer and a Gentleman",
  "When Marnie Was There",
  "The Secret World of Arrietty",
  "Whisper of the Heart"
];

const files = [
  'src/data/all_time_scores.js',
  'src/data/animated_films.js',
  'src/data/cartoons.js',
  'src/data/classic_tv.js',
  'src/data/modern_tv.js',
  'src/data/movie_soundtracks.js',
  'src/data/musicals.js'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/export const (\w+) = (\[[\s\S]*\]);?/);
  
  if (match) {
    const varName = match[1];
    const data = JSON.parse(match[2]);
    const filtered = data.filter(item => !obscureTitles.includes(item.movie));
    
    if (filtered.length !== data.length) {
      console.log(`Removing ${data.length - filtered.length} items from ${file}`);
      const newJson = JSON.stringify(filtered, null, 2);
      const newContent = `export const ${varName} = ${newJson};\n`;
      fs.writeFileSync(file, newContent, 'utf8');
    }
  }
}
