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

    // Get selected movies from Redis storage instead of URL params
    let selectedMovies = [];
    if (tenant.selectedMovies) {
      try {
        selectedMovies = JSON.parse(tenant.selectedMovies);
      } catch (error) {
        console.warn('Failed to parse selected movies from storage:', error);
      }
    }

    // Always return valid RSS, even if empty
    const rssItems = selectedMovies.length > 0 ? selectedMovies.map(movie => {
      const pubDate = movie.release_date ? new Date(movie.release_date).toUTCString() : new Date().toUTCString();
      const description = movie.overview ? movie.overview.substring(0, 200) + '...' : 'No description available.';
      
      return `    <item>
      <title><![CDATA[${movie.title} (${movie.year || 'Unknown'})]]></title>
      <description><![CDATA[${description}]]></description>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <pubDate>${pubDate}</pubDate>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
    </item>`;
    }).join('\n') : `    <item>
      <title><![CDATA[Getting Started with Helparr]]></title>
      <description><![CDATA[Welcome to Helparr! Search for actors and directors to start building your movie list. This placeholder item will be replaced once you add movies.]]></description>
      <guid isPermaLink="false">helparr-getting-started</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
    </item>`;

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr Movie List</title>
    <description>Curated movie list from TMDb - ${selectedMovies.length} movies selected</description>
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
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'X-Movie-Count': selectedMovies.length.toString(),
        'X-Has-Movies': selectedMovies.length > 0 ? 'true' : 'false'
      }
    });

  } catch (error) {
    console.error('RSS Error:', error);
    
    // Return valid RSS even on error
    const errorRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Feed Error</title>
    <description>An error occurred generating the RSS feed</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <item>
      <title><![CDATA[RSS Feed Error]]></title>
      <description><![CDATA[There was an error generating your movie list. Please check your Helparr configuration.]]></description>
      <guid isPermaLink="false">helparr-error</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
    </item>
  </channel>
</rss>`;
    
    return new Response(errorRss, {
      status: 200, // Return 200 so Radarr doesn't error
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
    });
  }
}

export const dynamic = 'force-dynamic';
