import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [personId, setPersonId] = useState('');
  const [roleType, setRoleType] = useState('actor');
  const [quality, setQuality] = useState('1080p');
  const [tmdbKey, setTmdbKey] = useState('');
  const [storedKey, setStoredKey] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [syncCurl, setSyncCurl] = useState('');
  const [error, setError] = useState('');

  // On mount, load from localStorage if exists
  useEffect(() => {
    const saved = localStorage.getItem('tmdbKey');
    if (saved) {
      setTmdbKey(saved);
      setStoredKey(saved);
    }
  }, []);

  // Whenever tmdbKey changes, update localStorage
  useEffect(() => {
    if (tmdbKey) {
      localStorage.setItem('tmdbKey', tmdbKey);
      setStoredKey(tmdbKey);
    }
  }, [tmdbKey]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setListUrl('');
    setWebhookUrl('');
    setSyncCurl('');

    if (!storedKey) {
      setError('Please enter a TMDb API key.');
      return;
    }

    try {
      const res = await fetch('/api/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, roleType, quality, tmdbKey: storedKey }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Unknown error');
      }
      setListUrl(json.listUrl);
      setWebhookUrl(json.webhookUrl);
      setSyncCurl(json.syncCurl);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1>Radarr-TMDB Integration MVP</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            TMDb API Key:
            <input
              type="text"
              value={tmdbKey}
              onChange={e => setTmdbKey(e.target.value.trim())}
              required
              aria-describedby="tmdb-desc"
            />
            <small id="tmdb-desc">Your personal TMDb API key (stored locally in browser).</small>
          </label>
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
              aria-describedby="person-desc"
            />
            <small id="person-desc">Numeric ID from TMDb (e.g., Tom Hanks = 31)</small>
          </label>
          <label>
            Quality Profile:
            <input
              type="text"
              value={quality}
              onChange={e => setQuality(e.target.value)}
              required
              aria-describedby="quality-desc"
            />
            <small id="quality-desc">Name of Radarr quality profile (e.g., 1080p)</small>
          </label>
          <button type="submit">Generate URLs</button>
        </form>

        {error && <p role="alert" className={styles.error}>{error}</p>}

        {listUrl && (
          <section className={styles.result}>
            <h2>Configuration URLs</h2>
            <div>
              <label htmlFor="listUrl">List URL:</label>
              <input id="listUrl" readOnly value={listUrl} />
            </div>
            <div>
              <label htmlFor="webhookUrl">Webhook URL:</label>
              <input id="webhookUrl" readOnly value={webhookUrl} />
            </div>
            <div>
              <label htmlFor="syncCurl">Sync-Now Curl:</label>
              <textarea id="syncCurl" readOnly rows={3} value={syncCurl} />
            </div>
            <p>Paste these into Radarr:</p>
            <ol>
              <li>Settings → Connect → + → Webhook (paste Webhook URL)</li>
              <li>Settings → Lists → + → Custom List (paste List URL)</li>
              <li>Settings → Connect → + → Custom Script (paste Sync-Now Curl)</li>
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
