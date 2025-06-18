// app/api/generate-rss/route.js

import { saveUserData } from '../../../lib/kv';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { userId, personName, movies } = await request.json();
    
    if (!userId || !movies || movies.length === 0) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Generate simple token for RSS URL
    const token = uuidv4();
    
    // Save movie data
    await saveUserData(`${userId}:${token}`, {
      personName,
      movies,
      createdAt: new Date().toISOString()
    });

    // Generate RSS URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    
    const rssUrl = `${baseUrl}/api/rss/${userId}/${token}`;
    
    return Response.json({ rssUrl });
  } catch (error) {
    console.error('Generate RSS error:', error);
    return Response.json({ error: 'Failed to generate RSS' }, { status: 500 });
  }
}
