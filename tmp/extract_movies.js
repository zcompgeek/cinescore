import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = [
  'all_time_scores.js',
  'animated_films.js',
  'cartoons.js',
  'classic_tv.js',
  'modern_tv.js',
  'movie_soundtracks.js',
  'musicals.js'
];

async function main() {
  for (const file of files) {
    const content = fs.readFileSync(`src/data/${file}`, 'utf8');
    const regex = /movie:\s*["']([^"']+)["']/g;
    const matches = [...content.matchAll(regex)];
    const titles = matches.map(m => m[1]);
    console.log(`\n=== ${file} ===`);
    console.log(titles.join('\n'));
  }
}

main();
