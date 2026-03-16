import fs from 'fs';

const file = 'src/data/all_time_scores.js';
const content = fs.readFileSync(file, 'utf8');

// strip out `export const NAME = `
const match = content.match(/export const \w+ = (\[[\s\S]*\]);?/);
if (match) {
  try {
    const data = JSON.parse(match[1]);
    console.log("SUCCESS! The arrays are valid JSON.");
  } catch (e) {
    console.log("FAILED to parse as JSON:", e.message);
  }
} else {
  console.log("Export match failed.");
}
