// app/api/rss/[tenant]/route.js
import { verify } from '../../../../utils/hmac';
import { loadTenant } from '../../../../lib/kv';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return new Response('Tenant not found', { status: 404 });
    }

    // Verify signature
    const expectedSigData = `rss:${tenantId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return new Response('Invalid signature', { status: 403 });
    }

    // Get selected movies from query parameter (sent by frontend)
    const selectedMoviesParam = url.searchParams.get('movies');
    let selectedMovies = [];
    
    if (selectedMoviesParam) {
      try {
        selectedMovies = JSON.parse(decodeURIComponent(selectedMoviesParam));
      } catch (error) {
        console.warn('Failed to parse selected movies:', error);
      }
    }

    if (selectedMovies.length === 0) {
      // Return empty RSS feed
      const emptyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr - No Movies Selected</title>
    <description>Select movies in the web interface to populate this feed</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
  </channel>
</rss>`;
      
      return new Response(emptyRss, {
        status: 200,
        headers: { 
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Generate RSS items for selected movies
    const rssItems = selectedMovies.map(movie => {
      const pubDate = movie.release_date ? new Date(movie.release_date).toUTCString() : new Date().toUTCString();
      const description = movie.overview ? movie.overview.substring(0, 200) + '...' : 'No description available.';
      
      return `    <item>
      <title><![CDATA[${movie.title} (${movie.year || 'Unknown'})]]></title>
      <description><![CDATA[${description}]]></description>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <pubDate>${pubDate}</pubDate>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
    </item>`;
    }).join('\n');

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr Movie List</title>
    <description>Curated movie list from TMDb</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <language>en-us</language>
    <webMaster>noreply@helparr.vercel.app</webMaster>
    <managingEditor>noreply@helparr.vercel.app</managingEditor>
${rssItems}
  </channel>
</rss>`;

    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Movie-Count': selectedMovies.length.toString()
      }
    });

  } catch (error) {
    console.error('RSS Error:', error);
    
    const errorRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Feed Error</title>
    <description>An error occurred generating the RSS feed</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  </channel>
</rss>`;
    
    return new Response(errorRss, {
      status: 500,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
    });
  }
}

export const dynamic = 'force-dynamic';
