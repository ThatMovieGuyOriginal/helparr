// pages/_app.js

import '../styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Helparr - Auto-add movies to Radarr by actor</title>
        <meta name="description" content="Search for any actor or director, select their movies, and auto-add to Radarr via RSS. Simple, fast, free." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
