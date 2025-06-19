// hooks/useFilmography.js
import { useState, useRef, useCallback } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';
import { tmdbClient } from '../utils/tmdbClient';

export function useFilmography(userId = '', tenantSecret = '') {
  const [selectedSource, setSelectedSource] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [sourceType, setSourceType] = useState('person');
  const [roleType, setRoleType] = useState('actor');
  const [selectedMoviesInSearch, setSelectedMoviesInSearch] = useState([]);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(null);
  const [rateLimitStatus, setRateLimitStatus] = useState('');
  const streamIdRef = useRef(null);
  const enrichmentProgressRef = useRef({ current: 0, total: 0 });

  // Cancel current streaming operation
  const cancelStreaming = useCallback(() => {
    if (streamIdRef.current) {
      const cancelled = tmdbClient.cancelStream(streamIdRef.current);
      if (cancelled) {
        setIsStreaming(false);
        setStreamingProgress(null);
        setRateLimitStatus('');
        streamIdRef.current = null;
        
        trackEvent('streaming_cancelled', {
          sourceName: selectedSource?.name,
          sourceType
        });
      }
    }
  }, [selectedSource, sourceType]);

  // Enrich movies with IMDB IDs in batches
  const enrichMovieBatch = useCallback(async (movies, apiKey) => {
    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const enrichedMovies = [];
    const batchSize = 6;
    
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      
      const promises = batch.map(async (movie) => {
        try {
          const url = `${TMDB_BASE}/movie/${movie.id}?api_key=${apiKey}`;
          const movieDetails = await tmdbClient.queueRequest(url);
          
          if (!movieDetails.imdb_id) {
            return null;
          }
          
          return {
            ...movie,
            imdb_id: movieDetails.imdb_id,
            runtime: movieDetails.runtime,
            genres: Array.isArray(movieDetails.genres) ? movieDetails.genres.slice(0, 3).map(g => g.name) : []
          };
          
        } catch (error) {
          console.warn(`Error enriching movie ${movie.id}:`, error.message);
          return null;
        }
      });
      
      const batchResults = await Promise.all(promises);
      enrichedMovies.push(...batchResults.filter(movie => movie !== null));
    }
    
    return enrichedMovies;
  }, []);

  // Handle streaming callbacks
  const createStreamingCallbacks = useCallback((apiKey, totalEstimated) => {
    return {
      onProgress: (loadedPages, totalPages, moviesLoaded) => {
        setStreamingProgress({
          loadedPages,
          totalPages,
          moviesLoaded,
          totalEstimated,
          percentage: Math.round((loadedPages / totalPages) * 100)
        });
      },
      
      onMoviesBatch: async (newMovies) => {
        if (newMovies.length === 0) return;
        
        try {
          // Enrich new movies with IMDB IDs
          const enrichedMovies = await enrichMovieBatch(newMovies, apiKey);
          
          if (enrichedMovies.length > 0) {
            // Append to existing filmography
            setFilmography(prev => {
              const combined = [...prev, ...enrichedMovies];
              return combined.sort((a, b) => {
                const dateA = new Date(a.release_date || '1900-01-01');
                const dateB = new Date(b.release_date || '1900-01-01');
                return dateB - dateA;
              });
            });
            
            // Append to selected movies (pre-selected)
            setSelectedMoviesInSearch(prev => [...prev, ...enrichedMovies]);
          }
          
        } catch (error) {
          console.error('Error processing movie batch:', error);
        }
      },
      
      onRateLimit: (retryInSeconds) => {
        setRateLimitStatus(`Rate limit hit, retrying in ${retryInSeconds} seconds...`);
        setTimeout(() => setRateLimitStatus(''), retryInSeconds * 1000 + 1000);
      },
      
      onComplete: () => {
        setIsStreaming(false);
        setStreamingProgress(null);
        setRateLimitStatus('');
        streamIdRef.current = null;
        
        trackEvent('streaming_completed', {
          sourceName: selectedSource?.name,
          sourceType,
          totalMovies: filmography.length
        });
      },
      
      onError: (error) => {
        setIsStreaming(false);
        setStreamingProgress(null);
        setRateLimitStatus('');
        streamIdRef.current = null;
        console.error('Streaming error:', error);
        
        trackEvent('streaming_failed', {
          sourceName: selectedSource?.name,
          sourceType,
          error: error.message
        });
      },
      
      onCancel: () => {
        setIsStreaming(false);
        setStreamingProgress(null);
        setRateLimitStatus('');
        streamIdRef.current = null;
      }
    };
  }, [selectedSource, sourceType, filmography.length, enrichMovieBatch]);

  // Get movies from any source type with streaming support
  const getSourceMovies = async (source, type, role = null) => {
    if (!userId || !tenantSecret) {
      throw new Error('User not properly initialized');
    }

    // Cancel any existing streaming
    cancelStreaming();

    setSelectedSource(source);
    setSourceType(type);
    if (role) setRoleType(role);
    setFilmographyLoading(true);
    setFilmography([]);
    setSelectedMoviesInSearch([]);
    setStreamingProgress(null);
    setRateLimitStatus('');
    
    try {
      trackEvent('get_source_movies', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role,
        sourceId: source.id
      });
      
      let movies = [];
      let sourceName = source.name;
      let streamingInfo = null;

      if (type === 'person') {
        // Use existing filmography API for people (no streaming needed)
        const sig = await generateSignature(`get-filmography:${userId}`, tenantSecret);
        const res = await fetch(`/api/get-filmography?sig=${sig}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, personId: source.id, roleType: role }),
        });
        
        const json = await res.json();
        if (res.ok) {
          movies = json.movies || [];
          sourceName = json.personName || source.name;
        } else {
          throw new Error(json.error || 'Failed to get filmography');
        }
      } else {
        // Use source movies API for collections and companies
        const sig = await generateSignature(`get-source-movies:${userId}`, tenantSecret);
        const res = await fetch(`/api/get-source-movies?sig=${sig}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            sourceId: source.id, 
            sourceType: type,
            streaming: true
          }),
        });
        
        const json = await res.json();
        if (res.ok) {
          movies = json.movies || [];
          sourceName = json.sourceName || source.name;
          streamingInfo = json.streaming;
        } else {
          throw new Error(json.error || `Failed to get ${type} movies`);
        }
      }

      // Set initial movies
      setFilmography(movies);
      const moviesWithSelection = movies.map(movie => ({
        ...movie,
        selected: true
      }));
      setSelectedMoviesInSearch(moviesWithSelection);
      
      // Start streaming if needed (large companies)
      if (streamingInfo && streamingInfo.totalPages > 1) {
        setIsStreaming(true);
        streamIdRef.current = `${source.id}-${Date.now()}`;
        
        const callbacks = createStreamingCallbacks(streamingInfo.apiKey, streamingInfo.totalResults);
        
        // Initialize progress with first page
        setStreamingProgress({
          loadedPages: 1,
          totalPages: streamingInfo.totalPages,
          moviesLoaded: movies.length,
          totalEstimated: streamingInfo.totalResults,
          percentage: Math.round((1 / streamingInfo.totalPages) * 100)
        });
        
        // Start streaming remaining pages
        tmdbClient.startStreamingLoad(
          streamingInfo.baseUrl,
          streamingInfo.totalPages,
          streamIdRef.current,
          callbacks
        );
        
        trackEvent('streaming_started', {
          sourceName: source.name,
          sourceType: type,
          totalPages: streamingInfo.totalPages,
          estimatedTotal: streamingInfo.totalResults
        });
      }
      
      trackEvent('source_movies_loaded', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role,
        movieCount: movies.length,
        hasStreaming: !!streamingInfo
      });
      
      if (movies.length === 0 && !streamingInfo) {
        const errorMessage = type === 'person' 
          ? `No ${role} credits found for ${source.name}`
          : `No movies found for ${source.name}`;
        throw new Error(errorMessage);
      }
      
    } catch (err) {
      throw err;
    } finally {
      setFilmographyLoading(false);
    }
  };

  // Legacy method for backward compatibility
  const getFilmography = async (person, role) => {
    return getSourceMovies(person, 'person', role);
  };

  // Toggle movie selection in search view
  const toggleMovieInSearch = (movieId) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, selected: !movie.selected } 
          : movie
      )
    );
    
    trackEvent('toggle_movie_selection', {
      movieId,
      sourceName: selectedSource?.name,
      sourceType,
      roleType: sourceType === 'person' ? roleType : null
    });
  };

  // Select all/none in search view (works on complete accumulated dataset)
  const selectAllInSearch = (selected = true) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
    
    trackEvent('select_all_movies', {
      selected,
      movieCount: selectedMoviesInSearch.length,
      sourceName: selectedSource?.name,
      sourceType,
      roleType: sourceType === 'person' ? roleType : null
    });
  };

  // Clear filmography and cancel any streaming
  const clearFilmography = () => {
    cancelStreaming();
    setSelectedSource(null);
    setFilmography([]);
    setSelectedMoviesInSearch([]);
    setSourceType('person');
    setRoleType('actor');
    setStreamingProgress(null);
    setRateLimitStatus('');
  };

  return {
    selectedSource,
    selectedPerson: selectedSource, // Backward compatibility
    filmography,
    filmographyLoading,
    sourceType,
    roleType,
    selectedMoviesInSearch,
    
    // Streaming properties
    isStreaming,
    streamingProgress,
    rateLimitStatus,
    
    // Methods
    getSourceMovies,
    getFilmography, // Backward compatibility
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography,
    cancelStreaming
  };
}
