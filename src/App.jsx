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
  writeBatch
} from 'firebase/firestore';
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star, Clock, ArrowLeft, ArrowRight, PenTool } from 'lucide-react';

// --- CONFIGURATION & ENVIRONMENT SETUP ---
const getEnvironmentConfig = () => {
  // 1. Preview Environment (Internal Use)
  if (typeof __firebase_config !== 'undefined') {
    return {
      firebaseConfig: JSON.parse(__firebase_config),
      appId: typeof __app_id !== 'undefined' ? __app_id : 'default-app-id',
      geminiKey: "",
      tmdbAccessToken: "" // Preview env doesn't support TMDB
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
    geminiKey: "REPLACE_WITH_GEMINI_KEY",
    tmdbAccessToken: "REPLACE_WITH_TMDB_READ_ACCESS_TOKEN"
  };
};

const { firebaseConfig, appId, geminiKey: initialGeminiKey, tmdbAccessToken } = getEnvironmentConfig();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TRIVIA DATASETS ---
const CATEGORIES = {
  all_stars: [ // Target: Under 40 (Millennials/Gen Z iconic hits)
    { title: "Hedwig's Theme", artist: "John Williams", movie: "Harry Potter and the Sorcerer's Stone", year: 2001 },
    { title: "My Heart Will Go On", artist: "Celine Dion", movie: "Titanic", year: 1997 },
    { title: "All Star", artist: "Smash Mouth", movie: "Shrek", year: 2001 },
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King", year: 1994 },
    { title: "Let It Go", artist: "Idina Menzel", movie: "Frozen", year: 2013 },
    { title: "Lose Yourself", artist: "Eminem", movie: "8 Mile", year: 2002 },
    { title: "I Will Always Love You", artist: "Whitney Houston", movie: "The Bodyguard", year: 1992 },
    { title: "See You Again", artist: "Wiz Khalifa", movie: "Furious 7", year: 2015 },
    { title: "A Thousand Years", artist: "Christina Perri", movie: "Twilight", year: 2008 },
    { title: "Main Title", artist: "John Williams", movie: "Star Wars", year: 1977 },
    { title: "The Imperial March", artist: "John Williams", movie: "The Empire Strikes Back", year: 1980 },
    { title: "He's a Pirate", artist: "Klaus Badelt", movie: "Pirates of the Caribbean: The Curse of the Black Pearl", year: 2003 },
    { title: "Theme from Jurassic Park", artist: "John Williams", movie: "Jurassic Park", year: 1993 },
    { title: "The Avengers", artist: "Alan Silvestri", movie: "The Avengers", year: 2012 },
    { title: "Spider-Man Main Title", artist: "Danny Elfman", movie: "Spider-Man", year: 2002 },
    { title: "Sunflower", artist: "Post Malone", movie: "Spider-Man: Into the Spider-Verse", year: 2018 },
    { title: "Shallow", artist: "Lady Gaga", movie: "A Star Is Born", year: 2018 },
    { title: "Happy", artist: "Pharrell Williams", movie: "Despicable Me 2", year: 2013 },
    { title: "Can't Stop the Feeling!", artist: "Justin Timberlake", movie: "Trolls", year: 2016 },
    { title: "Everything Is Awesome", artist: "Tegan and Sara", movie: "The Lego Movie", year: 2014 },
    { title: "How Far I'll Go", artist: "Auli'i Cravalho", movie: "Moana", year: 2016 },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story", year: 1995 },
    { title: "Life is a Highway", artist: "Rascal Flatts", movie: "Cars", year: 2006 },
    { title: "I'm Just Ken", artist: "Ryan Gosling", movie: "Barbie", year: 2023 },
    { title: "Dance The Night", artist: "Dua Lipa", movie: "Barbie", year: 2023 },
    { title: "City of Stars", artist: "Ryan Gosling", movie: "La La Land", year: 2016 },
    { title: "The Greatest Show", artist: "Hugh Jackman", movie: "The Greatest Showman", year: 2017 },
    { title: "Rewrite The Stars", artist: "Zac Efron", movie: "The Greatest Showman", year: 2017 },
    { title: "Skyfall", artist: "Adele", movie: "Skyfall", year: 2012 },
    { title: "No Time To Die", artist: "Billie Eilish", movie: "No Time To Die", year: 2021 },
    { title: "Mission: Impossible", artist: "Lalo Schifrin", movie: "Mission: Impossible", year: 1996 },
    { title: "Cornfield Chase", artist: "Hans Zimmer", movie: "Interstellar", year: 2014 },
    { title: "Time", artist: "Hans Zimmer", movie: "Inception", year: 2010 },
    { title: "The Dark Knight Theme", artist: "Hans Zimmer", movie: "The Dark Knight", year: 2008 },
    { title: "Concerning Hobbits", artist: "Howard Shore", movie: "The Lord of the Rings: The Fellowship of the Ring", year: 2001 },
    { title: "The Fellowship of the Ring", artist: "Howard Shore", movie: "The Lord of the Rings: The Fellowship of the Ring", year: 2001 },
    { title: "Theme from Schindler's List", artist: "John Williams", movie: "Schindler's List", year: 1993 },
    { title: "Now We Are Free", artist: "Hans Zimmer", movie: "Gladiator", year: 2000 },
    { title: "I See You", artist: "Leona Lewis", movie: "Avatar", year: 2009 },
    { title: "Danger Zone", artist: "Kenny Loggins", movie: "Top Gun", year: 1986 },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky III", year: 1982 },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters", year: 1984 },
    { title: "Men in Black", artist: "Will Smith", movie: "Men in Black", year: 1997 },
    { title: "Gangsta's Paradise", artist: "Coolio", movie: "Dangerous Minds", year: 1995 },
    { title: "Kiss Me", artist: "Sixpence None The Richer", movie: "She's All That", year: 1999 },
    { title: "Don't You (Forget About Me)", artist: "Simple Minds", movie: "The Breakfast Club", year: 1985 },
    { title: "Footloose", artist: "Kenny Loggins", movie: "Footloose", year: 1984 },
    { title: "We Don't Talk About Bruno", artist: "Encanto Cast", movie: "Encanto", year: 2021 },
    { title: "Remember Me", artist: "Miguel", movie: "Coco", year: 2017 },
    { title: "Hakuna Matata", artist: "Nathan Lane", movie: "The Lion King", year: 1994 },
    { title: "Under the Sea", artist: "Samuel E. Wright", movie: "The Little Mermaid", year: 1989 },
    { title: "A Whole New World", artist: "Brad Kane", movie: "Aladdin", year: 1992 },
    { title: "Reflection", artist: "Lea Salonga", movie: "Mulan", year: 1998 },
    { title: "You'll Be in My Heart", artist: "Phil Collins", movie: "Tarzan", year: 1999 },
    { title: "Accidentally in Love", artist: "Counting Crows", movie: "Shrek 2", year: 2004 },
    { title: "Welcome to the Jungle", artist: "Guns N' Roses", movie: "Jumanji: Welcome to the Jungle", year: 2017 },
    { title: "Come and Get Your Love", artist: "Redbone", movie: "Guardians of the Galaxy", year: 2014 },
    { title: "Hooked on a Feeling", artist: "Blue Swede", movie: "Guardians of the Galaxy", year: 2014 },
    { title: "Mr. Blue Sky", artist: "Electric Light Orchestra", movie: "Guardians of the Galaxy Vol. 2", year: 2017 },
    { title: "Immigrant Song", artist: "Led Zeppelin", movie: "Thor: Ragnarok", year: 2017 },
    { title: "Black Widow", artist: "Lorne Balfe", movie: "Black Widow", year: 2021 },
    { title: "Portals", artist: "Alan Silvestri", movie: "Avengers: Endgame", year: 2019 },
    { title: "Wakanda", artist: "Ludwig Göransson", movie: "Black Panther", year: 2018 },
    { title: "Iron Man", artist: "Ramin Djawadi", movie: "Iron Man", year: 2008 },
    { title: "What's Up Danger", artist: "Blackway", movie: "Spider-Man: Into the Spider-Verse", year: 2018 },
    { title: "Calling", artist: "Metro Boomin", movie: "Spider-Man: Across the Spider-Verse", year: 2023 },
    { title: "Am I Dreaming", artist: "Metro Boomin", movie: "Spider-Man: Across the Spider-Verse", year: 2023 },
    { title: "Peaches", artist: "Jack Black", movie: "The Super Mario Bros. Movie", year: 2023 },
    { title: "Holding Out for a Hero", artist: "Bonnie Tyler", movie: "Shrek 2", year: 2004 },
    { title: "Funkytown", artist: "Lipps Inc.", movie: "Shrek 2", year: 2004 },
    { title: "Bad Reputation", artist: "Joan Jett", movie: "Shrek", year: 2001 },
    { title: "Hallelujah", artist: "Rufus Wainwright", movie: "Shrek", year: 2001 },
    { title: "Where You Are", artist: "Christopher Jackson", movie: "Moana", year: 2016 },
    { title: "Shiny", artist: "Jemaine Clement", movie: "Moana", year: 2016 },
    { title: "You're Welcome", artist: "Dwayne Johnson", movie: "Moana", year: 2016 },
    { title: "Into the Unknown", artist: "Idina Menzel", movie: "Frozen II", year: 2019 },
    { title: "Show Yourself", artist: "Idina Menzel", movie: "Frozen II", year: 2019 },
    { title: "Un Poco Loco", artist: "Anthony Gonzalez", movie: "Coco", year: 2017 },
    { title: "Surface Pressure", artist: "Jessica Darrow", movie: "Encanto", year: 2021 },
    { title: "Dos Oruguitas", artist: "Sebastián Yatra", movie: "Encanto", year: 2021 },
    { title: "Nobody Like U", artist: "4*TOWN", movie: "Turning Red", year: 2022 },
    { title: "Lead the Way", artist: "Jhené Aiko", movie: "Raya and the Last Dragon", year: 2021 },
    { title: "Speechless", artist: "Naomi Scott", movie: "Aladdin", year: 2019 },
    { title: "Spirit", artist: "Beyoncé", movie: "The Lion King", year: 2019 },
    { title: "Beauty and the Beast", artist: "Ariana Grande", movie: "Beauty and the Beast", year: 2017 },
    { title: "Evermore", artist: "Dan Stevens", movie: "Beauty and the Beast", year: 2017 },
    { title: "A Whole New World", artist: "Zayn", movie: "Aladdin", year: 2019 },
    { title: "Friend Like Me", artist: "Will Smith", movie: "Aladdin", year: 2019 },
    { title: "This Is Me", artist: "Keala Settle", movie: "The Greatest Showman", year: 2017 },
    { title: "The Other Side", artist: "Hugh Jackman", movie: "The Greatest Showman", year: 2017 },
    { title: "From Now On", artist: "Hugh Jackman", movie: "The Greatest Showman", year: 2017 },
    { title: "Never Enough", artist: "Loren Allred", movie: "The Greatest Showman", year: 2017 },
    { title: "Another Day of Sun", artist: "La La Land Cast", movie: "La La Land", year: 2016 },
    { title: "Audition (The Fools Who Dream)", artist: "Emma Stone", movie: "La La Land", year: 2016 },
    { title: "Falling Slowly", artist: "Glen Hansard", movie: "Once", year: 2007 },
    { title: "Jai Ho", artist: "A.R. Rahman", movie: "Slumdog Millionaire", year: 2008 },
    { title: "Paper Planes", artist: "M.I.A.", movie: "Slumdog Millionaire", year: 2008 },
    { title: "Young and Beautiful", artist: "Lana Del Rey", movie: "The Great Gatsby", year: 2013 },
    { title: "A Little Party Never Killed Nobody", artist: "Fergie", movie: "The Great Gatsby", year: 2013 },
    { title: "Crazy in Love", artist: "Beyoncé", movie: "Fifty Shades of Grey", year: 2015 },
    { title: "Love Me Like You Do", artist: "Ellie Goulding", movie: "Fifty Shades of Grey", year: 2015 },
    { title: "Earned It", artist: "The Weeknd", movie: "Fifty Shades of Grey", year: 2015 },
    { title: "I Don't Wanna Live Forever", artist: "ZAYN", movie: "Fifty Shades Darker", year: 2017 },
    { title: "For You", artist: "Liam Payne", movie: "Fifty Shades Freed", year: 2018 },
    { title: "Capital Letters", artist: "Hailee Steinfeld", movie: "Fifty Shades Freed", year: 2018 },
    { title: "Cups", artist: "Anna Kendrick", movie: "Pitch Perfect", year: 2012 },
    { title: "Flashlight", artist: "Jessie J", movie: "Pitch Perfect 2", year: 2015 },
    { title: "Can't Hold Us", artist: "Macklemore", movie: "Horrible Bosses", year: 2011 },
    { title: "21 Jump Street Main Theme", artist: "Mark Mothersbaugh", movie: "21 Jump Street", year: 2012 },
    { title: "Mona Lisa Overdrive", artist: "Don Davis", movie: "The Matrix Reloaded", year: 2003 },
    { title: "Clubbed to Death", artist: "Rob Dougan", movie: "The Matrix", year: 1999 },
    { title: "Spybreak!", artist: "Propellerheads", movie: "The Matrix", year: 1999 },
    { title: "Wake Up", artist: "Rage Against the Machine", movie: "The Matrix", year: 1999 },
    { title: "Test Drive", artist: "John Powell", movie: "How to Train Your Dragon", year: 2010 },
    { title: "Romantic Flight", artist: "John Powell", movie: "How to Train Your Dragon", year: 2010 },
    { title: "Forbidden Friendship", artist: "John Powell", movie: "How to Train Your Dragon", year: 2010 },
    { title: "This Is Berk", artist: "John Powell", movie: "How to Train Your Dragon", year: 2010 },
    { title: "Oogway Ascends", artist: "Hans Zimmer", movie: "Kung Fu Panda", year: 2008 },
    { title: "Kung Fu Fighting", artist: "CeeLo Green", movie: "Kung Fu Panda", year: 2008 },
    { title: "Fairytale", artist: "Harry Gregson-Williams", movie: "Shrek", year: 2001 },
    { title: "Transformation", artist: "The Bulgarian Women's Choir", movie: "Brother Bear", year: 2003 },
    { title: "On My Way", artist: "Phil Collins", movie: "Brother Bear", year: 2003 },
    { title: "Great Spirits", artist: "Tina Turner", movie: "Brother Bear", year: 2003 },
    { title: "Hawaiian Roller Coaster Ride", artist: "Kamehameha Schools Children's Chorus", movie: "Lilo & Stitch", year: 2002 },
    { title: "He Mele No Lilo", artist: "Mark Keali'i Ho'omalu", movie: "Lilo & Stitch", year: 2002 },
    { title: "Burning Love", artist: "Wynonna", movie: "Lilo & Stitch", year: 2002 },
    { title: "I'm Still Here", artist: "John Rzeznik", movie: "Treasure Planet", year: 2002 },
    { title: "Strangers Like Me", artist: "Phil Collins", movie: "Tarzan", year: 1999 },
    { title: "Two Worlds", artist: "Phil Collins", movie: "Tarzan", year: 1999 },
    { title: "Son of Man", artist: "Phil Collins", movie: "Tarzan", year: 1999 }
  ],
  classics: [ // Target: Ages 40-70 (Golden Era, 70s, 80s hits)
    { title: "The Godfather Waltz", artist: "Nino Rota", movie: "The Godfather", year: 1972 },
    { title: "Tara's Theme", artist: "Max Steiner", movie: "Gone with the Wind", year: 1939 },
    { title: "Over the Rainbow", artist: "Judy Garland", movie: "The Wizard of Oz", year: 1939 },
    { title: "Singin' in the Rain", artist: "Gene Kelly", movie: "Singin' in the Rain", year: 1952 },
    { title: "As Time Goes By", artist: "Dooley Wilson", movie: "Casablanca", year: 1942 },
    { title: "The Sound of Music", artist: "Julie Andrews", movie: "The Sound of Music", year: 1965 },
    { title: "Moon River", artist: "Henry Mancini", movie: "Breakfast at Tiffany's", year: 1961 },
    { title: "Mrs. Robinson", artist: "Simon & Garfunkel", movie: "The Graduate", year: 1967 },
    { title: "Raindrops Keep Fallin' on My Head", artist: "B.J. Thomas", movie: "Butch Cassidy and the Sundance Kid", year: 1969 },
    { title: "Theme from Shaft", artist: "Isaac Hayes", movie: "Shaft", year: 1971 },
    { title: "Stayin' Alive", artist: "Bee Gees", movie: "Saturday Night Fever", year: 1977 },
    { title: "You're The One That I Want", artist: "John Travolta", movie: "Grease", year: 1978 },
    { title: "Gonna Fly Now", artist: "Bill Conti", movie: "Rocky", year: 1976 },
    { title: "Take My Breath Away", artist: "Berlin", movie: "Top Gun", year: 1986 },
    { title: "The Power of Love", artist: "Huey Lewis and the News", movie: "Back to the Future", year: 1985 },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters", year: 1984 },
    { title: "Footloose", artist: "Kenny Loggins", movie: "Footloose", year: 1984 },
    { title: "Flashdance... What a Feeling", artist: "Irene Cara", movie: "Flashdance", year: 1983 },
    { title: "Time of My Life", artist: "Bill Medley", movie: "Dirty Dancing", year: 1987 },
    { title: "Unchained Melody", artist: "Righteous Brothers", movie: "Ghost", year: 1990 },
    { title: "Against All Odds", artist: "Phil Collins", movie: "Against All Odds", year: 1984 },
    { title: "Endless Love", artist: "Diana Ross", movie: "Endless Love", year: 1981 },
    { title: "Up Where We Belong", artist: "Joe Cocker", movie: "An Officer and a Gentleman", year: 1982 },
    { title: "Fame", artist: "Irene Cara", movie: "Fame", year: 1980 },
    { title: "9 to 5", artist: "Dolly Parton", movie: "9 to 5", year: 1980 },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky III", year: 1982 },
    { title: "Danger Zone", artist: "Kenny Loggins", movie: "Top Gun", year: 1986 },
    { title: "Don't You (Forget About Me)", artist: "Simple Minds", movie: "The Breakfast Club", year: 1985 },
    { title: "St. Elmo's Fire", artist: "John Parr", movie: "St. Elmo's Fire", year: 1985 },
    { title: "Axel F", artist: "Harold Faltermeyer", movie: "Beverly Hills Cop", year: 1984 },
    { title: "Chariots of Fire", artist: "Vangelis", movie: "Chariots of Fire", year: 1981 },
    { title: "Raiders March", artist: "John Williams", movie: "Raiders of the Lost Ark", year: 1981 },
    { title: "Flying Theme", artist: "John Williams", movie: "E.T. the Extra-Terrestrial", year: 1982 },
    { title: "Main Title", artist: "John Williams", movie: "Jaws", year: 1975 },
    { title: "The Pink Panther Theme", artist: "Henry Mancini", movie: "The Pink Panther", year: 1963 },
    { title: "Goldfinger", artist: "Shirley Bassey", movie: "Goldfinger", year: 1964 },
    { title: "Live and Let Die", artist: "Paul McCartney", movie: "Live and Let Die", year: 1973 },
    { title: "Nobody Does It Better", artist: "Carly Simon", movie: "The Spy Who Loved Me", year: 1977 },
    { title: "For Your Eyes Only", artist: "Sheena Easton", movie: "For Your Eyes Only", year: 1981 },
    { title: "A View to a Kill", artist: "Duran Duran", movie: "A View to a Kill", year: 1985 },
    { title: "Windmills of Your Mind", artist: "Noel Harrison", movie: "The Thomas Crown Affair", year: 1968 },
    { title: "Everybody's Talkin'", artist: "Harry Nilsson", movie: "Midnight Cowboy", year: 1969 },
    { title: "Born to be Wild", artist: "Steppenwolf", movie: "Easy Rider", year: 1969 },
    { title: "Stand By Me", artist: "Ben E. King", movie: "Stand By Me", year: 1986 },
    { title: "Twist and Shout", artist: "The Beatles", movie: "Ferris Bueller's Day Off", year: 1986 },
    { title: "Old Time Rock and Roll", artist: "Bob Seger", movie: "Risky Business", year: 1983 },
    { title: "I'm Alright", artist: "Kenny Loggins", movie: "Caddyshack", year: 1980 },
    { title: "Soul Man", artist: "Blues Brothers", movie: "The Blues Brothers", year: 1980 },
    { title: "Bohemian Rhapsody", artist: "Queen", movie: "Wayne's World", year: 1992 },
    { title: "My Girl", artist: "The Temptations", movie: "My Girl", year: 1991 },
    { title: "Maniac", artist: "Michael Sembello", movie: "Flashdance", year: 1983 },
    { title: "Holding Out for a Hero", artist: "Bonnie Tyler", movie: "Footloose", year: 1984 },
    { title: "Let's Hear It for the Boy", artist: "Deniece Williams", movie: "Footloose", year: 1984 },
    { title: "Neutron Dance", artist: "The Pointer Sisters", movie: "Beverly Hills Cop", year: 1984 },
    { title: "The Heat Is On", artist: "Glenn Frey", movie: "Beverly Hills Cop", year: 1984 },
    { title: "Invincible", artist: "Pat Benatar", movie: "The Legend of Billie Jean", year: 1985 },
    { title: "We Don't Need Another Hero", artist: "Tina Turner", movie: "Mad Max Beyond Thunderdome", year: 1985 },
    { title: "A Hazy Shade of Winter", artist: "The Bangles", movie: "Less Than Zero", year: 1987 },
    { title: "Kokomo", artist: "The Beach Boys", movie: "Cocktail", year: 1988 },
    { title: "Don't Worry, Be Happy", artist: "Bobby McFerrin", movie: "Cocktail", year: 1988 },
    { title: "Wild Wild West", artist: "The Escape Club", movie: "Wild Wild West", year: 1999 },
    { title: "I Will Always Love You", artist: "Whitney Houston", movie: "The Bodyguard", year: 1992 },
    { title: "It Must Have Been Love", artist: "Roxette", movie: "Pretty Woman", year: 1990 },
    { title: "King of Wishful Thinking", artist: "Go West", movie: "Pretty Woman", year: 1990 },
    { title: "Blaze of Glory", artist: "Jon Bon Jovi", movie: "Young Guns II", year: 1990 },
    { title: "Show Me Heaven", artist: "Maria McKee", movie: "Days of Thunder", year: 1990 },
    { title: "Uninvited", artist: "Alanis Morissette", movie: "City of Angels", year: 1998 },
    { title: "Iris", artist: "The Goo Goo Dolls", movie: "City of Angels", year: 1998 },
    { title: "I Don't Want to Miss a Thing", artist: "Aerosmith", movie: "Armageddon", year: 1998 },
    { title: "My Heart Will Go On", artist: "Celine Dion", movie: "Titanic", year: 1997 },
    { title: "Men in Black", artist: "Will Smith", movie: "Men in Black", year: 1997 },
    { title: "Love Is All Around", artist: "Wet Wet Wet", movie: "Four Weddings and a Funeral", year: 1994 },
    { title: "Regulate", artist: "Warren G", movie: "Above the Rim", year: 1994 },
    { title: "Streets of Philadelphia", artist: "Bruce Springsteen", movie: "Philadelphia", year: 1993 },
    { title: "Can You Feel the Love Tonight", artist: "Elton John", movie: "The Lion King", year: 1994 },
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King", year: 1994 },
    { title: "Gangsta's Paradise", artist: "Coolio", movie: "Dangerous Minds", year: 1995 },
    { title: "Kiss from a Rose", artist: "Seal", movie: "Batman Forever", year: 1995 },
    { title: "Hold Me, Thrill Me, Kiss Me, Kill Me", artist: "U2", movie: "Batman Forever", year: 1995 },
    { title: "Exhale (Shoop Shoop)", artist: "Whitney Houston", movie: "Waiting to Exhale", year: 1995 },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story", year: 1995 },
    { title: "I Believe I Can Fly", artist: "R. Kelly", movie: "Space Jam", year: 1996 },
    { title: "Lovefool", artist: "The Cardigans", movie: "Romeo + Juliet", year: 1996 },
    { title: "I'm Gonna Be (500 Miles)", artist: "The Proclaimers", movie: "Benny & Joon", year: 1993 },
    { title: "Stay (I Missed You)", artist: "Lisa Loeb", movie: "Reality Bites", year: 1994 },
    { title: "My Sharona", artist: "The Knack", movie: "Reality Bites", year: 1994 },
    { title: "You Could Be Mine", artist: "Guns N' Roses", movie: "Terminator 2: Judgment Day", year: 1991 },
    { title: "Everything I Do (I Do It for You)", artist: "Bryan Adams", movie: "Robin Hood: Prince of Thieves", year: 1991 },
    { title: "Tears in Heaven", artist: "Eric Clapton", movie: "Rush", year: 1991 },
    { title: "Beauty and the Beast", artist: "Celine Dion", movie: "Beauty and the Beast", year: 1991 },
    { title: "A Whole New World", artist: "Peabo Bryson", movie: "Aladdin", year: 1992 },
    { title: "I Have Nothing", artist: "Whitney Houston", movie: "The Bodyguard", year: 1992 },
    { title: "Run to You", artist: "Whitney Houston", movie: "The Bodyguard", year: 1992 },
    { title: "Hakuna Matata", artist: "Nathan Lane", movie: "The Lion King", year: 1994 },
    { title: "Colors of the Wind", artist: "Vanessa Williams", movie: "Pocahontas", year: 1995 },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story", year: 1995 },
    { title: "Because You Loved Me", artist: "Celine Dion", movie: "Up Close & Personal", year: 1996 },
    { title: "Change the World", artist: "Eric Clapton", movie: "Phenomenon", year: 1996 },
    { title: "That Thing You Do!", artist: "The Wonders", movie: "That Thing You Do!", year: 1996 },
    { title: "I Believe in You and Me", artist: "Whitney Houston", movie: "The Preacher's Wife", year: 1996 },
    { title: "Step by Step", artist: "Whitney Houston", movie: "The Preacher's Wife", year: 1996 },
    { title: "For You I Will", artist: "Monica", movie: "Space Jam", year: 1996 },
    { title: "How Do I Live", artist: "Trisha Yearwood", movie: "Con Air", year: 1997 },
    { title: "Go the Distance", artist: "Michael Bolton", movie: "Hercules", year: 1997 },
    { title: "Tomorrow Never Dies", artist: "Sheryl Crow", movie: "Tomorrow Never Dies", year: 1997 },
    { title: "Reflection", artist: "Christina Aguilera", movie: "Mulan", year: 1998 },
    { title: "I Don't Want to Miss a Thing", artist: "Aerosmith", movie: "Armageddon", year: 1998 },
    { title: "The Prayer", artist: "Celine Dion", movie: "Quest for Camelot", year: 1998 },
    { title: "When You Believe", artist: "Mariah Carey", movie: "The Prince of Egypt", year: 1998 },
    { title: "Music of My Heart", artist: "NSYNC", movie: "Music of the Heart", year: 1999 },
    { title: "You'll Be in My Heart", artist: "Phil Collins", movie: "Tarzan", year: 1999 },
    { title: "Save Me", artist: "Aimee Mann", movie: "Magnolia", year: 1999 },
    { title: "Blame Canada", artist: "Robin Williams", movie: "South Park: Bigger, Longer & Uncut", year: 1999 },
    { title: "The World Is Not Enough", artist: "Garbage", movie: "The World Is Not Enough", year: 1999 },
    { title: "Things Have Changed", artist: "Bob Dylan", movie: "Wonder Boys", year: 2000 },
    { title: "I've Seen It All", artist: "Björk", movie: "Dancer in the Dark", year: 2000 },
    { title: "My Funny Friend and Me", artist: "Sting", movie: "The Emperor's New Groove", year: 2000 },
    { title: "A Love Before Time", artist: "Coco Lee", movie: "Crouching Tiger, Hidden Dragon", year: 2000 },
    { title: "May It Be", artist: "Enya", movie: "The Lord of the Rings: The Fellowship of the Ring", year: 2001 },
    { title: "Until", artist: "Sting", movie: "Kate & Leopold", year: 2001 },
    { title: "Vanilla Sky", artist: "Paul McCartney", movie: "Vanilla Sky", year: 2001 },
    { title: "There You'll Be", artist: "Faith Hill", movie: "Pearl Harbor", year: 2001 },
    { title: "Lose Yourself", artist: "Eminem", movie: "8 Mile", year: 2002 },
    { title: "I Move On", artist: "Catherine Zeta-Jones", movie: "Chicago", year: 2002 },
    { title: "Father and Daughter", artist: "Paul Simon", movie: "The Wild Thornberrys Movie", year: 2002 },
    { title: "The Hands That Built America", artist: "U2", movie: "Gangs of New York", year: 2002 },
    { title: "Into the West", artist: "Annie Lennox", movie: "The Lord of the Rings: The Return of the King", year: 2003 },
    { title: "A Kiss at the End of the Rainbow", artist: "Mitch & Mickey", movie: "A Mighty Wind", year: 2003 },
    { title: "Scarlet Tide", artist: "Alison Krauss", movie: "Cold Mountain", year: 2003 },
    { title: "You Will Be My Ain True Love", artist: "Alison Krauss", movie: "Cold Mountain", year: 2003 },
    { title: "Belleville Rendez-vous", artist: "Benoît Charest", movie: "The Triplets of Belleville", year: 2003 },
    { title: "Al Otro Lado del Río", artist: "Jorge Drexler", movie: "The Motorcycle Diaries", year: 2004 },
    { title: "Accidentally in Love", artist: "Counting Crows", movie: "Shrek 2", year: 2004 },
    { title: "Learn to Be Lonely", artist: "Minnie Driver", movie: "The Phantom of the Opera", year: 2004 },
    { title: "Believe", artist: "Josh Groban", movie: "The Polar Express", year: 2004 },
    { title: "Look to Your Path", artist: "Bruno Coulais", movie: "The Chorus", year: 2004 }
  ],
  modern_tv: [ // Last 20 Years
    { title: "Game of Thrones Main Title", artist: "Ramin Djawadi", movie: "Game of Thrones", year: 2011 },
    { title: "Stranger Things Theme", artist: "Kyle Dixon", movie: "Stranger Things", year: 2016 },
    { title: "Succession (Main Title)", artist: "Nicholas Britell", movie: "Succession", year: 2018 },
    { title: "The White Lotus Theme", artist: "Cristobal Tapia de Veer", movie: "The White Lotus", year: 2021 },
    { title: "The Mandalorian", artist: "Ludwig Goransson", movie: "The Mandalorian", year: 2019 },
    { title: "Breaking Bad Theme", artist: "Dave Porter", movie: "Breaking Bad", year: 2008 },
    { title: "Better Call Saul Theme", artist: "Little Barrie", movie: "Better Call Saul", year: 2015 },
    { title: "The Office Theme", artist: "The Scrantones", movie: "The Office", year: 2005 },
    { title: "Parks and Recreation Theme", artist: "Gaby Moreno", movie: "Parks and Recreation", year: 2009 },
    { title: "The History of Everything", artist: "Barenaked Ladies", movie: "The Big Bang Theory", year: 2007 },
    { title: "Modern Family Theme", artist: "Gabriel Mann", movie: "Modern Family", year: 2009 },
    { title: "Brooklyn Nine-Nine", artist: "Dan Marocco", movie: "Brooklyn Nine-Nine", year: 2013 },
    { title: "Hey Beautiful", artist: "The Solids", movie: "How I Met Your Mother", year: 2005 },
    { title: "A Beautiful Mine", artist: "RJD2", movie: "Mad Men", year: 2007 },
    { title: "Downton Abbey Theme", artist: "John Lunn", movie: "Downton Abbey", year: 2010 },
    { title: "Sherlock Theme", artist: "David Arnold", movie: "Sherlock", year: 2010 },
    { title: "Doctor Who Theme", artist: "Murray Gold", movie: "Doctor Who", year: 2005 },
    { title: "Westworld Main Title", artist: "Ramin Djawadi", movie: "Westworld", year: 2016 },
    { title: "Toss A Coin To Your Witcher", artist: "Sonya Belousova", movie: "The Witcher", year: 2019 },
    { title: "Enemy", artist: "Imagine Dragons", movie: "Arcane", year: 2021 },
    { title: "Yellowstone Theme", artist: "Brian Tyler", movie: "Yellowstone", year: 2018 },
    { title: "Ted Lasso Theme", artist: "Marcus Mumford", movie: "Ted Lasso", year: 2020 },
    { title: "Severance Main Title", artist: "Theodore Shapiro", movie: "Severance", year: 2022 },
    { title: "Way Back Then", artist: "Jung Jaeil", movie: "Squid Game", year: 2021 },
    { title: "Wednesday Main Titles", artist: "Danny Elfman", movie: "Wednesday", year: 2022 },
    { title: "You've Got Time", artist: "Regina Spektor", movie: "Orange Is the New Black", year: 2013 },
    { title: "Cosy in the Rocket", artist: "Psapp", movie: "Grey's Anatomy", year: 2005 },
    { title: "How to Save a Life", artist: "The Fray", movie: "Grey's Anatomy", year: 2005 },
    { title: "Teardrop", artist: "Massive Attack", movie: "House", year: 2004 },
    { title: "Woke Up This Morning", artist: "Alabama 3", movie: "The Sopranos", year: 1999 },
    { title: "The Walking Dead Theme", artist: "Bear McCreary", movie: "The Walking Dead", year: 2010 },
    { title: "Dexter Main Title", artist: "Rolfe Kent", movie: "Dexter", year: 2006 },
    { title: "Bad Things", artist: "Jace Everett", movie: "True Blood", year: 2008 },
    { title: "The Luck You Got", artist: "The High Strung", movie: "Shameless", year: 2011 },
    { title: "Superman", artist: "Lazlo Bane", movie: "Scrubs", year: 2001 },
    { title: "I Don't Want to Be", artist: "Gavin DeGraw", movie: "One Tree Hill", year: 2003 },
    { title: "California", artist: "Phantom Planet", movie: "The O.C.", year: 2003 },
    { title: "Save Me", artist: "Remy Zero", movie: "Smallville", year: 2001 },
    { title: "Where You Lead", artist: "Carole King", movie: "Gilmore Girls", year: 2000 },
    { title: "Boss of Me", artist: "They Might Be Giants", movie: "Malcolm in the Middle", year: 2000 },
    { title: "Unwritten", artist: "Natasha Bedingfield", movie: "The Hills", year: 2006 },
    { title: "Leave It All to Me", artist: "Miranda Cosgrove", movie: "iCarly", year: 2007 },
    { title: "Make It Shine", artist: "Victoria Justice", movie: "Victorious", year: 2010 },
    { title: "The Best of Both Worlds", artist: "Miley Cyrus", movie: "Hannah Montana", year: 2006 },
    { title: "Everything Is Not What It Seems", artist: "Selena Gomez", movie: "Wizards of Waverly Place", year: 2007 },
    { title: "Today Is Gonna Be a Great Day", artist: "Bowling For Soup", movie: "Phineas and Ferb", year: 2007 },
    { title: "SpongeBob SquarePants Theme", artist: "Patrick Pinney", movie: "SpongeBob SquarePants", year: 1999 },
    { title: "Adventure Time", artist: "Pendleton Ward", movie: "Adventure Time", year: 2010 },
    { title: "Rick and Morty Theme", artist: "Ryan Elder", movie: "Rick and Morty", year: 2013 },
    { title: "BoJack Horseman Theme", artist: "Patrick Carney", movie: "BoJack Horseman", year: 2014 },
    { title: "Tank!", artist: "The Seatbelts", movie: "Cowboy Bebop", year: 1998 },
    { title: "A Cruel Angel's Thesis", artist: "Yoko Takahashi", movie: "Neon Genesis Evangelion", year: 1995 },
    { title: "Gotta Catch 'Em All", artist: "Jason Paige", movie: "Pokémon", year: 1998 },
    { title: "We Are", artist: "Hiroshi Kitadani", movie: "One Piece", year: 1999 },
    { title: "Cha-La Head-Cha-La", artist: "Hironobu Kageyama", movie: "Dragon Ball Z", year: 1989 },
    { title: "Unravel", artist: "TK from Ling Tosite Sigure", movie: "Tokyo Ghoul", year: 2014 },
    { title: "Gurenge", artist: "LiSA", movie: "Demon Slayer", year: 2019 },
    { title: "Blue Bird", artist: "Ikimonogakari", movie: "Naruto Shippuden", year: 2008 },
    { title: "The Day", artist: "Porno Graffitti", movie: "My Hero Academia", year: 2016 },
    { title: "Again", artist: "YUI", movie: "Fullmetal Alchemist: Brotherhood", year: 2009 },
    { title: "Colors", artist: "FLOW", movie: "Code Geass", year: 2006 },
    { title: "Crossing Field", artist: "LiSA", movie: "Sword Art Online", year: 2012 },
    { title: "History Maker", artist: "Dean Fujioka", movie: "Yuri!!! on Ice", year: 2016 },
    { title: "Red Swan", artist: "Yoshiki", movie: "Attack on Titan", year: 2018 },
    { title: "Shinzou wo Sasageyo!", artist: "Linked Horizon", movie: "Attack on Titan", year: 2017 },
    { title: "Guren no Yumiya", artist: "Linked Horizon", movie: "Attack on Titan", year: 2013 },
    { title: "Black Catcher", artist: "Vickeblanka", movie: "Black Clover", year: 2017 },
    { title: "Polaris", artist: "Blue Encount", movie: "My Hero Academia", year: 2019 },
    { title: "Inferno", artist: "Mrs. Green Apple", movie: "Fire Force", year: 2019 },
    { title: "Kaikai Kitan", artist: "Eve", movie: "Jujutsu Kaisen", year: 2020 },
    { title: "Cry Baby", artist: "Official HIGE DANdism", movie: "Tokyo Revengers", year: 2021 },
    { title: "Mixed Nuts", artist: "Official HIGE DANdism", movie: "Spy x Family", year: 2022 },
    { title: "Kick Back", artist: "Kenshi Yonezu", movie: "Chainsaw Man", year: 2022 },
    { title: "Idol", artist: "YOASOBI", movie: "Oshi no Ko", year: 2023 },
    { title: "Bling-Bang-Bang-Born", artist: "Creepy Nuts", movie: "Mashle", year: 2024 }
  ],
  classic_tv: [ // 20-50 Years Ago (70s, 80s, 90s)
    { title: "I'll Be There for You", artist: "The Rembrandts", movie: "Friends", year: 1994 },
    { title: "Seinfeld Theme", artist: "Jonathan Wolff", movie: "Seinfeld", year: 1989 },
    { title: "Where Everybody Knows Your Name", artist: "Gary Portnoy", movie: "Cheers", year: 1982 },
    { title: "Thank You for Being a Friend", artist: "Cynthia Fee", movie: "The Golden Girls", year: 1985 },
    { title: "Everywhere You Look", artist: "Jesse Frederick", movie: "Full House", year: 1987 },
    { title: "The Fresh Prince of Bel-Air", artist: "Will Smith", movie: "The Fresh Prince of Bel-Air", year: 1990 },
    { title: "Saved by the Bell", artist: "Michael Damian", movie: "Saved by the Bell", year: 1989 },
    { title: "The Simpsons Theme", artist: "Danny Elfman", movie: "The Simpsons", year: 1989 },
    { title: "The X-Files", artist: "Mark Snow", movie: "The X-Files", year: 1993 },
    { title: "Twin Peaks Theme", artist: "Angelo Badalamenti", movie: "Twin Peaks", year: 1990 },
    { title: "Law & Order", artist: "Mike Post", movie: "Law & Order", year: 1990 },
    { title: "Suicide Is Painless", artist: "Johnny Mandel", movie: "M*A*S*H", year: 1972 },
    { title: "Angela", artist: "Bob James", movie: "Taxi", year: 1978 },
    { title: "Movin' On Up", artist: "Ja'net Dubois", movie: "The Jeffersons", year: 1975 },
    { title: "Good Times", artist: "Jim Gilstrap", movie: "Good Times", year: 1974 },
    { title: "Sanford and Son Theme", artist: "Quincy Jones", movie: "Sanford and Son", year: 1972 },
    { title: "Those Were the Days", artist: "Carroll O'Connor", movie: "All in the Family", year: 1971 },
    { title: "Love is All Around", artist: "Sonny Curtis", movie: "The Mary Tyler Moore Show", year: 1970 },
    { title: "Happy Days", artist: "Pratt & McClain", movie: "Happy Days", year: 1974 },
    { title: "Making Our Dreams Come True", artist: "Cyndi Grecco", movie: "Laverne & Shirley", year: 1976 },
    { title: "Come and Knock on Our Door", artist: "Ray Charles", movie: "Three's Company", year: 1977 },
    { title: "It Takes Diff'rent Strokes", artist: "Alan Thicke", movie: "Diff'rent Strokes", year: 1978 },
    { title: "Facts of Life", artist: "Gloria Loring", movie: "The Facts of Life", year: 1979 },
    { title: "As Long As We Got Each Other", artist: "B.J. Thomas", movie: "Growing Pains", year: 1985 },
    { title: "Without Us", artist: "Johnny Mathis", movie: "Family Ties", year: 1982 },
    { title: "Believe It or Not", artist: "Joey Scarbury", movie: "The Greatest American Hero", year: 1981 },
    { title: "Theme from Magnum P.I.", artist: "Mike Post", movie: "Magnum, P.I.", year: 1980 },
    { title: "Miami Vice Theme", artist: "Jan Hammer", movie: "Miami Vice", year: 1984 },
    { title: "Knight Rider Theme", artist: "Stu Phillips", movie: "Knight Rider", year: 1982 },
    { title: "The A-Team Theme", artist: "Mike Post", movie: "The A-Team", year: 1983 },
    { title: "MacGyver Theme", artist: "Randy Edelman", movie: "MacGyver", year: 1985 },
    { title: "Hawaii Five-O", artist: "The Ventures", movie: "Hawaii Five-O", year: 1968 },
    { title: "Mission: Impossible", artist: "Lalo Schifrin", movie: "Mission: Impossible", year: 1966 },
    { title: "Batman Theme", artist: "Neal Hefti", movie: "Batman", year: 1966 },
    { title: "The Brady Bunch", artist: "Peppermint Trolley Company", movie: "The Brady Bunch", year: 1969 },
    { title: "The Addams Family", artist: "Vic Mizzy", movie: "The Addams Family", year: 1964 },
    { title: "The Munsters", artist: "Jack Marshall", movie: "The Munsters", year: 1964 },
    { title: "I Dream of Jeannie", artist: "Hugo Montenegro", movie: "I Dream of Jeannie", year: 1965 },
    { title: "Bewitched", artist: "Howard Greenfield", movie: "Bewitched", year: 1964 },
    { title: "The Ballad of Gilligan's Isle", artist: "The Wellingtons", movie: "Gilligan's Island", year: 1964 },
    { title: "Scooby-Doo, Where Are You!", artist: "Larry Marks", movie: "Scooby-Doo, Where Are You!", year: 1969 },
    { title: "Meet the Flintstones", artist: "Hoyt Curtin", movie: "The Flintstones", year: 1960 },
    { title: "The Jetsons", artist: "Hoyt Curtin", movie: "The Jetsons", year: 1962 },
    { title: "DuckTales Theme", artist: "Jeff Pescetto", movie: "DuckTales", year: 1987 },
    { title: "Teenage Mutant Ninja Turtles", artist: "Chuck Lorre", movie: "Teenage Mutant Ninja Turtles", year: 1987 },
    { title: "Pokemon Theme", artist: "Jason Paige", movie: "Pokémon", year: 1998 },
    { title: "Go Go Power Rangers", artist: "Ron Wasserman", movie: "Mighty Morphin Power Rangers", year: 1993 },
    { title: "I'm Always Here", artist: "Jimi Jamison", movie: "Baywatch", year: 1989 },
    { title: "Bad Boys", artist: "Inner Circle", movie: "Cops", year: 1989 },
    { title: "In the Street", artist: "Cheap Trick", movie: "That '70s Show", year: 1998 },
    { title: "Full House Theme", artist: "Jesse Frederick", movie: "Full House", year: 1987 },
    { title: "Family Matters Theme", artist: "Jesse Frederick", movie: "Family Matters", year: 1989 },
    { title: "Step by Step", artist: "Jesse Frederick", movie: "Step by Step", year: 1991 },
    { title: "Perfect Strangers Theme", artist: "David Pomeranz", movie: "Perfect Strangers", year: 1986 },
    { title: "Who's the Boss? Theme", artist: "Larry Weiss", movie: "Who's the Boss?", year: 1984 },
    { title: "Moonlighting", artist: "Al Jarreau", movie: "Moonlighting", year: 1985 },
    { title: "Hill Street Blues Theme", artist: "Mike Post", movie: "Hill Street Blues", year: 1981 },
    { title: "St. Elsewhere Theme", artist: "Dave Grusin", movie: "St. Elsewhere", year: 1982 },
    { title: "L.A. Law Theme", artist: "Mike Post", movie: "L.A. Law", year: 1986 },
    { title: "NYPD Blue Theme", artist: "Mike Post", movie: "NYPD Blue", year: 1993 },
    { title: "ER Theme", artist: "James Newton Howard", movie: "ER", year: 1994 },
    { title: "The West Wing Theme", artist: "W.G. Snuffy Walden", movie: "The West Wing", year: 1999 },
    { title: "Sex and the City Theme", artist: "Douglas J. Cuomo", movie: "Sex and the City", year: 1998 },
    { title: "Will & Grace Theme", artist: "Jonathan Wolff", movie: "Will & Grace", year: 1998 },
    { title: "Ally McBeal Theme", artist: "Vonda Shepard", movie: "Ally McBeal", year: 1997 },
    { title: "Dawson's Creek Theme", artist: "Paula Cole", movie: "Dawson's Creek", year: 1998 },
    { title: "Buffy the Vampire Slayer Theme", artist: "Nerf Herder", movie: "Buffy the Vampire Slayer", year: 1997 },
    { title: "Charmed Theme", artist: "Love Spit Love", movie: "Charmed", year: 1998 },
    { title: "7th Heaven Theme", artist: "Steve Plunkett", movie: "7th Heaven", year: 1996 },
    { title: "Gilmore Girls Theme", artist: "Carole King", movie: "Gilmore Girls", year: 2000 },
    { title: "Malcolm in the Middle Theme", artist: "They Might Be Giants", movie: "Malcolm in the Middle", year: 2000 },
    { title: "Scrubs Theme", artist: "Lazlo Bane", movie: "Scrubs", year: 2001 },
    { title: "The Office (UK) Theme", artist: "Big George", movie: "The Office (UK)", year: 2001 },
    { title: "Arrested Development Theme", artist: "David Schwartz", movie: "Arrested Development", year: 2003 },
    { title: "Entourage Theme", artist: "Jane's Addiction", movie: "Entourage", year: 2004 },
    { title: "Lost Theme", artist: "Michael Giacchino", movie: "Lost", year: 2004 },
    { title: "Desperate Housewives Theme", artist: "Danny Elfman", movie: "Desperate Housewives", year: 2004 },
    { title: "Grey's Anatomy Theme", artist: "Psapp", movie: "Grey's Anatomy", year: 2005 },
    { title: "How I Met Your Mother Theme", artist: "The Solids", movie: "How I Met Your Mother", year: 2005 },
    { title: "Prison Break Theme", artist: "Ramin Djawadi", movie: "Prison Break", year: 2005 },
    { title: "Heroes Theme", artist: "Wendy & Lisa", movie: "Heroes", year: 2006 },
    { title: "30 Rock Theme", artist: "Jeff Richmond", movie: "30 Rock", year: 2006 },
    { title: "Dexter Theme", artist: "Rolfe Kent", movie: "Dexter", year: 2006 },
    { title: "Friday Night Lights Theme", artist: "Explosions in the Sky", movie: "Friday Night Lights", year: 2006 },
    { title: "Mad Men Theme", artist: "RJD2", movie: "Mad Men", year: 2007 },
    { title: "Breaking Bad Theme", artist: "Dave Porter", movie: "Breaking Bad", year: 2008 },
    { title: "Sons of Anarchy Theme", artist: "Curtis Stigers", movie: "Sons of Anarchy", year: 2008 },
    { title: "True Blood Theme", artist: "Jace Everett", movie: "True Blood", year: 2008 },
    { title: "Parks and Recreation Theme", artist: "Gaby Moreno", movie: "Parks and Recreation", year: 2009 },
    { title: "Glee Theme", artist: "Glee Cast", movie: "Glee", year: 2009 },
    { title: "Modern Family Theme", artist: "Gabriel Mann", movie: "Modern Family", year: 2009 },
    { title: "Community Theme", artist: "The 88", movie: "Community", year: 2009 },
    { title: "The Vampire Diaries Theme", artist: "Michael Suby", movie: "The Vampire Diaries", year: 2009 },
    { title: "Justified Theme", artist: "Gangstagrass", movie: "Justified", year: 2010 },
    { title: "Boardwalk Empire Theme", artist: "The Brian Jonestown Massacre", movie: "Boardwalk Empire", year: 2010 },
    { title: "The Walking Dead Theme", artist: "Bear McCreary", movie: "The Walking Dead", year: 2010 },
    { title: "Game of Thrones Theme", artist: "Ramin Djawadi", movie: "Game of Thrones", year: 2011 },
    { title: "New Girl Theme", artist: "Zooey Deschanel", movie: "New Girl", year: 2011 },
    { title: "Homeland Theme", artist: "Sean Callery", movie: "Homeland", year: 2011 },
    { title: "American Horror Story Theme", artist: "Cesar Davila-Irizarry", movie: "American Horror Story", year: 2011 },
    { title: "Scandal Theme", artist: "Chad Fischer", movie: "Scandal", year: 2012 },
    { title: "Veep Theme", artist: "Rupert Gregson-Williams", movie: "Veep", year: 2012 },
    { title: "Girls Theme", artist: "Santigold", movie: "Girls", year: 2012 },
    { title: "Orange Is the New Black Theme", artist: "Regina Spektor", movie: "Orange Is the New Black", year: 2013 },
    { title: "House of Cards Theme", artist: "Jeff Beal", movie: "House of Cards", year: 2013 },
    { title: "Brooklyn Nine-Nine Theme", artist: "Dan Marocco", movie: "Brooklyn Nine-Nine", year: 2013 },
    { title: "Rick and Morty Theme", artist: "Ryan Elder", movie: "Rick and Morty", year: 2013 },
    { title: "True Detective Theme", artist: "The Handsome Family", movie: "True Detective", year: 2014 },
    { title: "Fargo Theme", artist: "Jeff Russo", movie: "Fargo", year: 2014 },
    { title: "Silicon Valley Theme", artist: "Tobacco", movie: "Silicon Valley", year: 2014 },
    { title: "BoJack Horseman Theme", artist: "Patrick Carney", movie: "BoJack Horseman", year: 2014 },
    { title: "Outlander Theme", artist: "Bear McCreary", movie: "Outlander", year: 2014 },
    { title: "Better Call Saul Theme", artist: "Little Barrie", movie: "Better Call Saul", year: 2015 },
    { title: "Empire Theme", artist: "Filthy Rich", movie: "Empire", year: 2015 },
    { title: "Daredevil Theme", artist: "John Paesano", movie: "Daredevil", year: 2015 },
    { title: "Mr. Robot Theme", artist: "Mac Quayle", movie: "Mr. Robot", year: 2015 },
    { title: "Narcos Theme", artist: "Rodrigo Amarante", movie: "Narcos", year: 2015 },
    { title: "Stranger Things Theme", artist: "Kyle Dixon", movie: "Stranger Things", year: 2016 },
    { title: "The Crown Theme", artist: "Hans Zimmer", movie: "The Crown", year: 2016 },
    { title: "Westworld Theme", artist: "Ramin Djawadi", movie: "Westworld", year: 2016 },
    { title: "This Is Us Theme", artist: "Siddhartha Khosla", movie: "This Is Us", year: 2016 },
    { title: "Atlanta Theme", artist: "Flying Lotus", movie: "Atlanta", year: 2016 },
    { title: "The Handmaid's Tale Theme", artist: "Adam Taylor", movie: "The Handmaid's Tale", year: 2017 },
    { title: "Big Little Lies Theme", artist: "Michael Kiwanuka", movie: "Big Little Lies", year: 2017 },
    { title: "Mindhunter Theme", artist: "Jason Hill", movie: "Mindhunter", year: 2017 },
    { title: "Dark Theme", artist: "Apparat", movie: "Dark", year: 2017 },
    { title: "Succession Theme", artist: "Nicholas Britell", movie: "Succession", year: 2018 },
    { title: "Yellowstone Theme", artist: "Brian Tyler", movie: "Yellowstone", year: 2018 },
    { title: "The Haunting of Hill House Theme", artist: "The Newton Brothers", movie: "The Haunting of Hill House", year: 2018 },
    { title: "The Boys Theme", artist: "Christopher Lennertz", movie: "The Boys", year: 2019 },
    { title: "The Mandalorian Theme", artist: "Ludwig Göransson", movie: "The Mandalorian", year: 2019 },
    { title: "The Witcher Theme", artist: "Sonya Belousova", movie: "The Witcher", year: 2019 },
    { title: "Euphoria Theme", artist: "Labrinth", movie: "Euphoria", year: 2019 },
    { title: "Ted Lasso Theme", artist: "Marcus Mumford", movie: "Ted Lasso", year: 2020 },
    { title: "The Queen's Gambit Theme", artist: "Carlos Rafael Rivera", movie: "The Queen's Gambit", year: 2020 },
    { title: "Bridgerton Theme", artist: "Kris Bowers", movie: "Bridgerton", year: 2020 },
    { title: "WandaVision Theme", artist: "Kristen Anderson-Lopez", movie: "WandaVision", year: 2021 },
    { title: "Squid Game Theme", artist: "Jung Jae-il", movie: "Squid Game", year: 2021 },
    { title: "Arcane Theme", artist: "Imagine Dragons", movie: "Arcane", year: 2021 },
    { title: "Yellowjackets Theme", artist: "Craig Wedren", movie: "Yellowjackets", year: 2021 },
    { title: "Severance Theme", artist: "Theodore Shapiro", movie: "Severance", year: 2022 },
    { title: "House of the Dragon Theme", artist: "Ramin Djawadi", movie: "House of the Dragon", year: 2022 },
    { title: "The Bear Theme", artist: "Refused", movie: "The Bear", year: 2022 },
    { title: "Wednesday Theme", artist: "Danny Elfman", movie: "Wednesday", year: 2022 },
    { title: "The Last of Us Theme", artist: "Gustavo Santaolalla", movie: "The Last of Us", year: 2023 }
  ],
  scifi: [
    { title: "Main Title", artist: "John Williams", movie: "Star Wars", year: 1977 },
    { title: "The Imperial March", artist: "John Williams", movie: "The Empire Strikes Back", year: 1980 },
    { title: "Duel of the Fates", artist: "John Williams", movie: "Star Wars: The Phantom Menace", year: 1999 },
    { title: "Blade Runner Blues", artist: "Vangelis", movie: "Blade Runner", year: 1982 },
    { title: "Cornfield Chase", artist: "Hans Zimmer", movie: "Interstellar", year: 2014 },
    { title: "Also Sprach Zarathustra", artist: "Richard Strauss", movie: "2001: A Space Odyssey", year: 1968 },
    { title: "The Matrix Is Real", artist: "Don Davis", movie: "The Matrix", year: 1999 },
    { title: "Terminator Theme", artist: "Brad Fiedel", movie: "The Terminator", year: 1984 },
    { title: "Flying Theme", artist: "John Williams", movie: "E.T. the Extra-Terrestrial", year: 1982 },
    { title: "Theme from Jurassic Park", artist: "John Williams", movie: "Jurassic Park", year: 1993 },
    { title: "Back to the Future", artist: "Alan Silvestri", movie: "Back to the Future", year: 1985 },
    { title: "End Titles", artist: "Vangelis", movie: "Blade Runner", year: 1982 },
    { title: "Avatar Suite", artist: "James Horner", movie: "Avatar", year: 2009 },
    { title: "Time", artist: "Hans Zimmer", movie: "Inception", year: 2010 },
    { title: "No Time for Caution", artist: "Hans Zimmer", movie: "Interstellar", year: 2014 },
    { title: "Dream Is Collapsing", artist: "Hans Zimmer", movie: "Inception", year: 2010 },
    { title: "Star Trek Main Title", artist: "Jerry Goldsmith", movie: "Star Trek: The Motion Picture", year: 1979 },
    { title: "Into Darkness", artist: "Michael Giacchino", movie: "Star Trek Into Darkness", year: 2013 },
    { title: "The Shape of Water", artist: "Alexandre Desplat", movie: "The Shape of Water", year: 2017 },
    { title: "Arrival", artist: "Johann Johannsson", movie: "Arrival", year: 2016 },
    { title: "Gravity", artist: "Steven Price", movie: "Gravity", year: 2013 },
    { title: "Solaris", artist: "Cliff Martinez", movie: "Solaris", year: 2002 },
    { title: "Tron Legacy (End Titles)", artist: "Daft Punk", movie: "Tron: Legacy", year: 2010 },
    { title: "Derezzed", artist: "Daft Punk", movie: "Tron: Legacy", year: 2010 },
    { title: "Pacific Rim", artist: "Ramin Djawadi", movie: "Pacific Rim", year: 2013 },
    { title: "Mad Max: Fury Road", artist: "Junkie XL", movie: "Mad Max: Fury Road", year: 2015 },
    { title: "Dune", artist: "Hans Zimmer", movie: "Dune", year: 2021 },
    { title: "Paul's Dream", artist: "Hans Zimmer", movie: "Dune", year: 2021 },
    { title: "The Batman", artist: "Michael Giacchino", movie: "The Batman", year: 2022 },
    { title: "Wakanda", artist: "Ludwig Göransson", movie: "Black Panther", year: 2018 },
    { title: "Portals", artist: "Alan Silvestri", movie: "Avengers: Endgame", year: 2019 },
    { title: "The Avengers", artist: "Alan Silvestri", movie: "The Avengers", year: 2012 },
    { title: "Iron Man", artist: "Ramin Djawadi", movie: "Iron Man", year: 2008 },
    { title: "Spider-Man Main Title", artist: "Danny Elfman", movie: "Spider-Man", year: 2002 },
    { title: "Wonder Woman's Wrath", artist: "Rupert Gregson-Williams", movie: "Wonder Woman", year: 2017 },
    { title: "Man of Steel", artist: "Hans Zimmer", movie: "Man of Steel", year: 2013 },
    { title: "Guardians of the Galaxy", artist: "Tyler Bates", movie: "Guardians of the Galaxy", year: 2014 },
    { title: "Hooked on a Feeling", artist: "Blue Swede", movie: "Guardians of the Galaxy", year: 2014 },
    { title: "Come and Get Your Love", artist: "Redbone", movie: "Guardians of the Galaxy", year: 2014 },
    { title: "Mr. Blue Sky", artist: "Electric Light Orchestra", movie: "Guardians of the Galaxy Vol. 2", year: 2017 },
    { title: "Immigrant Song", artist: "Led Zeppelin", movie: "Thor: Ragnarok", year: 2017 },
    { title: "Black Widow", artist: "Lorne Balfe", movie: "Black Widow", year: 2021 },
    { title: "Doctor Strange", artist: "Michael Giacchino", movie: "Doctor Strange", year: 2016 },
    { title: "Ant-Man Theme", artist: "Christophe Beck", movie: "Ant-Man", year: 2015 },
    { title: "Captain America", artist: "Alan Silvestri", movie: "Captain America: The First Avenger", year: 2011 },
    { title: "Winter Soldier", artist: "Henry Jackman", movie: "Captain America: The Winter Soldier", year: 2014 },
    { title: "X-Men Theme", artist: "Michael Kamen", movie: "X-Men", year: 2000 },
    { title: "Logan", artist: "Marco Beltrami", movie: "Logan", year: 2017 },
    { title: "Deadpool Rap", artist: "Teamheadkick", movie: "Deadpool", year: 2016 },
    { title: "Venom", artist: "Eminem", movie: "Venom", year: 2018 }
  ],
  animation: [
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King", year: 1994 },
    { title: "Under the Sea", artist: "Samuel E. Wright", movie: "The Little Mermaid", year: 1989 },
    { title: "Part of Your World", artist: "Jodi Benson", movie: "The Little Mermaid", year: 1989 },
    { title: "Beauty and the Beast", artist: "Angela Lansbury", movie: "Beauty and the Beast", year: 1991 },
    { title: "Be Our Guest", artist: "Jerry Orbach", movie: "Beauty and the Beast", year: 1991 },
    { title: "A Whole New World", artist: "Brad Kane", movie: "Aladdin", year: 1992 },
    { title: "Friend Like Me", artist: "Robin Williams", movie: "Aladdin", year: 1992 },
    { title: "Colors of the Wind", artist: "Judy Kuhn", movie: "Pocahontas", year: 1995 },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story", year: 1995 },
    { title: "When She Loved Me", artist: "Sarah McLachlan", movie: "Toy Story 2", year: 1999 },
    { title: "Hakuna Matata", artist: "Nathan Lane", movie: "The Lion King", year: 1994 },
    { title: "Can You Feel the Love Tonight", artist: "Elton John", movie: "The Lion King", year: 1994 },
    { title: "Reflection", artist: "Lea Salonga", movie: "Mulan", year: 1998 },
    { title: "I'll Make a Man Out of You", artist: "Donny Osmond", movie: "Mulan", year: 1998 },
    { title: "Go the Distance", artist: "Roger Bart", movie: "Hercules", year: 1997 },
    { title: "You'll Be in My Heart", artist: "Phil Collins", movie: "Tarzan", year: 1999 },
    { title: "Let It Go", artist: "Idina Menzel", movie: "Frozen", year: 2013 },
    { title: "Do You Want to Build a Snowman?", artist: "Kristen Bell", movie: "Frozen", year: 2013 },
    { title: "Into the Unknown", artist: "Idina Menzel", movie: "Frozen II", year: 2019 },
    { title: "How Far I'll Go", artist: "Auli'i Cravalho", movie: "Moana", year: 2016 },
    { title: "You're Welcome", artist: "Dwayne Johnson", movie: "Moana", year: 2016 },
    { title: "Remember Me", artist: "Benjamin Bratt", movie: "Coco", year: 2017 },
    { title: "Un Poco Loco", artist: "Anthony Gonzalez", movie: "Coco", year: 2017 },
    { title: "We Don't Talk About Bruno", artist: "Carolina Gaitan", movie: "Encanto", year: 2021 },
    { title: "Surface Pressure", artist: "Jessica Darrow", movie: "Encanto", year: 2021 },
    { title: "The Bare Necessities", artist: "Phil Harris", movie: "The Jungle Book", year: 1967 },
    { title: "I Wan'na Be Like You", artist: "Louis Prima", movie: "The Jungle Book", year: 1967 },
    { title: "Cruella De Vil", artist: "Bill Lee", movie: "One Hundred and One Dalmatians", year: 1961 },
    { title: "Bella Notte", artist: "George Givot", movie: "Lady and the Tramp", year: 1955 },
    { title: "Once Upon a Dream", artist: "Mary Costa", movie: "Sleeping Beauty", year: 1959 },
    { title: "Bibbidi-Bobbidi-Boo", artist: "Verna Felton", movie: "Cinderella", year: 1950 },
    { title: "When You Wish Upon a Star", artist: "Cliff Edwards", movie: "Pinocchio", year: 1940 },
    { title: "Whistle While You Work", artist: "Adriana Caselotti", movie: "Snow White and the Seven Dwarfs", year: 1937 },
    { title: "Heigh-Ho", artist: "The Dwarfs", movie: "Snow White and the Seven Dwarfs", year: 1937 },
    { title: "Married Life", artist: "Michael Giacchino", movie: "Up", year: 2009 },
    { title: "Touch the Sky", artist: "Julie Fowlis", movie: "Brave", year: 2012 },
    { title: "Le Festin", artist: "Camille", movie: "Ratatouille", year: 2007 },
    { title: "Nemo Egg", artist: "Thomas Newman", movie: "Finding Nemo", year: 2003 },
    { title: "The Incredibles", artist: "Michael Giacchino", movie: "The Incredibles", year: 2004 },
    { title: "Monsters, Inc.", artist: "Randy Newman", movie: "Monsters, Inc.", year: 2001 },
    { title: "If I Didn't Have You", artist: "Billy Crystal", movie: "Monsters, Inc.", year: 2001 },
    { title: "Life is a Highway", artist: "Rascal Flatts", movie: "Cars", year: 2006 },
    { title: "Real Gone", artist: "Sheryl Crow", movie: "Cars", year: 2006 },
    { title: "Accidentally in Love", artist: "Counting Crows", movie: "Shrek 2", year: 2004 },
    { title: "I'm a Believer", artist: "Smash Mouth", movie: "Shrek", year: 2001 },
    { title: "All Star", artist: "Smash Mouth", movie: "Shrek", year: 2001 },
    { title: "Everything Is Awesome", artist: "Tegan and Sara", movie: "The Lego Movie", year: 2014 },
    { title: "Spider-Man", artist: "Paul Francis Webster", movie: "Spider-Man: Into the Spider-Verse", year: 2018 },
    { title: "Sunflower", artist: "Post Malone", movie: "Spider-Man: Into the Spider-Verse", year: 2018 },
    { title: "What's Up Danger", artist: "Blackway", movie: "Spider-Man: Into the Spider-Verse", year: 2018 }
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
        return { score: 0, reason: `API Error ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    
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

// Search iTunes for Movie Poster (to get film art instead of album art)
const searchMoviePoster = async (query, type = 'movie', year = null) => {
  console.log(`[TMDB] Searching for ${type}: "${query}" (${year})`);

  if (!tmdbAccessToken || tmdbAccessToken.startsWith("REPLACE")) {
      console.warn("[TMDB] No access token provided or placeholder used.");
      return null;
  }
  
  try {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    let url = `https://api.themoviedb.org/3/search/${endpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    
    if (year) {
        if (type === 'movie') {
            url += `&year=${year}`;
        } else {
            url += `&first_air_date_year=${year}`;
        }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${tmdbAccessToken}`
      }
    });

    if (!res.ok) {
        console.error(`[TMDB] API Error: ${res.status} ${res.statusText}`);
        return null;
    }

    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
        // Sort by popularity to get the most likely match if there are multiple
        const sortedResults = data.results.sort((a, b) => b.popularity - a.popularity);
        const bestResult = sortedResults[0];

        if (bestResult.poster_path) {
             const posterUrl = `https://image.tmdb.org/t/p/w780${bestResult.poster_path}`;
             console.log(`[TMDB] Found poster for "${query}": ${posterUrl}`);
             return posterUrl;
        } else {
            console.log(`[TMDB] Movie/Show found for "${query}" but no poster_path available.`);
        }
    } else {
        console.log(`[TMDB] No results found for "${query}".`);
    }
    return null;
  } catch (e) {
    console.error("[TMDB] Exception during search:", e);
    return null;
  }
};

// --- DRAWING COMPONENT ---
const DrawingPad = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    // Set fixed resolution but display via CSS width/height
    canvas.width = 300; 
    canvas.height = 300;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#1e293b'; // Slate 800 background
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

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault(); // Prevent scrolling on touch
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
      const canvas = canvasRef.current;
      onSave(canvas.toDataURL());
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
        <button 
           onClick={(e) => { e.preventDefault(); clearCanvas(); }}
           className="absolute top-2 right-2 p-2 bg-red-600/80 rounded hover:bg-red-500 text-white"
        >
          <X size={16} />
        </button>
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
  const [step, setStep] = useState(1); // 1: Info, 2: Drawing

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
        <h1 className="text-5xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          CineScore
        </h1>
        <p className="text-slate-400 mb-8 text-lg">The Ultimate Soundtrack Trivia</p>

        <div className="space-y-4 max-w-lg mx-auto w-full">
          {step === 1 ? (
             <>
               <button 
                 onClick={() => setMode('host')}
                 className="w-full py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg"
               >
                 Host a New Game
               </button>
               
               <div className="relative my-6">
                 <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
                 <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-500">OR JOIN EXISTING</span></div>
               </div>

               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-3 w-full">
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
                   onClick={() => setStep(2)}
                   className="w-full py-3 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                 >
                   Next: Draw Avatar <ArrowRight size={18} className="inline ml-1" />
                 </button>
               </div>
             </>
          ) : (
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 w-full">
                 <h2 className="text-xl font-bold text-white">Draw Your Icon</h2>
                 <DrawingPad onSave={setAvatar} />
                 <div className="flex gap-2">
                     <button 
                        onClick={() => setStep(1)}
                        className="flex-1 py-3 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-600 transition-colors"
                     >
                        Back
                     </button>
                     <button 
                        onClick={() => joinGame(code, name, avatar)}
                        className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 transition-colors"
                     >
                        Join Game
                     </button>
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
  const audioRef = useRef(null);
  const [verification, setVerification] = useState(null);

  // Load Game & Players
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

  // Audio Player Effect - only restarts when previewUrl changes
  useEffect(() => {
    if (audioRef.current) {
      if (game?.status === 'playing' && game?.currentSong?.previewUrl && !game?.buzzerWinner) {
        // Only change src if it's new to avoid restart
        if (audioRef.current.src !== game.currentSong.previewUrl) {
            audioRef.current.src = game.currentSong.previewUrl;
            audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        } else if (audioRef.current.paused) {
            // Resume if it was paused but same song (e.g. slight hiccup)
            audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        }
      } else if (game?.buzzerWinner || game?.status === 'revealed' || game?.status === 'game_over') {
        audioRef.current.pause();
      }
    }
  }, [game?.currentSong?.previewUrl, game?.status, game?.buzzerWinner]); // Key fix: listen to URL string

  // Skip Logic Watcher
  useEffect(() => {
    if (game?.status === 'playing' && game.skips && players.length > 0) {
      const activePlayerCount = players.length;
      const skipCount = game.skips.length;
      if ((skipCount / activePlayerCount) > 0.75) {
         giveUp(); // "Give up" effectively skips/reveals
      }
    }
  }, [game?.skips, players.length, game?.status]);


  // Gemini Verification Effect & Auto-Advance Logic
  useEffect(() => {
    if (game?.currentAnswer && !game?.answerVerified && !verification) {
      const verify = async () => {
        setVerification({ status: 'checking' });
        
        const apiKey = initialGeminiKey; 
        const res = await verifyAnswerWithGemini(game.currentAnswer, game.currentSong.movie, apiKey); 
        
        setVerification(res);
        
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', game.buzzerWinner.uid);
        const scoreToAdd = (typeof res.score === 'number') ? res.score : 0;

        await runTransaction(db, async (transaction) => {
           if (scoreToAdd > 0) {
               // Correct Answer: End Round
               transaction.update(gameRef, { 
                 answerVerified: true,
                 lastRoundScore: scoreToAdd,
                 status: 'revealed'
               });
               transaction.update(playerRef, { score: increment(scoreToAdd) });
           } else {
               // Incorrect Answer
               // Check if EVERYONE has now attempted
               const currentAttempts = game.attemptedThisRound || [];
               // We add the current buzzer winner to the list of attempts in our check logic (it's not in DB yet)
               const allAttempts = [...currentAttempts, game.buzzerWinner.uid];
               // Filter players list to only active ones if needed, but simple length check works for now
               const allFailed = allAttempts.length >= players.length;

               if (allFailed) {
                   // Everyone failed! Reveal answer.
                   transaction.update(gameRef, {
                       answerVerified: true,
                       lastRoundScore: 0,
                       status: 'revealed',
                       feedbackMessage: "Everyone missed it! The answer is revealed."
                   });
               } else {
                   // Just reset buzzer so others can try
                   transaction.update(gameRef, {
                       buzzerWinner: null,
                       buzzerLocked: false,
                       currentAnswer: null,
                       answerVerified: false,
                       attemptedThisRound: arrayUnion(game.buzzerWinner.uid),
                       feedbackMessage: `${game.buzzerWinner.username} guessed wrong! Keep listening!`
                   });
                   // Clear feedback after 3s (optional, but good UX)
                   setTimeout(() => updateDoc(gameRef, { feedbackMessage: null }), 3000);
               }
           }
        });
      };
      verify();
    }
  }, [game?.currentAnswer, game?.answerVerified, players.length]); // Added players.length dependency

  // Universal Auto-Advance Hook
  useEffect(() => {
      let timer;
      if (game?.status === 'revealed') {
          timer = setTimeout(() => {
              nextRound();
          }, 6000);
      }
      return () => clearTimeout(timer);
  }, [game?.status]);


  const startGame = async () => {
    setShowSettings(false);
    
    // Pick first song explicitly here to avoid stale state issues in nextRound
    const allSongs = CATEGORIES[category];
    const trackData = allSongs[Math.floor(Math.random() * allSongs.length)];
    
    // Determine media type for poster search
    const isTvCategory = category === 'modern_tv' || category === 'classic_tv';
    const mediaType = isTvCategory ? 'tv' : 'movie';
    
    // Fetch audio url for first song
    // Fetch Music and Poster in parallel
    const [musicData, posterUrl] = await Promise.all([
        searchItunes(`${trackData.title} ${trackData.artist} soundtrack`),
        searchMoviePoster(trackData.movie, mediaType, trackData.year)
    ]);

    const previewUrl = musicData?.previewUrl || null;
    // Prefer movie poster, fallback to album art. Always upscale.
    const coverArt = posterUrl || musicData?.artworkUrl100?.replace('100x100', '600x600') || null;

    // Reset all player scores
    const batch = writeBatch(db);
    players.forEach(p => {
        const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', p.id);
        batch.update(pRef, { score: 0 });
    });
    
    // Initial Game State
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    await batch.commit();

    // Trigger first round logic (reusing nextRound logic essentially, but we need to ensure state is set first)
    // We will just call nextRound which handles fetching and setting the song
    await setDoc(gameRef, {
      hostId: user.uid,
      status: 'playing',
      round: 0, // nextRound will increment this to 1
      totalRounds: totalRounds,
      playedSongs: [], 
      skips: [],
      winner: null,
      buzzerWinner: null,
      currentAnswer: null,
      answerVerified: false,
      currentSong: null,
      attemptedThisRound: [],
      feedbackMessage: null
    }, { merge: true });

    nextRound();
  };

  const nextRound = async () => {
    setVerification(null);
    
    // Check if Game Over (fetch fresh state if possible, but local state 'game' is usually reliable enough here)
    // We increment round at the end of this function, so if current round == total, we are done.
    if (game?.round >= totalRounds) {
        // Calculate winner
        const winner = players.length > 0 ? players[0] : null; 
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
            status: 'game_over',
            winner: winner ? { uid: winner.id, username: winner.username, score: winner.score, avatar: winner.avatar } : null
        });
        return;
    }

    // Filter used songs
    const allSongs = CATEGORIES[category];
    const playedSongs = game?.playedSongs || [];
    // Handle potential legacy string data just in case
    const usedTitles = playedSongs.map(s => (typeof s === 'string' ? s : s.title));
    let availableSongs = allSongs.filter(s => !usedTitles.includes(s.title));

    let selectedSong = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    // Determine media type for poster search
    const isTvCategory = category === 'modern_tv' || category === 'classic_tv';
    const mediaType = isTvCategory ? 'tv' : 'movie';

    // Retry loop to find a song with valid data (audio + image)
    while (!selectedSong && availableSongs.length > 0 && attempts < MAX_ATTEMPTS) {
        attempts++;
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const candidate = availableSongs[randomIndex];

        // Fetch Music and Poster in parallel
        const [musicData, posterUrl] = await Promise.all([
            searchItunes(`${candidate.title} ${candidate.artist} soundtrack`),
            searchMoviePoster(candidate.movie, mediaType, candidate.year)
        ]);

        // Check if we got a playable preview and at least some artwork
        if (musicData?.previewUrl && (posterUrl || musicData?.artworkUrl100)) {
            selectedSong = {
                ...candidate,
                previewUrl: musicData.previewUrl,
                // Prefer movie poster, fallback to album art. Always upscale.
                coverArt: posterUrl || musicData.artworkUrl100?.replace('100x100', '600x600')
            };
        } else {
            console.warn(`Skipping incomplete song data: ${candidate.title}`);
            // Remove bad candidate from local list so we don't pick it again immediately
            availableSongs.splice(randomIndex, 1);
        }
    }

    if (!selectedSong) {
        alert("Error: Could not find a valid song with audio/image after multiple attempts. Please try another category or restart.");
        return;
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentSong: selectedSong,
      buzzerWinner: null,
      currentAnswer: null,
      answerVerified: false,
      status: 'playing',
      round: increment(1),
      playedSongs: arrayUnion({
          title: selectedSong.title,
          artist: selectedSong.artist,
          movie: selectedSong.movie,
          coverArt: selectedSong.coverArt
      }),
      skips: [],
      attemptedThisRound: [], // Reset attempts
      feedbackMessage: null
    });
  };

  const giveUp = async () => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
       status: 'revealed',
       lastRoundScore: 0,
       buzzerWinner: null // No winner
     });
  };

  const handleNewGame = async () => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
          status: 'lobby',
          winner: null,
          currentSong: null,
          buzzerWinner: null
      });
      setShowSettings(true);
      setShowHistory(false);
  };
  
  // Helper to get player details
  const getPlayer = (uid) => players.find(p => p.id === uid);

  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6">Game Setup</h2>
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl w-full max-w-6xl border border-slate-700">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">GAME CODE</label>
            <div className="text-4xl font-mono font-black text-center bg-black/30 p-4 rounded-lg tracking-widest text-blue-400">
              {gameId}
            </div>
          </div>
          
          <div className="mt-6">
             <label className="block text-sm font-bold mb-2 text-slate-400">CATEGORY</label>
             <div className="grid grid-cols-2 gap-2 mb-4">
               {Object.keys(CATEGORIES).map(c => (
                 <button 
                   key={c}
                   onClick={() => setCategory(c)}
                   className={`p-2 rounded capitalize font-bold text-xs md:text-sm ${category === c ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                 >
                   {c.replace('_', ' ')}
                 </button>
               ))}
             </div>
             
             <label className="block text-sm font-bold mb-2 text-slate-400">NUMBER OF SONGS</label>
             <div className="flex gap-2">
                {[10, 25, 50].map(num => (
                    <button
                        key={num}
                        onClick={() => setTotalRounds(num)}
                        className={`flex-1 p-2 rounded font-bold ${totalRounds === num ? 'bg-green-600 ring-2 ring-green-400' : 'bg-slate-700'}`}
                    >
                        {num}
                    </button>
                ))}
             </div>
          </div>

          <div className="pt-4 border-t border-slate-700 mt-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Users size={18}/> Players Joined ({players.length})</h3>
            
            {/* FUN PLAYER GRID */}
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

          <button 
            onClick={startGame}
            disabled={players.length === 0}
            className="w-full py-4 mt-6 bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-xl hover:scale-105 transition-transform"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  const buzzerPlayer = game?.buzzerWinner ? getPlayer(game.buzzerWinner.uid) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col h-screen overflow-hidden">
       <audio ref={audioRef} loop />
       
       {/* Top Bar */}
       <div className="bg-slate-900 p-4 shadow-lg flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
             <div className="bg-blue-600 px-2 py-1 md:px-3 md:py-1 rounded font-bold text-xs md:text-sm whitespace-nowrap">R {game?.round} / {game?.totalRounds}</div>
             <div className="text-slate-400 font-mono text-lg md:text-xl">{gameId}</div>
          </div>
          <div className="flex gap-2">
             <button onClick={giveUp} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700">Skip Song</button>
             <button onClick={() => setShowSettings(true)} className="text-xs text-slate-500 hover:text-white">Settings</button>
          </div>
       </div>

       {/* Main Content Area - Flex Column on Mobile, Row on Desktop */}
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full mx-auto">
          
          {/* Main Stage (Game Area) */}
          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto w-full">
             
             {/* Dynamic Background Art */}
             {/* Only show art if revealed or game over. Otherwise show spoiler-free gradient */}
             {(game?.status === 'revealed' || game?.status === 'game_over') && game?.currentSong?.coverArt ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl transition-all duration-1000"
                  style={{ backgroundImage: `url(${game.currentSong.coverArt})`}}
                />
             ) : (
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600 rounded-full blur-[100px] animate-pulse"></div>
                </div>
             )}

             <div className="z-10 w-full max-w-4xl text-center">
                
                {/* Status Indicator */}
                <div className="mb-4 md:mb-8">
                   {/* Feedback Toast */}
                   {game?.feedbackMessage && (
                       <div className="absolute top-0 left-0 right-0 p-4 flex justify-center z-50 animate-bounce-short">
                           <div className="bg-red-600 text-white px-4 md:px-6 py-2 rounded-full font-bold shadow-lg text-sm md:text-base">
                               {game.feedbackMessage}
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
                   {game?.status === 'playing' && !game?.buzzerWinner && (
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

                   {game?.buzzerWinner && game?.status !== 'revealed' && (
                     <div className="flex flex-col items-center text-yellow-400 animate-bounce-short pt-8">
                        {buzzerPlayer?.avatar ? (
                            <div className="mb-6 bg-slate-800 p-2 rounded-full shadow-2xl">
                              <img src={buzzerPlayer.avatar} className="w-56 h-56 md:w-80 md:h-80 rounded-full border-8 border-yellow-400 bg-slate-900 object-cover" />
                            </div>
                        ) : (
                            <AlertCircle size={80} className="mb-6 md:w-32 md:h-32" />
                        )}
                        <h2 className="text-4xl md:text-6xl font-black mb-4">{game.buzzerWinner.username}</h2>
                        <p className="text-white text-xl md:text-2xl animate-pulse">Is Guessing...</p>
                        {game.currentAnswer && <p className="mt-6 bg-slate-800 px-6 py-3 rounded-xl text-xl">Processing: "{game.currentAnswer}"</p>}
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
                        
                        <div className={`p-4 rounded-xl font-bold text-lg md:text-xl mb-6 flex flex-col items-center gap-2 ${game.lastRoundScore > 0 ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-red-600/20 text-red-400 border border-red-600/50'}`}>
                           {buzzerPlayer?.avatar && (
                               <img src={buzzerPlayer.avatar} className="w-12 h-12 rounded-full border-2 border-current bg-slate-800 object-cover" />
                           )}
                           <span>
                               {game.lastRoundScore > 0 
                                 ? `+${game.lastRoundScore} Points to ${game.buzzerWinner?.username || 'Winner'}` 
                                 : (game.buzzerWinner ? `${game.buzzerWinner.username} Missed It!` : (game.feedbackMessage?.includes("Everyone") ? "Everyone Missed!" : "Time's Up!"))}
                           </span>
                        </div>
                        {/* Display error reason if score is 0 and there's an error message */}
                        {game.lastRoundScore === 0 && verification?.reason && verification.reason.includes("Error") && (
                            <p className="text-red-300 text-sm mb-4 bg-red-900/50 p-2 rounded">{verification.reason}</p>
                        )}

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
  const [showHistory, setShowHistory] = useState(false); // Player local history toggle
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    // Game Listener
    const unsubGame = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGame(data);
        if (data.status === 'playing' && !data.buzzerWinner && hasAnswered) {
           setAnswer("");
           setHasAnswered(false);
        }
        // If game resets to lobby, reset history view
        if (data.status === 'lobby') setShowHistory(false);
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
  }, [gameId, hasAnswered, user.uid]);

  // Timer Effect
  useEffect(() => {
    if (game?.buzzerWinner?.uid === user.uid && game?.status === 'playing' && !hasAnswered) {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(t => t - 1), 1000);
            return () => clearTimeout(timerId);
        } else {
            // Time up!
            submitAnswer("TIMEOUT");
        }
    } else {
        // Reset if no longer my turn
        setTimeLeft(10);
    }
  }, [timeLeft, game?.buzzerWinner, user.uid, game?.status, hasAnswered]);

  const buzzIn = async () => {
    if (!game || game.buzzerWinner || game.status !== 'playing') return;
    
    await runTransaction(db, async (transaction) => {
      const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
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

  const submitAnswer = async (forceContent = null) => {
    const content = forceContent !== null ? forceContent : answer;
    if (!content.trim()) return;

    setHasAnswered(true);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentAnswer: content
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

  const isLockedOut = game.attemptedThisRound?.includes(user.uid);
  const isMe = game.buzzerWinner?.uid === user.uid;
  
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

  // 2. Locked Out (Guessed Wrong already)
  if (isLockedOut && !game.buzzerWinner && game.status === 'playing') {
       return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Incorrect!</h1>
            <p className="text-slate-400">You are locked out until the next song.</p>
        </div>
       );
  }

  // 3. Someone Else Buzzed
  if (game.buzzerWinner && !isMe && game.status !== 'revealed') {
    return (
      <div className="min-h-screen bg-red-900/20 flex flex-col items-center justify-center p-6 text-center">
         <div className="p-6 bg-red-600 rounded-full mb-6 animate-pulse">
           <Smartphone size={48} className="text-white"/>
         </div>
         <h1 className="text-2xl md:text-3xl font-black text-white mb-2">{game.buzzerWinner.username} LOCKED IN!</h1>
         <p className="text-red-200">Wait for the next song...</p>
      </div>
    );
  }

  // 4. I Buzzed! Input time.
  if (isMe && game.status !== 'revealed') {
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2 animate-bounce">YOU'RE UP!</h1>
        <div className="text-6xl font-mono font-bold text-yellow-400 mb-6">{timeLeft}</div>
        <div className="w-full max-w-4xl space-y-4">
           {!hasAnswered ? (
             <>
               <input 
                 autoFocus
                 className="w-full bg-white p-4 rounded-xl text-black text-xl font-bold text-center uppercase placeholder:text-gray-500"
                 placeholder="MOVIE TITLE?"
                 value={answer}
                 onChange={e => setAnswer(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submitAnswer()}
               />
               <div className="flex gap-2">
                 <button 
                  onClick={() => submitAnswer()}
                  className="flex-1 bg-white text-green-900 py-4 rounded-xl font-black text-xl shadow-xl active:scale-95 transition-transform"
                 >
                   SUBMIT
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

  // 5. Reveal / Result
  if (game.status === 'revealed') {
    const scoreText = game.lastRoundScore > 0 ? `+${game.lastRoundScore}` : "0";
    const winnerText = game.lastRoundScore > 0 ? "Correct!" : "Wrong!";
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
         <div className="mb-6 relative w-full flex justify-center">
            <img 
                src={game.currentSong.coverArt || "https://placehold.co/400x400/1e293b/ffffff?text=Soundtrack"} 
                className="max-h-[50vh] w-auto max-w-full rounded-xl shadow-2xl object-contain" 
            />
            <div className="absolute -bottom-4 bg-blue-600 text-white p-3 rounded-full shadow-lg font-bold">
               {game.lastRoundScore > 0 ? <Check size={24}/> : <X size={24}/>}
            </div>
         </div>
         <h2 className="text-2xl font-bold mb-1 text-white">{game.currentSong.movie}</h2>
         <p className="text-slate-400 mb-8">{game.currentSong.title}</p>
         
         {isMe && (
           <div className={`text-3xl md:text-4xl font-black ${game.lastRoundScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
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

  // 6. Default Buzzer State
  const votedSkip = game.skips?.includes(user.uid);
  
  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col relative h-screen">
       {/* Player HUD */}
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
          <button 
             onClick={buzzIn}
             className="w-56 h-56 md:w-80 md:h-80 rounded-full bg-red-600 border-b-8 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.5)] active:border-b-0 active:translate-y-2 active:shadow-none transition-all flex flex-col items-center justify-center group"
          >
             <span className="text-5xl md:text-7xl font-black text-red-900 group-hover:text-red-100 transition-colors">BUZZ</span>
          </button>
          <p className="mt-8 text-slate-400 font-medium animate-pulse text-center">Wait for the music...</p>
       </div>

       {/* Bottom Actions */}
       <div className="p-4 md:p-6 shrink-0 safe-area-bottom">
           <button 
             onClick={voteSkip}
             disabled={votedSkip}
             className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${votedSkip ? 'bg-slate-700 text-slate-500' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
           >
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

  // Auth Init
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
      // Add player to subcollection
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

  // Initial State: user clicked "Host" but hasn't created game yet
  if (mode === 'host' && !gameId) {
    handleCreateGame(); // Auto create
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Creating Room...</div>;
  }

  return <Landing setMode={setMode} joinGame={handleJoinGame} />;
}