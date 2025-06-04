// pages/index.jsx
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [userId, setUserId] = useState('');
  const [isUserSetup, setIsUserSetup] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [listUrl, setListUrl] = useState('');
  
  // Add-search form states
  const [personId, setPersonId] = useState('');
  const [roleType, setRoleType] = useState('actor');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    if (savedWebhook && savedList) {
      setWebhookUrl(savedWebhook);
      setListUrl(savedList);
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

    if (!tmdbKey) {
      setError('Please enter your TMDb API key.');
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
      
      // Store everything locally
      localStorage.setItem('tmdbKey', tmdbKey);
      localStorage.setItem('webhookUrl', json.webhookUrl);
      localStorage.setItem('listUrl', json.listUrl);
      
      setWebhookUrl(json.webhookUrl);
      setListUrl(json.listUrl);
      setIsUserSetup(true);
      
    } catch (err) {
      setError(err.message);
    }
  }

  async function addSearch(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!personId) {
      setError('Please enter a person ID.');
      return;
    }

    try {
      const res = await fetch('/api/add-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personId, roleType }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to add search');
      }
      
      setSuccess(`Added ${json.added} new movies. Total: ${json.total} movies.`);
      setPersonId(''); // Clear form
      
    } catch (err) {
      setError(err.message);
    }
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
                />
                <small>Get your free API key from themoviedb.org</small>
              </label>
              
              <button type="submit">Setup Radarr Integration</button>
            </form>
          </div>
        ) : (
          <div>
            <h2>Add Actors/Directors to Your List</h2>
            
            <form onSubmit={addSearch} className={styles.form}>
              <label>
                Role Type:
                <select value={roleType} onChange={e => setRoleType(e.target.value)}>
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
                />
                <small>Find the numeric ID on TMDb person pages</small>
              </label>
              
              <button type="submit">Add to My Movie List</button>
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
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </main>
    </div>
  );
}
