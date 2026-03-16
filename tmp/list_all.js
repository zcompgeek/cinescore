import fs from 'fs';

const files = [
  'all_time_scores.js',
  'animated_films.js',
  'cartoons.js',
  'classic_tv.js',
  'modern_tv.js',
  'movie_soundtracks.js',
  'musicals.js'
];

for (const file of files) {
  const content = fs.readFileSync(`src/data/${file}`, 'utf8');
  const regex = /"movie": "([^"]+)"/g;
  const matches = [...content.matchAll(regex)];
  console.log(`\n=== ${file} ===`);
  const movies = [...new Set(matches.map(m => m[1]))];
  console.log(movies.join(' | '));
}
