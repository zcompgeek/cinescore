import { tmdbAccessToken } from '../firebase/config';
export const searchItunes = async (query) => {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
    if (!res.ok) throw new Error(`iTunes HTTP error: ${res.status}`);
    const data = await res.json();
    return data.results[0] || null;
  } catch (e) {
    console.error("[ITUNES_API_ERROR]", e);
    return null;
  }
};

export const searchMoviePoster = async (query, type = 'movie', year = null) => {
  if (!tmdbAccessToken || tmdbAccessToken.startsWith("REPLACE")) {
    console.error("[TMDB_API_ERROR] Token is missing or invalid placeholder string.");
    return null;
  }
  try {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    let url = `https://api.themoviedb.org/3/search/${endpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    if (year) url += type === 'movie' ? `&year=${year}` : `&first_air_date_year=${year}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', Authorization: `Bearer ${tmdbAccessToken}` }
    });
    if (!res.ok) throw new Error(`TMDB HTTP error: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
        const sortedResults = data.results.sort((a, b) => b.popularity - a.popularity);
        const bestResult = sortedResults[0];
        if (bestResult.poster_path) return `https://image.tmdb.org/t/p/w780${bestResult.poster_path}`;
    }
    return null;
  } catch (e) { 
    console.error("[TMDB_API_ERROR]", e);
    return null; 
  }
};


