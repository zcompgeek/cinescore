import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
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
import { Volume2, Music, Trophy, Users, SkipForward, AlertCircle, Smartphone, Check, X, FastForward, RefreshCw, Star } from 'lucide-react';

// --- CONFIGURATION & ENVIRONMENT SETUP ---
const getEnvironmentConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return {
      firebaseConfig: JSON.parse(__firebase_config),
      appId: typeof __app_id !== 'undefined' ? __app_id : 'default-app-id',
      geminiKey: "" 
    };
  }

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
  } catch (e) {}

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TRIVIA DATASETS ---
const CATEGORIES = {
  all_stars: [ // Target: Under 40 (Millennials/Gen Z iconic hits)
    { title: "Hedwig's Theme", artist: "John Williams", movie: "Harry Potter" },
    { title: "My Heart Will Go On", artist: "Celine Dion", movie: "Titanic" },
    { title: "All Star", artist: "Smash Mouth", movie: "Shrek" },
    { title: "Circle of Life", artist: "Elton John", movie: "The Lion King" },
    { title: "Let It Go", artist: "Idina Menzel", movie: "Frozen" },
    { title: "Lose Yourself", artist: "Eminem", movie: "8 Mile" },
    { title: "I Will Always Love You", artist: "Whitney Houston", movie: "The Bodyguard" },
    { title: "See You Again", artist: "Wiz Khalifa", movie: "Furious 7" },
    { title: "A Thousand Years", artist: "Christina Perri", movie: "Twilight" },
    { title: "Main Title", artist: "John Williams", movie: "Star Wars" },
    { title: "The Imperial March", artist: "John Williams", movie: "Star Wars" },
    { title: "He's a Pirate", artist: "Klaus Badelt", movie: "Pirates of the Caribbean" },
    { title: "Theme from Jurassic Park", artist: "John Williams", movie: "Jurassic Park" },
    { title: "The Avengers", artist: "Alan Silvestri", movie: "The Avengers" },
    { title: "Spider-Man Main Title", artist: "Danny Elfman", movie: "Spider-Man" },
    { title: "Sunflower", artist: "Post Malone", movie: "Spider-Man: Into the Spider-Verse" },
    { title: "Shallow", artist: "Lady Gaga", movie: "A Star Is Born" },
    { title: "Happy", artist: "Pharrell Williams", movie: "Despicable Me 2" },
    { title: "Can't Stop the Feeling!", artist: "Justin Timberlake", movie: "Trolls" },
    { title: "Everything Is Awesome", artist: "Tegan and Sara", movie: "The Lego Movie" },
    { title: "How Far I'll Go", artist: "Auli'i Cravalho", movie: "Moana" },
    { title: "You've Got a Friend in Me", artist: "Randy Newman", movie: "Toy Story" },
    { title: "Life is a Highway", artist: "Rascal Flatts", movie: "Cars" },
    { title: "I'm Just Ken", artist: "Ryan Gosling", movie: "Barbie" },
    { title: "Dance The Night", artist: "Dua Lipa", movie: "Barbie" },
    { title: "City of Stars", artist: "Ryan Gosling", movie: "La La Land" },
    { title: "The Greatest Show", artist: "Hugh Jackman", movie: "The Greatest Showman" },
    { title: "Rewrite The Stars", artist: "Zac Efron", movie: "The Greatest Showman" },
    { title: "Skyfall", artist: "Adele", movie: "Skyfall" },
    { title: "No Time To Die", artist: "Billie Eilish", movie: "No Time To Die" },
    { title: "Mission: Impossible", artist: "Lalo Schifrin", movie: "Mission: Impossible" },
    { title: "Cornfield Chase", artist: "Hans Zimmer", movie: "Interstellar" },
    { title: "Time", artist: "Hans Zimmer", movie: "Inception" },
    { title: "The Dark Knight Theme", artist: "Hans Zimmer", movie: "The Dark Knight" },
    { title: "Concerning Hobbits", artist: "Howard Shore", movie: "Lord of the Rings" },
    { title: "Theme from Schindler's List", artist: "John Williams", movie: "Schindler's List" },
    { title: "Now We Are Free", artist: "Hans Zimmer", movie: "Gladiator" },
    { title: "I See You", artist: "Leona Lewis", movie: "Avatar" },
    { title: "Danger Zone", artist: "Kenny Loggins", movie: "Top Gun" },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky" },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters" },
    { title: "Men in Black", artist: "Will Smith", movie: "Men in Black" },
    { title: "Gangsta's Paradise", artist: "Coolio", movie: "Dangerous Minds" },
    { title: "Kiss Me", artist: "Sixpence None The Richer", movie: "She's All That" },
    { title: "Don't You (Forget About Me)", artist: "Simple Minds", movie: "The Breakfast Club" },
    { title: "Footloose", artist: "Kenny Loggins", movie: "Footloose" },
    { title: "We Don't Talk About Bruno", artist: "Encanto Cast", movie: "Encanto" },
    { title: "Remember Me", artist: "Miguel", movie: "Coco" },
    { title: "Hakuna Matata", artist: "Nathan Lane", movie: "The Lion King" },
    { title: "Under the Sea", artist: "Samuel E. Wright", movie: "The Little Mermaid" }
  ],
  classics: [ // Target: Ages 40-70 (Golden Era, 70s, 80s hits)
    { title: "The Godfather Waltz", artist: "Nino Rota", movie: "The Godfather" },
    { title: "Tara's Theme", artist: "Max Steiner", movie: "Gone with the Wind" },
    { title: "Over the Rainbow", artist: "Judy Garland", movie: "The Wizard of Oz" },
    { title: "Singin' in the Rain", artist: "Gene Kelly", movie: "Singin' in the Rain" },
    { title: "As Time Goes By", artist: "Dooley Wilson", movie: "Casablanca" },
    { title: "The Sound of Music", artist: "Julie Andrews", movie: "The Sound of Music" },
    { title: "Moon River", artist: "Henry Mancini", movie: "Breakfast at Tiffany's" },
    { title: "Mrs. Robinson", artist: "Simon & Garfunkel", movie: "The Graduate" },
    { title: "Raindrops Keep Fallin' on My Head", artist: "B.J. Thomas", movie: "Butch Cassidy and the Sundance Kid" },
    { title: "Theme from Shaft", artist: "Isaac Hayes", movie: "Shaft" },
    { title: "Stayin' Alive", artist: "Bee Gees", movie: "Saturday Night Fever" },
    { title: "You're The One That I Want", artist: "John Travolta", movie: "Grease" },
    { title: "Gonna Fly Now", artist: "Bill Conti", movie: "Rocky" },
    { title: "Take My Breath Away", artist: "Berlin", movie: "Top Gun" },
    { title: "The Power of Love", artist: "Huey Lewis and the News", movie: "Back to the Future" },
    { title: "Ghostbusters", artist: "Ray Parker Jr.", movie: "Ghostbusters" },
    { title: "Footloose", artist: "Kenny Loggins", movie: "Footloose" },
    { title: "Flashdance... What a Feeling", artist: "Irene Cara", movie: "Flashdance" },
    { title: "Time of My Life", artist: "Bill Medley", movie: "Dirty Dancing" },
    { title: "Unchained Melody", artist: "Righteous Brothers", movie: "Ghost" },
    { title: "Against All Odds", artist: "Phil Collins", movie: "Against All Odds" },
    { title: "Endless Love", artist: "Diana Ross", movie: "Endless Love" },
    { title: "Up Where We Belong", artist: "Joe Cocker", movie: "An Officer and a Gentleman" },
    { title: "Fame", artist: "Irene Cara", movie: "Fame" },
    { title: "9 to 5", artist: "Dolly Parton", movie: "9 to 5" },
    { title: "Eye of the Tiger", artist: "Survivor", movie: "Rocky III" },
    { title: "Danger Zone", artist: "Kenny Loggins", movie: "Top Gun" },
    { title: "Don't You (Forget About Me)", artist: "Simple Minds", movie: "The Breakfast Club" },
    { title: "St. Elmo's Fire", artist: "John Parr", movie: "St. Elmo's Fire" },
    { title: "Axel F", artist: "Harold Faltermeyer", movie: "Beverly Hills Cop" },
    { title: "Chariots of Fire", artist: "Vangelis", movie: "Chariots of Fire" },
    { title: "Raiders March", artist: "John Williams", movie: "Indiana Jones" },
    { title: "Flying Theme", artist: "John Williams", movie: "E.T." },
    { title: "Main Title", artist: "John Williams", movie: "Jaws" },
    { title: "The Pink Panther Theme", artist: "Henry Mancini", movie: "The Pink Panther" },
    { title: "Goldfinger", artist: "Shirley Bassey", movie: "Goldfinger" },
    { title: "Live and Let Die", artist: "Paul McCartney", movie: "Live and Let Die" },
    { title: "Nobody Does It Better", artist: "Carly Simon", movie: "The Spy Who Loved Me" },
    { title: "For Your Eyes Only", artist: "Sheena Easton", movie: "For Your Eyes Only" },
    { title: "A View to a Kill", artist: "Duran Duran", movie: "A View to a Kill" },
    { title: "Windmills of Your Mind", artist: "Noel Harrison", movie: "The Thomas Crown Affair" },
    { title: "Everybody's Talkin'", artist: "Harry Nilsson", movie: "Midnight Cowboy" },
    { title: "Born to be Wild", artist: "Steppenwolf", movie: "Easy Rider" },
    { title: "Stand By Me", artist: "Ben E. King", movie: "Stand By Me" },
    { title: "Twist and Shout", artist: "The Beatles", movie: "Ferris Bueller's Day Off" },
    { title: "Old Time Rock and Roll", artist: "Bob Seger", movie: "Risky Business" },
    { title: "I'm Alright", artist: "Kenny Loggins", movie: "Caddyshack" },
    { title: "Soul Man", artist: "Blues Brothers", movie: "The Blues Brothers" },
    { title: "Bohemian Rhapsody", artist: "Queen", movie: "Wayne's World" },
    { title: "My Girl", artist: "The Temptations", movie: "My Girl" }
  ],
  modern_tv: [ // Last 20 Years
    { title: "Game of Thrones Main Title", artist: "Ramin Djawadi", movie: "Game of Thrones" },
    { title: "Stranger Things Theme", artist: "Kyle Dixon", movie: "Stranger Things" },
    { title: "Succession (Main Title)", artist: "Nicholas Britell", movie: "Succession" },
    { title: "The White Lotus Theme", artist: "Cristobal Tapia de Veer", movie: "The White Lotus" },
    { title: "The Mandalorian", artist: "Ludwig Goransson", movie: "The Mandalorian" },
    { title: "Breaking Bad Theme", artist: "Dave Porter", movie: "Breaking Bad" },
    { title: "Better Call Saul Theme", artist: "Little Barrie", movie: "Better Call Saul" },
    { title: "The Office (Main Theme)", artist: "The Scrantones", movie: "The Office" },
    { title: "Parks and Recreation", artist: "Gaby Moreno", movie: "Parks and Recreation" },
    { title: "Big Bang Theory Theme", artist: "Barenaked Ladies", movie: "The Big Bang Theory" },
    { title: "Modern Family Theme", artist: "Gabriel Mann", movie: "Modern Family" },
    { title: "Brooklyn Nine-Nine", artist: "Dan Marocco", movie: "Brooklyn Nine-Nine" },
    { title: "How I Met Your Mother", artist: "The Solids", movie: "How I Met Your Mother" },
    { title: "Mad Men (A Beautiful Mine)", artist: "RJD2", movie: "Mad Men" },
    { title: "Downton Abbey Theme", artist: "John Lunn", movie: "Downton Abbey" },
    { title: "Sherlock Theme", artist: "David Arnold", movie: "Sherlock" },
    { title: "Doctor Who Theme", artist: "Murray Gold", movie: "Doctor Who" },
    { title: "Westworld Main Title", artist: "Ramin Djawadi", movie: "Westworld" },
    { title: "Toss A Coin To Your Witcher", artist: "Sonya Belousova", movie: "The Witcher" },
    { title: "Enemy", artist: "Imagine Dragons", movie: "Arcane" },
    { title: "Yellowstone Theme", artist: "Brian Tyler", movie: "Yellowstone" },
    { title: "Ted Lasso Theme", artist: "Marcus Mumford", movie: "Ted Lasso" },
    { title: "Severance Main Title", artist: "Theodore Shapiro", movie: "Severance" },
    { title: "Squid Game (Way Back Then)", artist: "Jung Jaeil", movie: "Squid Game" },
    { title: "Wednesday Main Titles", artist: "Danny Elfman", movie: "Wednesday" },
    { title: "You've Got Time", artist: "Regina Spektor", movie: "Orange Is the New Black" },
    { title: "Cosy in the Rocket", artist: "Psapp", movie: "Grey's Anatomy" },
    { title: "How to Save a Life", artist: "The Fray", movie: "Grey's Anatomy" },
    { title: "Chasing Cars", artist: "Snow Patrol", movie: "Grey's Anatomy" },
    { title: "Teardrop", artist: "Massive Attack", movie: "House" },
    { title: "Woke Up This Morning", artist: "Alabama 3", movie: "The Sopranos" },
    { title: "The Walking Dead Theme", artist: "Bear McCreary", movie: "The Walking Dead" },
    { title: "Dexter Main Title", artist: "Rolfe Kent", movie: "Dexter" },
    { title: "True Blood (Bad Things)", artist: "Jace Everett", movie: "True Blood" },
    { title: "Shameless", artist: "The High Strung", movie: "Shameless" },
    { title: "Superman", artist: "Lazlo Bane", movie: "Scrubs" },
    { title: "I Don't Want to Be", artist: "Gavin DeGraw", movie: "One Tree Hill" },
    { title: "California", artist: "Phantom Planet", movie: "The O.C." },
    { title: "Save Me", artist: "Remy Zero", movie: "Smallville" },
    { title: "Where You Lead", artist: "Carole King", movie: "Gilmore Girls" },
    { title: "Boss of Me", artist: "They Might Be Giants", movie: "Malcolm in the Middle" },
    { title: "Unwritten", artist: "Natasha Bedingfield", movie: "The Hills" },
    { title: "Leave It All to Me", artist: "Miranda Cosgrove", movie: "iCarly" },
    { title: "Make It Shine", artist: "Victoria Justice", movie: "Victorious" },
    { title: "The Best of Both Worlds", artist: "Miley Cyrus", movie: "Hannah Montana" },
    { title: "Everything Is Not What It Seems", artist: "Selena Gomez", movie: "Wizards of Waverly Place" },
    { title: "Phineas and Ferb Theme", artist: "Bowling For Soup", movie: "Phineas and Ferb" },
    { title: "SpongeBob SquarePants Theme", artist: "Patrick Pinney", movie: "SpongeBob SquarePants" },
    { title: "Adventure Time", artist: "Pendleton Ward", movie: "Adventure Time" },
    { title: "Rick and Morty Theme", artist: "Ryan Elder", movie: "Rick and Morty" }
  ],
  classic_tv: [ // 20-50 Years Ago (70s, 80s, 90s)
    { title: "I'll Be There for You", artist: "The Rembrandts", movie: "Friends" },
    { title: "Seinfeld Theme", artist: "Jonathan Wolff", movie: "Seinfeld" },
    { title: "Where Everybody Knows Your Name", artist: "Gary Portnoy", movie: "Cheers" },
    { title: "Thank You for Being a Friend", artist: "Cynthia Fee", movie: "The Golden Girls" },
    { title: "Everywhere You Look", artist: "Jesse Frederick", movie: "Full House" },
    { title: "Fresh Prince of Bel-Air", artist: "Will Smith", movie: "The Fresh Prince of Bel-Air" },
    { title: "Saved by the Bell", artist: "Michael Damian", movie: "Saved by the Bell" },
    { title: "The Simpsons Theme", artist: "Danny Elfman", movie: "The Simpsons" },
    { title: "The X-Files", artist: "Mark Snow", movie: "The X-Files" },
    { title: "Twin Peaks Theme", artist: "Angelo Badalamenti", movie: "Twin Peaks" },
    { title: "Law & Order", artist: "Mike Post", movie: "Law & Order" },
    { title: "Suicide Is Painless", artist: "Johnny Mandel", movie: "M*A*S*H" },
    { title: "Angela", artist: "Bob James", movie: "Taxi" },
    { title: "Movin' On Up", artist: "Ja'net Dubois", movie: "The Jeffersons" },
    { title: "Good Times", artist: "Jim Gilstrap", movie: "Good Times" },
    { title: "Sanford and Son Theme", artist: "Quincy Jones", movie: "Sanford and Son" },
    { title: "Those Were the Days", artist: "Carroll O'Connor", movie: "All in the Family" },
    { title: "Love is All Around", artist: "Sonny Curtis", movie: "The Mary Tyler Moore Show" },
    { title: "Happy Days", artist: "Pratt & McClain", movie: "Happy Days" },
    { title: "Making Our Dreams Come True", artist: "Cyndi Grecco", movie: "Laverne & Shirley" },
    { title: "Come and Knock on Our Door", artist: "Ray Charles", movie: "Three's Company" },
    { title: "It Takes Diff'rent Strokes", artist: "Alan Thicke", movie: "Diff'rent Strokes" },
    { title: "Facts of Life", artist: "Gloria Loring", movie: "The Facts of Life" },
    { title: "As Long As We Got Each Other", artist: "B.J. Thomas", movie: "Growing Pains" },
    { title: "Without Us", artist: "Johnny Mathis", movie: "Family Ties" },
    { title: "Believe It or Not", artist: "Joey Scarbury", movie: "The Greatest American Hero" },
    { title: "Theme from Magnum P.I.", artist: "Mike Post", movie: "Magnum, P.I." },
    { title: "Miami Vice Theme", artist: "Jan Hammer", movie: "Miami Vice" },
    { title: "Knight Rider Theme", artist: "Stu Phillips", movie: "Knight Rider" },
    { title: "The A-Team Theme", artist: "Mike Post", movie: "The A-Team" },
    { title: "MacGyver Theme", artist: "Randy Edelman", movie: "MacGyver" },
    { title: "Hawaii Five-O", artist: "The Ventures", movie: "Hawaii Five-O" },
    { title: "Mission: Impossible", artist: "Lalo Schifrin", movie: "Mission: Impossible (TV)" },
    { title: "Batman Theme", artist: "Neal Hefti", movie: "Batman (1966)" },
    { title: "The Brady Bunch", artist: "Peppermint Trolley Company", movie: "The Brady Bunch" },
    { title: "The Addams Family", artist: "Vic Mizzy", movie: "The Addams Family" },
    { title: "The Munsters", artist: "Jack Marshall", movie: "The Munsters" },
    { title: "I Dream of Jeannie", artist: "Hugo Montenegro", movie: "I Dream of Jeannie" },
    { title: "Bewitched", artist: "Howard Greenfield", movie: "Bewitched" },
    { title: "Gilligan's Island", artist: "The Wellingtons", movie: "Gilligan's Island" },
    { title: "Scooby-Doo, Where Are You!", artist: "Larry Marks", movie: "Scooby-Doo" },
    { title: "The Flintstones", artist: "Hoyt Curtin", movie: "The Flintstones" },
    { title: "The Jetsons", artist: "Hoyt Curtin", movie: "The Jetsons" },
    { title: "DuckTales Theme", artist: "Jeff Pescetto", movie: "DuckTales" },
    { title: "Teenage Mutant Ninja Turtles", artist: "Chuck Lorre", movie: "Teenage Mutant Ninja Turtles" },
    { title: "Pokemon Theme", artist: "Jason Paige", movie: "Pokemon" },
    { title: "Mighty Morphin Power Rangers", artist: "Ron Wasserman", movie: "Power Rangers" },
    { title: "Baywatch Theme", artist: "Jimi Jamison", movie: "Baywatch" },
    { title: "Bad Boys", artist: "Inner Circle", movie: "Cops" },
    { title: "In the Street", artist: "Cheap Trick", movie: "That '70s Show" }
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

// --- COMPONENTS ---

// 1. LANDING SCREEN
const Landing = ({ setMode, joinGame }) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="z-10 text-center max-w-md md:max-w-2xl w-full">
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
  const [category, setCategory] = useState("all_stars");
  const [totalRounds, setTotalRounds] = useState(10);
  const [showSettings, setShowSettings] = useState(true);
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

  // Audio Player Effect
  useEffect(() => {
    if (audioRef.current) {
      if (game?.status === 'playing' && game?.currentSong?.previewUrl && !game?.buzzerWinner) {
        audioRef.current.src = game.currentSong.previewUrl;
        audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
      } else if (game?.buzzerWinner || game?.status === 'revealed' || game?.status === 'game_over') {
        audioRef.current.pause();
      }
    }
  }, [game?.currentSong, game?.status, game?.buzzerWinner]);

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


  // Gemini Verification Effect & Auto-Advance
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
               // Incorrect Answer: Reset buzzer so others can try
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
        });

        // AUTO ADVANCE if correct
        if (scoreToAdd > 0) {
            setTimeout(() => nextRound(), 3000);
        }
      };
      verify();
    }
  }, [game?.currentAnswer, game?.answerVerified]);


  const startGame = async () => {
    setShowSettings(false);
    
    // Reset all player scores
    const batch = writeBatch(db);
    players.forEach(p => {
        const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', p.id);
        batch.update(pRef, { score: 0 });
    });
    
    // Update Game State
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    batch.update(gameRef, {
      status: 'playing',
      round: 0,
      totalRounds: totalRounds,
      playedSongs: [], // Track history
      skips: [],
      winner: null,
      buzzerWinner: null,
      currentAnswer: null,
      answerVerified: false,
      currentSong: null,
      attemptedThisRound: [],
      feedbackMessage: null
    });
    
    await batch.commit();
    nextRound();
  };

  const nextRound = async () => {
    setVerification(null);
    
    // Check if Game Over
    if (game?.round >= game?.totalRounds) {
        // Calculate winner
        const winner = players.length > 0 ? players[0] : null; 
        
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
            status: 'game_over',
            winner: winner ? { uid: winner.id, username: winner.username, score: winner.score } : null
        });
        return;
    }

    // Filter used songs
    const allSongs = CATEGORIES[category];
    const usedTitles = game?.playedSongs || [];
    const availableSongs = allSongs.filter(s => !usedTitles.includes(s.title));

    if (availableSongs.length === 0) {
        alert("Ran out of unique songs in this category!");
        return;
    }

    const trackData = availableSongs[Math.floor(Math.random() * availableSongs.length)];
    
    // Fetch audio url
    const itunesData = await searchItunes(`${trackData.title} ${trackData.artist} soundtrack`);
    const previewUrl = itunesData?.previewUrl || null;
    const coverArt = itunesData?.artworkUrl100?.replace('100x100', '600x600') || null;

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentSong: { ...trackData, previewUrl, coverArt },
      buzzerWinner: null,
      currentAnswer: null,
      answerVerified: false,
      status: 'playing',
      round: increment(1),
      playedSongs: arrayUnion(trackData.title),
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
  };

  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-6">Game Setup</h2>
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl max-w-lg md:max-w-3xl w-full space-y-6 border border-slate-700">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-400">GAME CODE</label>
            <div className="text-4xl font-mono font-black text-center bg-black/30 p-4 rounded-lg tracking-widest text-blue-400">
              {gameId}
            </div>
          </div>
          
          <div>
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
       <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Main Stage (Game Area) */}
          <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
             
             {/* Dynamic Background Art */}
             {game?.currentSong?.coverArt && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl transition-all duration-1000"
                  style={{ backgroundImage: `url(${game.currentSong.coverArt})`}}
                />
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
                     <div className="flex flex-col items-center text-yellow-400 animate-bounce-short">
                        <AlertCircle size={48} className="mb-4 md:w-16 md:h-16" />
                        <h2 className="text-3xl md:text-4xl font-black">{game.buzzerWinner.username} BUZZED!</h2>
                        <p className="text-white mt-2 text-lg">Waiting for answer...</p>
                        {game.currentAnswer && <p className="mt-4 bg-slate-800 px-4 py-2 rounded">Processing: "{game.currentAnswer}"</p>}
                     </div>
                   )}

                   {game?.status === 'revealed' && (
                     <div className="bg-slate-900/90 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm">
                        <div className="mb-6">
                           <img src={game.currentSong.coverArt} className="w-32 h-32 md:w-48 md:h-48 object-cover rounded mx-auto shadow-lg mb-4" />
                           <h2 className="text-xl md:text-2xl font-bold text-white">{game.currentSong.movie}</h2>
                           <p className="text-blue-400 text-base md:text-lg">{game.currentSong.title}</p>
                           <p className="text-slate-500 text-sm md:text-base">{game.currentSong.artist}</p>
                        </div>
                        
                        <div className={`p-4 rounded-xl font-bold text-lg md:text-xl mb-6 ${game.lastRoundScore > 0 ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-red-600/20 text-red-400 border border-red-600/50'}`}>
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
                          className="px-6 py-3 md:px-8 md:py-3 bg-white text-black font-bold rounded-full hover:scale-110 transition-transform flex items-center gap-2 mx-auto"
                        >
                          Next Round <SkipForward size={20}/>
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
             <div className="space-y-2 md:space-y-3 overflow-y-auto flex-1 pb-2">
               {players.map((p, idx) => (
                 <div key={p.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg ${idx === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-transparent border border-yellow-600/30' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                       <span className={`font-mono font-bold w-6 text-center ${idx===0 ? 'text-yellow-500' : 'text-slate-500'}`}>#{idx+1}</span>
                       <span className="font-semibold text-sm md:text-base truncate max-w-[120px]">{p.username}</span>
                    </div>
                    <span className="font-bold text-blue-400 text-sm md:text-base">{p.score}</span>
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
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);

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
      }
    });

    // My Score Listener
    const unsubPlayer = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId, 'players', user.uid), (snap) => {
        if (snap.exists()) setMyScore(snap.data().score);
    });

    return () => { unsubGame(); unsubPlayer(); };
  }, [gameId, hasAnswered, user.uid]);

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

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setHasAnswered(true);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      currentAnswer: answer
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
       const isWinner = game.winner?.uid === user.uid;
       if (isWinner) {
           return (
               <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-yellow-900 flex flex-col items-center justify-center p-6 text-center text-white">
                   <Trophy size={80} className="text-yellow-200 mb-6 animate-bounce md:w-32 md:h-32" />
                   <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-xl">VICTORY!</h1>
                   <div className="text-xl md:text-2xl font-bold bg-black/30 px-8 py-4 rounded-xl">
                       Final Score: {myScore}
                   </div>
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
                   <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm">
                       <div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Winner</div>
                       <div className="text-2xl md:text-3xl font-bold text-yellow-500 mb-6">{game.winner?.username}</div>
                       
                       <div className="border-t border-slate-700 pt-6">
                           <div className="text-slate-400 text-sm uppercase font-bold tracking-widest mb-2">Your Score</div>
                           <div className="text-2xl font-bold">{myScore}</div>
                       </div>
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
        <h1 className="text-3xl md:text-4xl font-black text-white mb-8 animate-bounce">YOU'RE UP!</h1>
        <div className="w-full max-w-sm space-y-4">
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
                  onClick={submitAnswer}
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
         <div className="mb-6 relative">
            <img src={game.currentSong.coverArt || "https://placehold.co/400x400/1e293b/ffffff?text=Soundtrack"} className="w-48 h-48 md:w-64 md:h-64 rounded-xl shadow-2xl" />
            <div className="absolute -bottom-4 -right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg font-bold">
               {game.lastRoundScore > 0 ? <Check size={24}/> : <X size={24}/>}
            </div>
         </div>
         <h2 className="text-2xl font-bold mb-1">{game.currentSong.movie}</h2>
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
           <div>
               <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Score</div>
               <div className="text-xl font-black text-blue-400">{myScore}</div>
           </div>
           <div className="text-center">
               <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Room</div>
               <div className="font-mono text-lg">{gameId}</div>
           </div>
           <div className="text-right">
               <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest">Song</div>
               <div className="text-xl font-bold">{game.round}/{game.totalRounds}</div>
           </div>
       </div>

       {game.feedbackMessage && (
           <div className="absolute top-20 left-0 right-0 p-4 flex justify-center z-50 animate-bounce-short">
               <div className="bg-red-600 text-white px-4 py-2 rounded-full font-bold shadow-lg text-sm text-center">
                   {game.feedbackMessage}
               </div>
           </div>
       )}
       
       <div className="flex-1 flex flex-col items-center justify-center relative p-4">
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

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
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

  if (!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting to CineScore...</div>;

  if (mode === 'host' && gameId) return <HostView gameId={gameId} user={user} />;
  if (mode === 'player' && gameId) return <PlayerView gameId={gameId} user={user} username={username} />;

  // Initial State: user clicked "Host" but hasn't created game yet
  if (mode === 'host' && !gameId) {
    handleCreateGame(); // Auto create
    return <div className="h-screen bg-slate-950 flex items-center justify-center text-white">Creating Room...</div>;
  }

  return <Landing setMode={setMode} joinGame={handleJoinGame} />;
}