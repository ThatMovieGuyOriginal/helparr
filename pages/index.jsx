// pages/index.jsx
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [userId, setUserId] = useState('');
  const [isUserSetup, setIsUserSetup] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [listUrl, setListUrl] = useState('');

  // Initialize user on mount
  useEffect(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
    }
    setUserId(id);
    
    // Check if user already has URLs
    const savedWebhook = localStorage.getItem('webhookUrl');
    const savedList = localStorage.getItem('listUrl');
    if (savedWebhook && savedList) {
      setWebhookUrl(savedWebhook);
      setListUrl(savedList);
      setIsUserSetup(true);
    }
  }, []);

  async function setupUser() {
    // One-time user setup
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tmdbKey }),
    });
    
    const { webhookUrl, listUrl } = await res.json();
    
    // Store URLs locally
    localStorage.setItem('webhookUrl', webhookUrl);
    localStorage.setItem('listUrl', listUrl);
    setWebhookUrl(webhookUrl);
    setListUrl(listUrl);
    setIsUserSetup(true);
  }

  async function addSearch() {
    // Add additional searches
    await fetch('/api/add-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, personId, roleType, sig: userSig }),
    });
  }

  return (
    <div>
      {!isUserSetup ? (
        <div>
          <h2>First-time Setup</h2>
          {/* TMDb key input and setup */}
          <button onClick={setupUser}>Setup Radarr Integration</button>
        </div>
      ) : (
        <div>
          <h2>Add More Actors/Directors</h2>
          {/* Person search form */}
          <button onClick={addSearch}>Add to My List</button>
          
          <div>
            <h3>Your Radarr URLs (configured once):</h3>
            <p>Webhook: {webhookUrl}</p>
            <p>List: {listUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
