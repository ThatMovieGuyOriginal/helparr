// app/api/rss/[userId]/[token]/route.js

import { getUserData } from '../../../../../lib/kv';

export async function GET(request, { params }) {
  try {
    const { userId, token } = params;
    
    // Get user data
    const data = await getUserData(`${userId}:${token}`);
    if (!data) {
      return new Response('Feed not found', { status: 404 });
    }

    // Generate RSS XML
    const rss = generateRSS(data);
    
    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('RSS error:', error);
    return new Response('Feed error', { status: 500 });
  }
}

function generateRSS(data) {
  const { personName, movies } = data;
  
  const items = movies.map(movie => `
    <item>
      <title><![CDATA[${movie.title} (${movie.year})]]></title>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description><![CDATA[${movie.title} - Added from ${personName}'s filmography]]></description>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr - ${personName}</title>
    <description>Movies from ${personName}</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}
