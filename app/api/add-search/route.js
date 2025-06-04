// app/api/add-search/route.js - Final secure version
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { saveTenant } from '../../../lib/kv';
import { verify } from '../../../utils/hmac';
import { validateRequest } from '../../../utils/security';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, personId, roleType } = await request.json();
    
    console.log('=== ADD-SEARCH REQUEST DEBUG ===');
    console.log('User ID:', userId);
    console.log('Person ID:', personId);
    console.log('Role Type:', roleType);
    console.log('Signature received:', sig ? 'YES' : 'NO');
    
    // Comprehensive validation (includes rate limiting and tenant lookup)
    const tenant = await validateRequest(userId, personId, roleType);
    
    // Verify HMAC signature
    const expectedSigData = `add-search:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.log('ERROR: Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log('SUCCESS: Request validated, fetching credits...');
    
    // Fetch new movies for this person/role
    const credits = await fetchCredits(personId, tenant.tmdbKey);
    const newMovieIds = extractMovieIds(credits, roleType);
    
    if (newMovieIds.length === 0) {
      console.log('No movies found for this person/role combination');
      return Response.json({ 
        added: 0,
        total: tenant.movieIds ? JSON.parse(tenant.movieIds).length : 0,
        message: 'No movies found for this person in the specified role'
      });
    }
    
    // Merge with existing movies (avoid duplicates)
    const existingMovieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const allMovieIds = [...new Set([...existingMovieIds, ...newMovieIds])];
    
    // Update tenant with accumulated movies
    await saveTenant(userId, {
      ...tenant,
      movieIds: JSON.stringify(allMovieIds),
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`Added ${newMovieIds.length} new movies, total: ${allMovieIds.length}`);
    
    return Response.json({ 
      added: newMovieIds.length,
      total: allMovieIds.length,
      message: `Successfully added ${newMovieIds.length} movies`
    });
    
  } catch (error) {
    console.error('Add Search Error:', error);
    
    // Don't expose internal errors to client
    const clientError = error.message.includes('Rate limit') || 
                       error.message.includes('Invalid') ||
                       error.message.includes('not found')
                       ? error.message 
                       : 'Internal server error';
    
    const statusCode = error.message.includes('Rate limit') ? 429 :
                      error.message.includes('Invalid') ? 400 :
                      error.message.includes('not found') ? 404 : 500;
    
    return Response.json({ error: clientError }, { status: statusCode });
  }
}

export const dynamic = 'force-dynamic';
