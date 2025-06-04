// pages/_app.js
import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Helparr - Custom Movie Lists for Radarr</title>
        <meta name="description" content="Create custom movie lists for Radarr by actor, director, producer, sound, and writer. Perfect for Plex, Jellyfin, and Emby users." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#7c3aed" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Helparr - Custom Movie Lists for Radarr" />
        <meta property="og:description" content="Create custom movie lists for Radarr by actor, director, producer, sound, and writer. Perfect for Plex, Jellyfin, and Emby users." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://helparr.vercel.app" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Helparr - Custom Movie Lists for Radarr" />
        <meta name="twitter:description" content="Create custom movie lists for Radarr by actor, director, producer, sound, and writer. Perfect for Plex, Jellyfin, and Emby users." />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Preload fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        
        {/* Analytics - if needed */}
        {process.env.NODE_ENV === 'production' && (
          <>
            {/* Add your analytics script here if needed */}
          </>
        )}
      </Head>
      
      <Component {...pageProps} />
    </>
  );
}
