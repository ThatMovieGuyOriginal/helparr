// app/api/rss-test/[tenant]/route.js
import { verify } from '../../../../utils/hmac.js';
import { loadTenant } from '../../../../lib/kv.js';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const cachedMovies = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    const testMovies = cachedMovies.slice(0, 3);

    // Create RSS format as specified in Servarr wiki
    const rssItems = testMovies.map(movie => 
      `<item>
        <title><![CDATA[ ${movie.title} (${movie.year || 'Unknown'}) ]]></title>
        <guid isPermaLink="false">${movie.title} (${movie.year || 'Unknown'})</guid>
      </item>`
    ).join('\n');

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Custom Movie List</title>
    <description>Movies from TMDb</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`;

    console.log(`Returning RSS with ${testMovies.length} movies`);

    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('RSS test error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
