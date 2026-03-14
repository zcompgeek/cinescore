# CineScore 🎵🎬

**The Ultimate Soundtrack Trivia**

CineScore is an interactive, real-time multiplayer trivia game where players test their knowledge of iconic movie and television soundtracks. Designed to be played in a group setting (like Jackbox Games), one device acts as the "Host" screen (typically a computer, laptop, or TV), while players join using their own mobile devices as their controllers and buzzers.

## How to Play

### Setup
1. **The Host** navigates to the app and clicks **"Host a New Game"**. This screen will be the main game board that everyone should look at.
2. The game will generate a unique 4-letter **Game Code** and a **QR Code**.
3. **Players** can use their mobile devices to either scan the QR code or manually enter the Game Code on the home screen.
4. Players enter their name and use the built-in drawing pad to sketch a custom avatar icon to represent them in the game.
5. Once everyone has joined, the Host selects a **Category**, sets the **Number of Songs**, and starts the game.

### The Rules
- **Listen Closely:** Each round, the Host device will play a snippet of a soundtrack from the chosen category.
- **Buzz In:** As soon as a player recognizes the soundtrack (or the movie/TV show it's from), they tap the **"BUZZ"** button on their device. 
- **Answer:** The player who buzzed in first gets a short window to type in their guess. (e.g., "Star Wars", "The Lion King", "Stranger Things").
- **AI Judging:** The game utilizes an AI judge (Gemini) to determine if the guess is correct, accounting for slight misspellings, synonymous titles, or acceptable variations.
- **Scoring:** Points are awarded for correct answers. If the player who buzzed in gets it wrong, they receive no points, and the Host moves to the next round.
- **Winning:** At the end of the total rounds, the player with the highest score is crowned the CineScore Champion!

## Categories
Currently, CineScore features a wide variety of preset soundtrack categories, including:
- All-Time Scores
- Modern TV
- Movie Soundtracks
- Animated Films
- Classic TV
- Cartoons
- Musicals

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Lucide React (Icons)
- **Backend & Database:** Firebase (Firestore for real-time state synchronization, Authentication)
- **AI Integration:** Google Gemini API (for intelligent, fuzzy-matching answer validation)
- **APIs:** TMDB API (for retrieving cover art)

## Possible Expansion Features (Roadmap)
Here are some exciting ideas for future updates to make CineScore even better:
1. **Custom Spotify/Apple Music Integration:** Allow hosts to link their own music accounts to generate custom trivia playlists based on their own libraries or Spotify's public playlists.
2. **More Niche Categories:** Expansions for Video Game Soundtracks, Anime Openings, specific decades (80s Synthwave, 90s Blockbusters), or specific composers (John Williams, Hans Zimmer, Joe Hisaishi).
3. **Game Modes:**
    - **Team Mode:** Allow players to group up and pool their scores.
    - **Survival/Sudden Death:** Keep playing until only one player remains who hasn't answered incorrectly.
    - **Name That Tune (Speed Run):** Bonus points for buzzing in within the first X seconds.
4. **Power-Ups:** Give players the ability to use points to buy power-ups (e.g., "Mute" another player's buzzer for a round, "Double Points" for the next round).
5. **Enhanced Host Screen Visuals:** Add dynamic audio visualizers that react to the current playing track, and more dramatic animations for the AI judging process.
6. **Detailed Post-Game Stats:** Show fastest buzzer, most accurate guesser, and other fun statistics on the final leaderboard.

## Local Development Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Add a `.env` file to the root of the project with your `VITE_GEMINI_API_KEY`, `VITE_TMDB_ACCESS_TOKEN`, and Firebase config variables.
4. Run `npm run dev` to start the local Vite server.
5. (Optional, for local Firebase emulators) Run `npx firebase emulators:start` to run the Auth and Firestore emulators locally for isolated testing without hitting production databases.
