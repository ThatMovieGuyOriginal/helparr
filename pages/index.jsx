// pages/index.jsx
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

// HMAC-SHA256 signature generation (client-side)
async function generateSignature(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Home() {
  const [userId, setUserId] = useState('');
  const [isUserSetup, setIsUserSetup] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [tenantSecret, setTenantSecret] = useState('');
  
  // Add-search form states
  const [personId, setPersonId] = useState('');
  const [roleType, setRoleType] = useState('actor');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize user on mount
  useEffect(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
    }
    setUserId(id);
    
    // Check if user already has URLs (meaning they're already set up)
    const savedWebhook = localStorage.getItem('webhookUrl');
    const savedList = localStorage.getItem('listUrl');
    const savedSecret = localStorage.getItem('tenantSecret');
    if (savedWebhook && savedList && savedSecret) {
      setWebhookUrl(savedWebhook);
      setListUrl(savedList);
      setTenantSecret(savedSecret);
      setIsUserSetup(true);
    }

    // Load stored TMDb key
    const savedKey = localStorage.getItem('tmdbKey');
    if (savedKey) {
      setTmdbKey(savedKey);
    }
  }, []);

  async function setupUser(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!tmdbKey) {
      setError('Please enter your TMDb API key.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tmdbKey }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Setup failed');
      }
      
      // Store everything locally including the tenant secret
      localStorage.setItem('tmdbKey', tmdbKey);
      localStorage.setItem('webhookUrl', json.webhookUrl);
      localStorage.setItem('listUrl', json.listUrl);
      localStorage.setItem('tenantSecret', json.tenantSecret);
      
      setWebhookUrl(json.webhookUrl);
      setListUrl(json.listUrl);
      setTenantSecret(json.tenantSecret);
      setIsUserSetup(true);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function addSearch(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!personId) {
      setError('Please enter a person ID.');
      setIsLoading(false);
      return;
    }

    if (!tenantSecret) {
      setError('Missing authentication data. Please reset and setup again.');
      setIsLoading(false);
      return;
    }

    try {
      // Generate signature for the add-search request
      const signatureData = `add-search:${userId}`;
      const sig = await generateSignature(signatureData, tenantSecret);

      const res = await fetch('/api/add-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personId, roleType, sig }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to add search');
      }
      
      setSuccess(`Added ${json.added} new movies. Total: ${json.total} movies.`);
      setPersonId(''); // Clear form
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function resetSetup() {
    localStorage.clear();
    setIsUserSetup(false);
    setWebhookUrl('');
    setListUrl('');
    setTenantSecret('');
    setUserId('');
    setTmdbKey('');
    // Generate new user ID
    const newId = crypto.randomUUID();
    localStorage.setItem('userId', newId);
    setUserId(newId);
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1>Radarr-TMDB Integration</h1>
        
        {!isUserSetup ? (
          <div>
            <h2>First-time Setup</h2>
            <p>Set up your Radarr integration once, then add multiple actors/directors to your list.</p>
            
            <form onSubmit={setupUser} className={styles.form}>
              <label>
                TMDb API Key:
                <input
                  type="text"
                  value={tmdbKey}
                  onChange={e => setTmdbKey(e.target.value.trim())}
                  required
                  placeholder="Your TMDb API key"
                  disabled={isLoading}
                />
                <small>Get your free API key from themoviedb.org</small>
              </label>
              
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Setting up...' : 'Setup Radarr Integration'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2>Add Actors/Directors to Your List</h2>
            
            <form onSubmit={addSearch} className={styles.form}>
              <label>
                Role Type:
                <select 
                  value={roleType} 
                  onChange={e => setRoleType(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="actor">Actor</option>
                  <option value="director">Director</option>
                  <option value="producer">Producer</option>
                </select>
              </label>
              
              <label>
                TMDb Person ID:
                <input
                  type="text"
                  value={personId}
                  onChange={e => setPersonId(e.target.value)}
                  required
                  pattern="\d+"
                  placeholder="e.g., 31 for Tom Hanks"
                  disabled={isLoading}
                />
                <small>Find the numeric ID on TMDb person pages</small>
              </label>
              
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add to My Movie List'}
              </button>
            </form>

            <div className={styles.result}>
              <h3>Your Radarr Configuration (set up once):</h3>
              <div>
                <label>Webhook URL:</label>
                <input readOnly value={webhookUrl} />
              </div>
              <div>
                <label>List URL:</label>
                <input readOnly value={listUrl} />
              </div>
              <p>Configure these URLs in Radarr Settings → Connect and Settings → Lists</p>
              
              <button onClick={resetSetup} className={styles.resetButton}>
                Reset & Generate New URLs
              </button>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </main>
    </div>
  );
}
