// lib/rss.js

import { loadTenant } from './kv';

export async function generateRssFeed(userId) {
  const tenant = await loadTenant(userId);
  if (!tenant) {
    throw new Error('User not found');
  }

  let movies = [];
  try {
    movies = JSON.parse(tenant.selectedMovies || '[]');
  } catch (error) {
    console.warn('Failed to parse movies for user', userId);
    movies = [];
  }

  return buildRssXml(movies);
}

function buildRssXml(movies) {
  const validMovies = movies.filter(m => m && m.title && m.imdb_id);
  
  const items = validMovies.length > 0 
    ? validMovies.map(movie => createMovieItem(movie)).join('\n')
    : createWelcomeItem();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr Movie List</title>
    <description>Your curated movie list - ${validMovies.length} movies</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function createMovieItem(movie) {
  const title = escapeXml(movie.title);
  const description = escapeXml(movie.overview || 'No description available');
  
  return `    <item>
      <title><![CDATA[${title} (${movie.year || 'Unknown'})]]></title>
      <description><![CDATA[${description}]]></description>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <pubDate>${movie.release_date ? new Date(movie.release_date).toUTCString() : new Date().toUTCString()}</pubDate>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
    </item>`;
}

function createWelcomeItem() {
  return `    <item>
      <title><![CDATA[Welcome to Helparr]]></title>
      <description><![CDATA[Your RSS feed is ready! Add movies at helparr.vercel.app]]></description>
      <guid isPermaLink="false">helparr-welcome-${Date.now()}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
    </item>`;
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
