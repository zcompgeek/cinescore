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
  increment
} from 'firebase/firestore';
import { Volume2, Mic, Music, Trophy, Users, Play, SkipForward, AlertCircle, Smartphone, Film, Check, X, Bug } from 'lucide-react';

// --- CONFIGURATION & ENVIRONMENT SETUP ---
// This robustly handles:
// 1. The Preview Environment (using global variables)
// 2. Vite/Firebase App Hosting (using import.meta.env)
// 3. Manual Fallback (using placeholders)

const getEnvironmentConfig = () => {
  // 1. Preview Environment (Internal Use)
  if (typeof __firebase_config !== 'undefined') {
    return {
      firebaseConfig: JSON.parse(__firebase_config),
      appId: typeof __app_id !== 'undefined' ? __app_id : 'default-app-id',
      geminiKey: "" // Runtime injects key automatically if empty
    };
  }

  // 2. Standard Vite / Firebase App Hosting
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
        geminiKey: import.meta.env.VITE_GEMINI_API_KEY || ""
      };
    }
  } catch (e) {
    // Ignore error if import.meta is not available
  }

  // 3. Manual Fallback (For simple copy-paste deployment)
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
    geminiKey: "REPLACE_WITH_GEMINI_KEY"
  };
};

const { firebaseConfig, appId, geminiKey: initialGeminiKey } = getEnvironmentConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TRIVIA DATASETS (EXPANDED) ---
const CATEGORIES = {
  classics: [
    { title: "The Godfather Waltz", artist: "Nino Rota", movie: "The Godfather" },
    { title: "Tara's Theme", artist: "Max Steiner", movie: "Gone with the Wind" },
    { title: "As Time Goes By", artist: "Dooley Wilson", movie: "Casablanca" },
    { title: "Singin' in the Rain", artist: "Gene Kelly", movie: "Singin' in the Rain" },
    { title: "Psycho Prelude", artist: "Bernard Herrmann", movie: "Psycho" },
    { title: "Moon River", artist: "Henry Mancini", movie: "Breakfast at Tiffany's" },
    { title: "Over the Rainbow", artist: "Judy Garland", movie: "The Wizard of Oz" },
    { title: "The Sound of Music", artist: "Julie Andrews", movie: "The Sound of Music" },
    { title: "Lara's Theme", artist: "Maurice Jarre", movie: "Doctor Zhivago" },
    { title: "Lawrence of Arabia Theme", artist: "Maurice Jarre", movie: "Lawrence of Arabia" },
    { title: "Colonel Bogey March", artist: "Malcolm Arnold", movie: "The Bridge on the River Kwai" },
    { title: "The Good, the Bad and the Ugly", artist: "Ennio Morricone", movie: "The Good, the Bad and the Ugly" },
    { title: "Pink Panther Theme", artist: "Henry Mancini", movie: "The Pink Panther" },
    { title: "Theme from Shaft", artist: "Isaac Hayes", movie: "Shaft" },
    { title: "Stayin' Alive", artist: "Bee Gees", movie: "Saturday Night Fever" },
    { title: "Gonna Fly Now", artist: "Bill Conti", movie: "Rocky" },
    { title: "Love Story Theme", artist: "Francis Lai", movie: "Love Story" },
    { title: "Raindrops Keep Fallin' on My Head", artist: "B.J. Thomas", movie: "Butch Cassidy and the Sundance Kid" },
    { title: "Mrs. Robinson", artist: "Simon & Garfunkel", movie: "The Graduate" },
    { title: "Everybody's Talkin'", artist: "Harry Nilsson", movie: "Midnight Cowboy" },
    { title: "Windmills of Your Mind", artist: "Noel Harrison", movie: "The Thomas Crown Affair" },
    { title: "Goldfinger", artist: "Shirley Bassey", movie: "Goldfinger" },
    { title: "Speak Softly Love", artist: "Nino Rota", movie: "The Godfather" },
    { title: "Cabaret", artist: "Liza Minnelli", movie: "Cabaret" },
    { title: "The Entertainer", artist: "Scott Joplin", movie: "The Sting" },
    { title: "Tubular Bells", artist: "Mike Oldfield", movie: "The Exorcist" },
    { title: "Duelling Banjos", artist: "Eric Weissberg", movie: "Deliverance" },
    { title: "Knockin' on Heaven's Door", artist: "Bob Dylan", movie: "Pat Garrett and Billy the Kid" },
    { title: "Suicide Is Painless", artist: "Johnny Mandel", movie: "M*A*S*H" },
    { title: "Theme from Love Story", artist: "Francis Lai", movie: "Love Story" },
    { title: "A Time for Us", artist: "Nino Rota", movie: "Romeo and Juliet" },
    { title: "Chariots of Fire", artist: "Vangelis", movie: "Chariots of Fire" },
    { title: "Don't You (Forget About Me)", artist: "Simple Minds", movie: "The Breakfast Club" },
    { title: "Take My Breath Away", artist: "Berlin", movie: "Top Gun" },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky III" },
    { title: "Footloose", artist: "Kenny Loggins", movie: "Footloose" },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters" },
    { title: "The Power of Love", artist: "Huey Lewis and the News", movie: "Back to the Future" },
    { title: "Flashdance... What a Feeling", artist: "Irene Cara", movie: "Flashdance" },
    { title: "Time of My Life", artist: "Bill Medley", movie: "Dirty Dancing" },
    { title: "Unchained Melody", artist: "Righteous Brothers", movie: "Ghost" },
    { title: "My Heart Will Go On", artist: "Celine Dion", movie: "Titanic" },
    { title: "I Will Always Love You", artist: "Whitney Houston", movie: "The Bodyguard" },
    { title: "Streets of Philadelphia", artist: "Bruce Springsteen", movie: "Philadelphia" },
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King" },
    { title: "Gangsta's Paradise", artist: "Coolio", movie: "Dangerous Minds" },
    { title: "Lose Yourself", artist: "Eminem", movie: "8 Mile" },
    { title: "Jai Ho", artist: "A.R. Rahman", movie: "Slumdog Millionaire" },
    { title: "Skyfall", artist: "Adele", movie: "Skyfall" },
    { title: "Shallow", artist: "Lady Gaga", movie: "A Star Is Born" }
  ],
  scifi: [
    { title: "Main Title", artist: "John Williams", movie: "Star Wars: A New Hope" },
    { title: "The Imperial March", artist: "John Williams", movie: "Star Wars: The Empire Strikes Back" },
    { title: "Duel of the Fates", artist: "John Williams", movie: "Star Wars: The Phantom Menace" },
    { title: "Blade Runner Blues", artist: "Vangelis", movie: "Blade Runner" },
    { title: "Cornfield Chase", artist: "Hans Zimmer", movie: "Interstellar" },
    { title: "Also Sprach Zarathustra", artist: "Richard Strauss", movie: "2001: A Space Odyssey" },
    { title: "The Matrix Is Real", artist: "Don Davis", movie: "The Matrix" },
    { title: "Terminator Theme", artist: "Brad Fiedel", movie: "The Terminator" },
    { title: "Flying Theme", artist: "John Williams", movie: "E.T. the Extra-Terrestrial" },
    { title: "Theme from Jurassic Park", artist: "John Williams", movie: "Jurassic Park" },
    { title: "Back to the Future", artist: "Alan Silvestri", movie: "Back to the Future" },
    { title: "End Titles", artist: "Vangelis", movie: "Blade Runner" },
    { title: "Avatar Suite", artist: "James Horner", movie: "Avatar" },
    { title: "Time", artist: "Hans Zimmer", movie: "Inception" },
    { title: "No Time for Caution", artist: "Hans Zimmer", movie: "Interstellar" },
    { title: "Dream Is Collapsing", artist: "Hans Zimmer", movie: "Inception" },
    { title: "Star Trek Main Title", artist: "Jerry Goldsmith", movie: "Star Trek: The Motion Picture" },
    { title: "Into Darkness", artist: "Michael Giacchino", movie: "Star Trek Into Darkness" },
    { title: "The Shape of Water", artist: "Alexandre Desplat", movie: "The Shape of Water" },
    { title: "Arrival", artist: "Johann Johannsson", movie: "Arrival" },
    { title: "Gravity", artist: "Steven Price", movie: "Gravity" },
    { title: "Solaris", artist: "Cliff Martinez", movie: "Solaris" },
    { title: "Tron Legacy (End Titles)", artist: "Daft Punk", movie: "Tron: Legacy" },
    { title: "Derezzed", artist: "Daft Punk", movie: "Tron: Legacy" },
    { title: "Pacific Rim", artist: "Ramin Djawadi", movie: "Pacific Rim" },
    { title: "Mad Max: Fury Road", artist: "Junkie XL", movie: "Mad Max: Fury Road" },
    { title: "Dune", artist: "Hans Zimmer", movie: "Dune" },
    { title: "Paul's Dream", artist: "Hans Zimmer", movie: "Dune" },
    { title: "The Batman", artist: "Michael Giacchino", movie: "The Batman" },
    { title: "Wakanda", artist: "Ludwig Göransson", movie: "Black Panther" },
    { title: "Portals", artist: "Alan Silvestri", movie: "Avengers: Endgame" },
    { title: "The Avengers", artist: "Alan Silvestri", movie: "The Avengers" },
    { title: "Iron Man", artist: "Ramin Djawadi", movie: "Iron Man" },
    { title: "Spider-Man Main Title", artist: "Danny Elfman", movie: "Spider-Man" },
    { title: "Wonder Woman's Wrath", artist: "Rupert Gregson-Williams", movie: "Wonder Woman" },
    { title: "Man of Steel", artist: "Hans Zimmer", movie: "Man of Steel" },
    { title: "Guardians of the Galaxy", artist: "Tyler Bates", movie: "Guardians of the Galaxy" },
    { title: "Hooked on a Feeling", artist: "Blue Swede", movie: "Guardians of the Galaxy" },
    { title: "Come and Get Your Love", artist: "Redbone", movie: "Guardians of the Galaxy" },
    { title: "Mr. Blue Sky", artist: "Electric Light Orchestra", movie: "Guardians of the Galaxy Vol. 2" },
    { title: "Immigrant Song", artist: "Led Zeppelin", movie: "Thor: Ragnarok" },
    { title: "Black Widow", artist: "Lorne Balfe", movie: "Black Widow" },
    { title: "Doctor Strange", artist: "Michael Giacchino", movie: "Doctor Strange" },
    { title: "Ant-Man Theme", artist: "Christophe Beck", movie: "Ant-Man" },
    { title: "Captain America", artist: "Alan Silvestri", movie: "Captain America: The First Avenger" },
    { title: "Winter Soldier", artist: "Henry Jackman", movie: "Captain America: The Winter Soldier" },
    { title: "X-Men Theme", artist: "Michael Kamen", movie: "X-Men" },
    { title: "Logan", artist: "Marco Beltrami", movie: "Logan" },
    { title: "Deadpool Rap", artist: "Teamheadkick", movie: "Deadpool" },
    { title: "Venom", artist: "Eminem", movie: "Venom" }
  ],
  action: [
    { title: "He's a Pirate", artist: "Klaus Badelt", movie: "Pirates of the Caribbean: The Curse of the Black Pearl" },
    { title: "Theme from Mission: Impossible", artist: "Lalo Schifrin", movie: "Mission: Impossible" },
    { title: "Raiders March", artist: "John Williams", movie: "Indiana Jones and the Raiders of the Lost Ark" },
    { title: "James Bond Theme", artist: "Monty Norman", movie: "Dr. No" },
    { title: "Gladiator Theme", artist: "Hans Zimmer", movie: "Gladiator" },
    { title: "Now We Are Free", artist: "Hans Zimmer", movie: "Gladiator" },
    { title: "Mombasa", artist: "Hans Zimmer", movie: "Inception" },
    { title: "The Dark Knight", artist: "Hans Zimmer", movie: "The Dark Knight" },
    { title: "Molossus", artist: "Hans Zimmer", movie: "Batman Begins" },
    { title: "Why So Serious?", artist: "Hans Zimmer", movie: "The Dark Knight" },
    { title: "Braveheart Theme", artist: "James Horner", movie: "Braveheart" },
    { title: "Last of the Mohicans", artist: "Trevor Jones", movie: "The Last of the Mohicans" },
    { title: "Top Gun Anthem", artist: "Harold Faltermeyer", movie: "Top Gun" },
    { title: "Danger Zone", artist: "Kenny Loggins", movie: "Top Gun" },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky III" },
    { title: "Gonna Fly Now", artist: "Bill Conti", movie: "Rocky" },
    { title: "Training Montage", artist: "Vince DiCola", movie: "Rocky IV" },
    { title: "Conan the Barbarian", artist: "Basil Poledouris", movie: "Conan the Barbarian" },
    { title: "Robocop Theme", artist: "Basil Poledouris", movie: "RoboCop" },
    { title: "Predator Theme", artist: "Alan Silvestri", movie: "Predator" },
    { title: "Die Hard", artist: "Michael Kamen", movie: "Die Hard" },
    { title: "Lethal Weapon", artist: "Michael Kamen", movie: "Lethal Weapon" },
    { title: "Speed Title", artist: "Mark Mancina", movie: "Speed" },
    { title: "The Rock", artist: "Hans Zimmer", movie: "The Rock" },
    { title: "Face/Off", artist: "John Powell", movie: "Face/Off" },
    { title: "Con Air", artist: "Mark Mancina", movie: "Con Air" },
    { title: "Armageddon", artist: "Trevor Rabin", movie: "Armageddon" },
    { title: "Independence Day", artist: "David Arnold", movie: "Independence Day" },
    { title: "Air Force One", artist: "Jerry Goldsmith", movie: "Air Force One" },
    { title: "The Mummy", artist: "Jerry Goldsmith", movie: "The Mummy" },
    { title: "National Treasure", artist: "Trevor Rabin", movie: "National Treasure" },
    { title: "Bourne Identity", artist: "John Powell", movie: "The Bourne Identity" },
    { title: "Extreme Ways", artist: "Moby", movie: "The Bourne Identity" },
    { title: "Casino Royale", artist: "David Arnold", movie: "Casino Royale" },
    { title: "You Know My Name", artist: "Chris Cornell", movie: "Casino Royale" },
    { title: "Skyfall", artist: "Adele", movie: "Skyfall" },
    { title: "No Time To Die", artist: "Billie Eilish", movie: "No Time to Die" },
    { title: "Writing's on the Wall", artist: "Sam Smith", movie: "Spectre" },
    { title: "John Wick Mode", artist: "Le Castle Vania", movie: "John Wick" },
    { title: "Kill Bill", artist: "Tomoyasu Hotei", movie: "Kill Bill: Vol. 1" },
    { title: "Bang Bang", artist: "Nancy Sinatra", movie: "Kill Bill: Vol. 1" },
    { title: "Misirlou", artist: "Dick Dale", movie: "Pulp Fiction" },
    { title: "Mad Max Fury Road", artist: "Junkie XL", movie: "Mad Max: Fury Road" },
    { title: "Brothers in Arms", artist: "Junkie XL", movie: "Mad Max: Fury Road" },
    { title: "Wonder Woman", artist: "Hans Zimmer", movie: "Batman v Superman" },
    { title: "300", artist: "Tyler Bates", movie: "300" },
    { title: "Troy", artist: "James Horner", movie: "Troy" },
    { title: "Kingdom of Heaven", artist: "Harry Gregson-Williams", movie: "Kingdom of Heaven" },
    { title: "King Arthur", artist: "Hans Zimmer", movie: "King Arthur" },
    { title: "Rush Hour", artist: "Lalo Schifrin", movie: "Rush Hour" }
  ],
  animation: [
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King" },
    { title: "Under the Sea", artist: "Samuel E. Wright", movie: "The Little Mermaid" },
    { title: "Part of Your World", artist: "Jodi Benson", movie: "The Little Mermaid" },
    { title: "Beauty and the Beast", artist: "Angela Lansbury", movie: "Beauty and the Beast" },
    { title: "Be Our Guest", artist: "Jerry Orbach", movie: "Beauty and the Beast" },
    { title: "A Whole New World", artist: "Brad Kane", movie: "Aladdin" },
    { title: "Friend Like Me", artist: "Robin Williams", movie: "Aladdin" },
    { title: "Colors of the Wind", artist: "Judy Kuhn", movie: "Pocahontas" },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story" },
    { title: "When She Loved Me", artist: "Sarah McLachlan", movie: "Toy Story 2" },
    { title: "Hakuna Matata", artist: "Nathan Lane", movie: "The Lion King" },
    { title: "Can You Feel the Love Tonight", artist: "Elton John", movie: "The Lion King" },
    { title: "Reflection", artist: "Lea Salonga", movie: "Mulan" },
    { title: "I'll Make a Man Out of You", artist: "Donny Osmond", movie: "Mulan" },
    { title: "Go the Distance", artist: "Roger Bart", movie: "Hercules" },
    { title: "You'll Be in My Heart", artist: "Phil Collins", movie: "Tarzan" },
    { title: "Let It Go", artist: "Idina Menzel", movie: "Frozen" },
    { title: "Do You Want to Build a Snowman?", artist: "Kristen Bell", movie: "Frozen" },
    { title: "Into the Unknown", artist: "Idina Menzel", movie: "Frozen II" },
    { title: "How Far I'll Go", artist: "Auli'i Cravalho", movie: "Moana" },
    { title: "You're Welcome", artist: "Dwayne Johnson", movie: "Moana" },
    { title: "Remember Me", artist: "Benjamin Bratt", movie: "Coco" },
    { title: "Un Poco Loco", artist: "Anthony Gonzalez", movie: "Coco" },
    { title: "We Don't Talk About Bruno", artist: "Carolina Gaitan", movie: "Encanto" },
    { title: "Surface Pressure", artist: "Jessica Darrow", movie: "Encanto" },
    { title: "The Bare Necessities", artist: "Phil Harris", movie: "The Jungle Book" },
    { title: "I Wan'na Be Like You", artist: "Louis Prima", movie: "The Jungle Book" },
    { title: "Cruella De Vil", artist: "Bill Lee", movie: "101 Dalmatians" },
    { title: "Bella Notte", artist: "George Givot", movie: "Lady and the Tramp" },
    { title: "Once Upon a Dream", artist: "Mary Costa", movie: "Sleeping Beauty" },
    { title: "Bibbidi-Bobbidi-Boo", artist: "Verna Felton", movie: "Cinderella" },
    { title: "When You Wish Upon a Star", artist: "Cliff Edwards", movie: "Pinocchio" },
    { title: "Whistle While You Work", artist: "Adriana Caselotti", movie: "Snow White and the Seven Dwarfs" },
    { title: "Heigh-Ho", artist: "The Dwarfs", movie: "Snow White and the Seven Dwarfs" },
    { title: "Married Life", artist: "Michael Giacchino", movie: "Up" },
    { title: "Touch the Sky", artist: "Julie Fowlis", movie: "Brave" },
    { title: "Le Festin", artist: "Camille", movie: "Ratatouille" },
    { title: "Nemo Egg", artist: "Thomas Newman", movie: "Finding Nemo" },
    { title: "The Incredibles", artist: "Michael Giacchino", movie: "The Incredibles" },
    { title: "Monsters, Inc.", artist: "Randy Newman", movie: "Monsters, Inc." },
    { title: "If I Didn't Have You", artist: "Billy Crystal", movie: "Monsters, Inc." },
    { title: "Life is a Highway", artist: "Rascal Flatts", movie: "Cars" },
    { title: "Real Gone", artist: "Sheryl Crow", movie: "Cars" },
    { title: "Accidentally in Love", artist: "Counting Crows", movie: "Shrek 2" },
    { title: "I'm a Believer", artist: "Smash Mouth", movie: "Shrek" },
    { title: "All Star", artist: "Smash Mouth", movie: "Shrek" },
    { title: "Everything Is Awesome", artist: "Tegan and Sara", movie: "The Lego Movie" },
    { title: "Spider-Man", artist: "Paul Francis Webster", movie: "Spider-Man: Into the Spider-Verse" },
    { title: "Sunflower", artist: "Post Malone", movie: "Spider-Man: Into the Spider-Verse" },
    { title: "What's Up Danger", artist: "Blackway", movie: "Spider-Man: Into the Spider-Verse" }
  ],
  horror: [
    { title: "Halloween Theme", artist: "John Carpenter", movie: "Halloween" },
    { title: "Tubular Bells", artist: "Mike Oldfield", movie: "The Exorcist" },
    { title: "Psycho Prelude", artist: "Bernard Herrmann", movie: "Psycho" },
    { title: "Jaws Theme", artist: "John Williams", movie: "Jaws" },
    { title: "Ave Satani", artist: "Jerry Goldsmith", movie: "The Omen" },
    { title: "Suspiria", artist: "Goblin", movie: "Suspiria" },
    { title: "Rosemary's Baby", artist: "Krzysztof Komeda", movie: "Rosemary's Baby" },
    { title: "The Shining Theme", artist: "Wendy Carlos", movie: "The Shining" },
    { title: "A Nightmare on Elm Street", artist: "Charles Bernstein", movie: "A Nightmare on Elm Street" },
    { title: "Friday the 13th", artist: "Harry Manfredini", movie: "Friday the 13th" },
    { title: "Hello Zepp", artist: "Charlie Clouser", movie: "Saw" },
    { title: "Candyman", artist: "Philip Glass", movie: "Candyman" },
    { title: "Hellraiser", artist: "Christopher Young", movie: "Hellraiser" },
    { title: "Phantasm", artist: "Fred Myrow", movie: "Phantasm" },
    { title: "The Fog", artist: "John Carpenter", movie: "The Fog" },
    { title: "The Thing", artist: "Ennio Morricone", movie: "The Thing" },
    { title: "Escape from New York", artist: "John Carpenter", movie: "Escape from New York" },
    { title: "Assault on Precinct 13", artist: "John Carpenter", movie: "Assault on Precinct 13" },
    { title: "In the Mouth of Madness", artist: "John Carpenter", movie: "In the Mouth of Madness" },
    { title: "Prince of Darkness", artist: "John Carpenter", movie: "Prince of Darkness" },
    { title: "Village of the Damned", artist: "John Carpenter", movie: "Village of the Damned" },
    { title: "Christine", artist: "John Carpenter", movie: "Christine" },
    { title: "Pet Sematary", artist: "Ramones", movie: "Pet Sematary" },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters" },
    { title: "Beetlejuice", artist: "Danny Elfman", movie: "Beetlejuice" },
    { title: "Tales from the Crypt", artist: "Danny Elfman", movie: "Tales from the Crypt" },
    { title: "The X-Files", artist: "Mark Snow", movie: "The X-Files" },
    { title: "Twin Peaks", artist: "Angelo Badalamenti", movie: "Twin Peaks" },
    { title: "Stranger Things", artist: "Kyle Dixon", movie: "Stranger Things" },
    { title: "It Follows", artist: "Disasterpeace", movie: "It Follows" },
    { title: "Hereditary", artist: "Colin Stetson", movie: "Hereditary" },
    { title: "Midsommar", artist: "Bobby Krlic", movie: "Midsommar" },
    { title: "The Witch", artist: "Mark Korven", movie: "The Witch" },
    { title: "Us", artist: "Michael Abels", movie: "Us" },
    { title: "Get Out", artist: "Michael Abels", movie: "Get Out" },
    { title: "Nope", artist: "Michael Abels", movie: "Nope" },
    { title: "A Quiet Place", artist: "Marco Beltrami", movie: "A Quiet Place" },
    { title: "Bird Box", artist: "Trent Reznor", movie: "Bird Box" },
    { title: "28 Days Later", artist: "John Murphy", movie: "28 Days Later" },
    { title: "In the House - In a Heartbeat", artist: "John Murphy", movie: "28 Days Later" },
    { title: "Resident Evil", artist: "Marilyn Manson", movie: "Resident Evil" },
    { title: "Silent Hill", artist: "Akira Yamaoka", movie: "Silent Hill" },
    { title: "The Ring", artist: "Hans Zimmer", movie: "The Ring" },
    { title: "The Grudge", artist: "Christopher Young", movie: "The Grudge" },
    { title: "Insidious", artist: "Joseph Bishara", movie: "Insidious" },
    { title: "Sinister", artist: "Christopher Young", movie: "Sinister" },
    { title: "The Conjuring", artist: "Joseph Bishara", movie: "The Conjuring" },
    { title: "Annabelle", artist: "Joseph Bishara", movie: "Annabelle" },
    { title: "The Nun", artist: "Abel Korzeniowski", movie: "The Nun" },
    { title: "Scream", artist: "Marco Beltrami", movie: "Scream" }
  ]
};

// --- UTILS ---
const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Gemini Answer Verification
const verifyAnswerWithGemini = async (userAnswer, correctMovie, apiKey) => {
  // STRICT MODE: Fail if no key is present
  if (!apiKey || apiKey === "") {
      return { score: 0, reason: "Error: No API Key provided. Cannot verify." };
  }
  
  const prompt = `
    I am a trivia game judge.
    The correct movie answer is: "${correctMovie}".
    The player guessed: "${userAnswer}".
    
    Rules:
    1. If the guess is the exact movie or a very widely accepted distinct title (e.g. "Empire Strikes Back" for "Star Wars: Episode V - The Empire Strikes Back"), award 100 points.
    2. If the guess is the correct franchise but not the specific movie (e.g. "Star Wars" for "Phantom Menace" or "Harry Potter" for "Goblet of Fire"), award 50 points.
    3. If the guess is wrong, award 0 points.
    
    Return ONLY a raw JSON object: {"score": number, "reason": "short explanation"}
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
    
    if (!response.ok) {
        // Return the specific API error so the user knows what went wrong
        return { score: 0, reason: `API Error ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    
    // Ensure result is an object with a score
    if (typeof result !== 'object' || typeof result.score !== 'number') {
        return { score: 0, reason: "AI verification failed: Invalid response format" };
    }
    
    return result;
  } catch (e) {
    console.error("Gemini Verification Error", e);
    return { score: 0, reason: `Verification Exception: ${e.message}` };
  }
};

// Search iTunes for Preview URL
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

// --- COMPONENTS ---

// 1. LANDING SCREEN
const Landing = ({ setMode, joinGame, startDebug }) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 text-center max-w-md w-full">
        <div className="mb-8 flex justify-center">
          <div className="bg-gradient-to-tr from-purple-500 to-blue-500 p-4 rounded-2xl shadow-2xl">
            <Music size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-5xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          CineScore
        </h1>
        <p className="text-slate-400 mb-8 text-lg">The Ultimate Soundtrack Trivia</p>

        <div className="space-y-4">
          <button 
            onClick={() => setMode('host')}
            className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
          >
            Host a New Game
          </button>
          
          <button 
            onClick={startDebug}
            className="w-full py-3 bg-amber-900/30 text-amber-500 border border-amber-500/50 rounded-xl font-bold text-sm hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-2"
          >
             <Bug size={18}/> DEBUG MODE (Local Test)
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-500">OR JOIN EXISTING</span></div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-3">
            <input 
              type="text" 
              placeholder="YOUR NAME"
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="GAME CODE (e.g. ABCD)"
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded-lg text-white font-semibold focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:text-slate-600"
              maxLength={4}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
            />
            <button 
              disabled={!name || code.length !== 4}
              onClick={() => joinGame(code, name)}
              className="w-full py-3 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold hover:bg-blue-500 transition-colors"
            >
              Enter Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. HOST SCREEN
const HostView = ({ gameId, user }) => {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [spotifyToken, setSpotifyToken] = useState("");
  const [category, setCategory] = useState("classics");
  const [audioPreview, setAudioPreview] = useState(null);
  const [showSettings, setShowSettings] = useState(true);
  const audioRef = useRef(null);
  const [verification, setVerification] = useState(null);

  // Load Game
  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (docSnap) => {
      if (docSnap.exists()) setGame(docSnap.data());
    });
    // Load Players subcollection (simulated with top-level field for simplicity in this demo, but let's use a subcollection for robustness)
    const unsubPlayers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players'), (snap) => {
      const pList = [];
      snap.forEach(d => pList.push({id: d.id, ...d.data()}));
      setPlayers(pList.sort((a,b) => b.score - a.score));
    });
    return () => { unsubGame(); unsubPlayers(); };
  }, [gameId]);

  // Audio Player Effect
  useEffect(() => {
    if (audioRef.current) {
      if (game?.status === 'playing' && game?.currentSong?.previewUrl && !game?.buzzerWinner) {
        audioRef.current.src = game.currentSong.previewUrl;
        audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
      } else if (game?.buzzerWinner || game?.status === 'revealed') {
        audioRef.current.pause();
      }
    }
  }, [game?.currentSong, game?.status, game?.buzzerWinner]);

  // Gemini Verification Effect
  useEffect(() => {
    if (game?.currentAnswer && !game?.answerVerified && !verification) {
      const verify = async () => {
        setVerification({ status: 'checking' });
        
        const apiKey = initialGeminiKey; // Runtime environment will inject key if configured, otherwise user receives error
        const res = await verifyAnswerWithGemini(game.currentAnswer, game.currentSong.movie, apiKey); 
        
        setVerification(res);
        
        // Update Game with result
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', game.buzzerWinner.uid);
        
        // Ensure score is defined before transaction
        const scoreToAdd = (typeof res.score === 'number') ? res.score : 0;

        await runTransaction(db, async (transaction) => {
           transaction.update(gameRef, { 
             answerVerified: true,
             lastRoundScore: scoreToAdd,
             status: 'revealed'
           });
           if (scoreToAdd > 0) {
             transaction.update(playerRef, { score: increment(scoreToAdd) });
           }
        });
      };
      verify();
    }
  }, [game?.currentAnswer, game?.answerVerified]);


  const startGame = async () => {
    setShowSettings(false);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'playing',
      round: 0
    });
    nextRound();
  };

  const nextRound = async () => {
    setVerification(null);
    const trackData = CATEGORIES[category][Math.floor(Math.random() * CATEGORIES[category].length)];
    
    // Fetch audio url
    let previewUrl = null;
    let coverArt = null;

    if (spotifyToken) {
       // Advanced: Control Spotify Device (omitted for brevity, requires complex device ID handling)
       // For this demo, we'll assume iTunes fallback unless we built a full Spotify Player 
    } 
    
    // Always fallback to iTunes for the audio source if not fully integrated
    const itunesData = await searchItunes(`${trackData.title} ${trackData.artist} soundtrack`);
    previewUrl = itunesData?.previewUrl;
    coverArt = itunesData?.artworkUrl100?.replace('100x100', '600x600');

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentSong: {
        ...trackData,
        previewUrl,
        coverArt
      },
      buzzerWinner: null,
      currentAnswer: null,
      answerVerified: false,
      status: 'playing',
      round: increment(1)
    });
  };

  const giveUp = async () => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
       status: 'revealed',
       lastRoundScore: 0,
       buzzerWinner: null // No winner
     });
  };

  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6">Game Setup</h2>
        <div className="bg-slate-800 p-6 rounded-xl max-w-lg w-full space-y-6 border border-slate-700">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">GAME CODE</label>
            <div className="text-4xl font-mono font-black text-center bg-black/30 p-4 rounded-lg tracking-widest text-blue-400">
              {gameId}
            </div>
          </div>
          
          <div>
             <label className="block text-sm font-bold mb-2 text-slate-400">CATEGORY</label>
             <div className="grid grid-cols-3 gap-2">
               {Object.keys(CATEGORIES).map(c => (
                 <button 
                   key={c}
                   onClick={() => setCategory(c)}
                   className={`p-2 rounded capitalize font-bold text-xs md:text-sm ${category === c ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                 >
                   {c}
                 </button>
               ))}
             </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">SPOTIFY TOKEN (Optional)</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-slate-300 mb-2"
              placeholder="Paste token for full playback control..."
              value={spotifyToken}
              onChange={(e) => setSpotifyToken(e.target.value)}
            />
            <p className="text-xs text-slate-500">Without a token, we use 30s previews from iTunes. Good for trivia!</p>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h3 className="font-bold mb-2 flex items-center gap-2"><Users size={18}/> Players Joined ({players.length})</h3>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {players.map(p => (
                <li key={p.id} className="text-sm bg-slate-700/50 px-2 py-1 rounded flex justify-between">
                  <span>{p.username}</span>
                  <span className="font-mono text-blue-300">{p.score}</span>
                </li>
              ))}
              {players.length === 0 && <li className="text-slate-500 italic text-sm">Waiting for players...</li>}
            </ul>
          </div>

          <button 
            onClick={startGame}
            disabled={players.length === 0}
            className="w-full py-4 bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-xl hover:scale-105 transition-transform"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
       <audio ref={audioRef} loop />
       
       {/* Top Bar */}
       <div className="bg-slate-900 p-4 shadow-lg flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-4">
             <div className="bg-blue-600 px-3 py-1 rounded font-bold text-sm">ROUND {game?.round}</div>
             <div className="text-slate-400 font-mono text-xl">{gameId}</div>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-xs text-slate-500 hover:text-white">Settings</button>
       </div>

       <div className="flex-1 flex flex-col md:flex-row">
          
          {/* Main Stage */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center relative">
             
             {/* Dynamic Background Art */}
             {game?.currentSong?.coverArt && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl transition-all duration-1000"
                  style={{ backgroundImage: `url(${game.currentSong.coverArt})`}}
                />
             )}

             <div className="z-10 w-full max-w-2xl text-center">
                
                {/* Status Indicator */}
                <div className="mb-8">
                   {game?.status === 'playing' && !game?.buzzerWinner && (
                     <div className="animate-pulse flex flex-col items-center text-blue-400">
                        <Volume2 size={64} className="mb-4" />
                        <h2 className="text-3xl font-bold">Listen Closely...</h2>
                     </div>
                   )}

                   {game?.buzzerWinner && game?.status !== 'revealed' && (
                     <div className="flex flex-col items-center text-yellow-400 animate-bounce-short">
                        <AlertCircle size={64} className="mb-4" />
                        <h2 className="text-4xl font-black">{game.buzzerWinner.username} BUZZED!</h2>
                        <p className="text-white mt-2 text-lg">Waiting for answer...</p>
                        {game.currentAnswer && <p className="mt-4 bg-slate-800 px-4 py-2 rounded">Processing: "{game.currentAnswer}"</p>}
                     </div>
                   )}

                   {game?.status === 'revealed' && (
                     <div className="bg-slate-900/90 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm">
                        <div className="mb-6">
                           <img src={game.currentSong.coverArt} className="w-48 h-48 object-cover rounded mx-auto shadow-lg mb-4" />
                           <h2 className="text-2xl font-bold text-white">{game.currentSong.movie}</h2>
                           <p className="text-blue-400 text-lg">{game.currentSong.title}</p>
                           <p className="text-slate-500">{game.currentSong.artist}</p>
                        </div>
                        
                        <div className={`p-4 rounded-xl font-bold text-xl mb-6 ${game.lastRoundScore > 0 ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-red-600/20 text-red-400 border border-red-600/50'}`}>
                           {game.lastRoundScore > 0 
                             ? `+${game.lastRoundScore} Points to ${game.buzzerWinner?.username || 'Winner'}` 
                             : (game.buzzerWinner ? `${game.buzzerWinner.username} Missed It!` : "Time's Up!")}
                        </div>
                        {/* Display error reason if score is 0 and there's an error message */}
                        {game.lastRoundScore === 0 && verification?.reason && verification.reason.includes("Error") && (
                            <p className="text-red-300 text-sm mb-4 bg-red-900/50 p-2 rounded">{verification.reason}</p>
                        )}

                        <button 
                          onClick={nextRound}
                          className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-110 transition-transform flex items-center gap-2 mx-auto"
                        >
                          Next Round <SkipForward size={20}/>
                        </button>
                     </div>
                   )}
                </div>
                
                {/* Control Panel for Host if Stuck */}
                {game?.status === 'playing' && !game?.buzzerWinner && (
                  <button 
                    onClick={giveUp}
                    className="mt-12 text-slate-500 hover:text-white text-sm underline"
                  >
                    Reveal Answer (Skip)
                  </button>
                )}
             </div>
          </div>

          {/* Leaderboard Sidebar */}
          <div className="w-full md:w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col">
             <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <Trophy className="text-yellow-500" /> Leaderboard
             </h3>
             <div className="space-y-3">
               {players.map((p, idx) => (
                 <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-transparent border border-yellow-600/30' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                       <span className={`font-mono font-bold w-6 text-center ${idx===0 ? 'text-yellow-500' : 'text-slate-500'}`}>#{idx+1}</span>
                       <span className="font-semibold">{p.username}</span>
                    </div>
                    <span className="font-bold text-blue-400">{p.score}</span>
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
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);

  useEffect(() => {
    // If running in debug/split mode, we need to be careful about not resetting state 
    // if the host component updates the game object.
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        // Only reset answer state if round changed significantly or we are in a fresh 'playing' state
        // We use a simple check: if we moved to playing and answer is still set from previous round
        if (data.status === 'playing' && !data.buzzerWinner && hasAnswered) {
           setAnswer("");
           setHasAnswered(false);
        }
        // Also reset if we just started fresh
        if (data.status === 'playing' && !data.buzzerWinner && answer !== "" && !hasAnswered) {
             setAnswer("");
        }
      }
    });
    return () => unsub();
  }, [gameId, hasAnswered]); // Add hasAnswered to dep to ensure we catch reset

  const buzzIn = async () => {
    if (!game || game.buzzerWinner || game.status !== 'playing') return;
    
    // Optimistic UI handled by Firestore transaction ideally, but simple update here
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    
    // We try to update. If someone else buzzed first, this condition won't match in a transaction
    // Simpler: runTransaction
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(gameRef);
      if (!sfDoc.exists()) return;
      
      const currentData = sfDoc.data();
      if (!currentData.buzzerWinner) {
        transaction.update(gameRef, { 
          buzzerWinner: { uid: user.uid, username: username },
          buzzerLocked: true 
        });
      }
    });
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setHasAnswered(true);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentAnswer: answer
    });
  };

  // -- RENDER STATES --

  // 1. Waiting for Round
  if (!game) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  // 2. Someone Else Buzzed
  const isMe = game.buzzerWinner?.uid === user.uid;
  
  if (game.buzzerWinner && !isMe && game.status !== 'revealed') {
    return (
      <div className="min-h-screen bg-red-900/20 flex flex-col items-center justify-center p-6 text-center">
         <div className="p-6 bg-red-600 rounded-full mb-6 animate-pulse">
           <Smartphone size={48} className="text-white"/>
         </div>
         <h1 className="text-3xl font-black text-white mb-2">{game.buzzerWinner.username} LOCKED IN!</h1>
         <p className="text-red-200">Wait for the next song...</p>
      </div>
    );
  }

  // 3. I Buzzed! Input time.
  if (isMe && game.status !== 'revealed') {
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-black text-white mb-8 animate-bounce">YOU'RE UP!</h1>
        <div className="w-full max-w-sm space-y-4">
           {!hasAnswered ? (
             <>
               <input 
                 autoFocus
                 className="w-full p-4 rounded-xl text-black text-xl font-bold text-center uppercase"
                 placeholder="MOVIE TITLE?"
                 value={answer}
                 onChange={e => setAnswer(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submitAnswer()}
               />
               <div className="flex gap-2">
                 <button 
                  onClick={submitAnswer}
                  className="flex-1 bg-white text-green-900 py-4 rounded-xl font-black text-xl shadow-xl active:scale-95 transition-transform"
                 >
                   SUBMIT
                 </button>
                 {/* Mic Button simulation */}
                 <button className="bg-green-800 text-white p-4 rounded-xl">
                   <Mic />
                 </button>
               </div>
             </>
           ) : (
             <div className="text-white text-center text-xl font-bold animate-pulse">
               Judging...
             </div>
           )}
        </div>
      </div>
    );
  }

  // 4. Reveal / Result
  if (game.status === 'revealed') {
    const scoreText = game.lastRoundScore > 0 ? `+${game.lastRoundScore}` : "0";
    const winnerText = game.lastRoundScore > 0 ? "Correct!" : "Wrong!";
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
         <div className="mb-6 relative">
            <img src={game.currentSong.coverArt || "https://placehold.co/400x400/1e293b/ffffff?text=Soundtrack"} className="w-64 h-64 rounded-xl shadow-2xl" />
            <div className="absolute -bottom-4 -right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg font-bold">
               {game.lastRoundScore > 0 ? <Check size={24}/> : <X size={24}/>}
            </div>
         </div>
         <h2 className="text-2xl font-bold mb-1">{game.currentSong.movie}</h2>
         <p className="text-slate-400 mb-8">{game.currentSong.title}</p>
         
         {isMe && (
           <div className={`text-4xl font-black ${game.lastRoundScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
             {winnerText} ({scoreText})
           </div>
         )}
         {!isMe && game.buzzerWinner && (
            <div className="text-xl text-slate-500">
               {game.buzzerWinner.username} got {scoreText}
            </div>
         )}
      </div>
    );
  }

  // 5. Default Buzzer State
  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col">
       <div className="p-4 flex justify-between items-center text-slate-500 text-sm">
         <span>Room: {gameId}</span>
         <span>{username}</span>
       </div>
       
       <div className="flex-1 flex flex-col items-center justify-center relative">
          <button 
             onClick={buzzIn}
             className="w-72 h-72 rounded-full bg-red-600 border-b-8 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.5)] active:border-b-0 active:translate-y-2 active:shadow-none transition-all flex flex-col items-center justify-center group"
          >
             <span className="text-6xl font-black text-red-900 group-hover:text-red-100 transition-colors">BUZZ</span>
          </button>
          <p className="mt-8 text-slate-400 font-medium animate-pulse">Wait for the music...</p>
       </div>
    </div>
  );
};


// 4. MAIN APP CONTROLLER
export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // 'host' | 'player' | 'debug'
  const [gameId, setGameId] = useState(null);
  const [username, setUsername] = useState("");

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, u => setUser(u));
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

  const handleJoinGame = async (code, name) => {
    if (!user) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code);
    const snap = await getDoc(gameRef);
    
    if (snap.exists()) {
      // Add player to subcollection
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', code, 'players', user.uid);
      await setDoc(playerRef, {
        username: name,
        score: 0,
        joinedAt: new Date()
      });
      setGameId(code);
      setUsername(name);
      setMode('player');
    } else {
      alert("Game not found!");
    }
  };

  const startDebugMode = async () => {
    if (!user) return;
    const debugCode = "DEBUG";
    
    // 1. Reset Game State
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', debugCode), {
      hostId: user.uid,
      status: 'lobby',
      createdAt: new Date(),
      round: 0,
      buzzerWinner: null,
      scores: {},
      currentSong: null
    });

    // 2. Create Bots
    const bots = [
        { id: 'bot1', username: 'CineBot 3000', score: 150 },
        { id: 'bot2', username: 'SpielbergFan', score: 50 },
        { id: 'bot3', username: 'PopcornLover', score: 300 },
        { id: 'bot4', username: 'ZimmerStan', score: 0 },
    ];

    for (const bot of bots) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', debugCode, 'players', bot.id), bot);
    }

    // 3. Add Dev Player (You)
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', debugCode, 'players', user.uid), {
        username: "DEV_TESTER",
        score: 0,
        joinedAt: new Date()
    });

    setGameId(debugCode);
    setUsername("DEV_TESTER");
    setMode('debug');
  };

  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting to CineScore...</div>;

  if (mode === 'debug' && gameId) {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-black">
            <div className="w-1/2 border-r border-slate-700 relative flex flex-col">
                <div className="bg-amber-600 text-white text-xs font-bold px-2 py-1 text-center shadow-lg z-50">HOST VIEW (CONTROLS)</div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                   {/* Scale down slightly if needed to fit */}
                   <HostView gameId={gameId} user={user} />
                </div>
            </div>
            <div className="w-1/2 relative flex flex-col">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 text-center shadow-lg z-50">PLAYER VIEW (YOU)</div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative border-l border-slate-800">
                   <PlayerView gameId={gameId} user={user} username={username} />
                </div>
            </div>
        </div>
    );
  }

  if (mode === 'host' && gameId) return <HostView gameId={gameId} user={user} />;
  if (mode === 'player' && gameId) return <PlayerView gameId={gameId} user={user} username={username} />;

  // Initial State: user clicked "Host" but hasn't created game yet
  if (mode === 'host' && !gameId) {
    handleCreateGame(); // Auto create
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Creating Room...</div>;
  }

  return <Landing setMode={setMode} joinGame={handleJoinGame} startDebug={startDebugMode} />;
}