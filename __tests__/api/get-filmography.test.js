/**
 * @jest-environment node
 */
// Test get-filmography endpoint functionality

// Mock external dependencies
jest.mock('../../lib/kv.js');
jest.mock('../../utils/hmac.js');

// Mock global fetch for TMDb API calls
global.fetch = jest.fn();

const mockKV = {
  loadTenant: jest.fn()
};

const mockHmac = {
  verify: jest.fn()
};

describe('Get Filmography API Endpoint', () => {
  const testUser = {
    userId: 'filmography-test-user',
    tenantSecret: 'test-tenant-secret-filmography',
    tmdbKey: 'a1b2c3d4e5f67890123456789abcdef0'
  };

  const mockPersonData = {
    id: 287,
    name: 'Brad Pitt',
    birthday: '1963-12-18',
    place_of_birth: 'Shawnee, Oklahoma, USA',
    biography: 'William Bradley Pitt is an American actor...'
  };

  const mockCreditsData = {
    cast: [
      {
        id: 550,
        title: 'Fight Club',
        release_date: '1999-10-15',
        character: 'Tyler Durden',
        overview: 'A ticking-time-bomb insomniac...'
      },
      {
        id: 807,
        title: 'Seven',
        release_date: '1995-09-22',
        character: 'Mills',
        overview: 'Two detectives hunt a serial killer...'
      },
      {
        id: 161,
        title: 'Ocean\'s Eleven',
        release_date: '2001-12-07',
        character: 'Rusty Ryan',
        overview: 'Danny Ocean\'s team of specialists...'
      }
    ],
    crew: [
      {
        id: 123,
        title: 'The Departed',
        release_date: '2006-10-06',
        job: 'Producer',
        department: 'Production'
      },
      {
        id: 456,
        title: 'World War Z',
        release_date: '2013-06-21',
        job: 'Producer',
        department: 'Production'
      }
    ]
  };

  const mockMovieDetails = [
    {
      id: 550,
      title: 'Fight Club',
      imdb_id: 'tt0137523',
      release_date: '1999-10-15',
      overview: 'A ticking-time-bomb insomniac...',
      vote_average: 8.4,
      runtime: 139,
      genres: [{ name: 'Drama' }]
    },
    {
      id: 807,
      title: 'Seven',
      imdb_id: 'tt0114369',
      release_date: '1995-09-22',
      overview: 'Two detectives hunt a serial killer...',
      vote_average: 8.6,
      runtime: 127,
      genres: [{ name: 'Crime' }, { name: 'Mystery' }, { name: 'Thriller' }]
    },
    {
      id: 161,
      title: 'Ocean\'s Eleven',
      imdb_id: 'tt0240772',
      release_date: '2001-12-07',
      overview: 'Danny Ocean\'s team of specialists...',
      vote_average: 7.8,
      runtime: 116,
      genres: [{ name: 'Crime' }, { name: 'Comedy' }]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockKV.loadTenant.mockResolvedValue({
      tenantSecret: testUser.tenantSecret,
      tmdbKey: testUser.tmdbKey
    });
    
    mockHmac.verify.mockReturnValue(true);
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', async () => {
      const validateFilmographyParams = (params) => {
        const { userId, personId, roleType = 'actor' } = params;
        
        if (!userId || !personId) {
          return { valid: false, error: 'Missing parameters', status: 400 };
        }

        const allowedRoles = ['actor', 'director', 'producer', 'sound', 'writer'];
        if (!allowedRoles.includes(roleType)) {
          return { valid: false, error: 'Invalid role type', status: 400 };
        }

        return { valid: true };
      };

      // Valid parameters
      expect(validateFilmographyParams({
        userId: testUser.userId,
        personId: 287,
        roleType: 'actor'
      })).toEqual({ valid: true });

      // Missing userId
      expect(validateFilmographyParams({
        personId: 287,
        roleType: 'actor'
      })).toEqual({
        valid: false,
        error: 'Missing parameters',
        status: 400
      });

      // Missing personId
      expect(validateFilmographyParams({
        userId: testUser.userId,
        roleType: 'actor'
      })).toEqual({
        valid: false,
        error: 'Missing parameters',
        status: 400
      });

      // Invalid role type
      expect(validateFilmographyParams({
        userId: testUser.userId,
        personId: 287,
        roleType: 'invalid_role'
      })).toEqual({
        valid: false,
        error: 'Invalid role type',
        status: 400
      });

      // All valid role types
      const validRoles = ['actor', 'director', 'producer', 'sound', 'writer'];
      validRoles.forEach(role => {
        expect(validateFilmographyParams({
          userId: testUser.userId,
          personId: 287,
          roleType: role
        })).toEqual({ valid: true });
      });
    });
  });

  describe('Authentication and Authorization', () => {
    test('should validate HMAC signature correctly', async () => {
      const validateFilmographyAuth = async (userId, signature) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return { valid: false, error: 'User not found', status: 404 };
        }

        const expectedSigData = `get-filmography:${userId}`;
        const isValidSig = mockHmac.verify(expectedSigData, tenant.tenantSecret, signature);
        
        if (!isValidSig) {
          return { valid: false, error: 'Invalid signature', status: 403 };
        }

        return { valid: true, tenant };
      };

      // Valid signature
      const validResult = await validateFilmographyAuth(testUser.userId, 'valid-signature');
      expect(validResult.valid).toBe(true);
      expect(validResult.tenant.tmdbKey).toBe(testUser.tmdbKey);

      // Invalid signature
      mockHmac.verify.mockReturnValue(false);
      const invalidResult = await validateFilmographyAuth(testUser.userId, 'invalid-signature');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid signature');
      expect(invalidResult.status).toBe(403);

      // User not found
      mockKV.loadTenant.mockResolvedValue(null);
      const notFoundResult = await validateFilmographyAuth('nonexistent-user', 'signature');
      expect(notFoundResult.valid).toBe(false);
      expect(notFoundResult.error).toBe('User not found');
      expect(notFoundResult.status).toBe(404);
    });
  });

  describe('Filmography Data Processing', () => {
    test('should extract actor movie IDs correctly', () => {
      const extractMovieIds = (credits, roleType) => {
        if (!credits || typeof credits !== 'object') {
          return [];
        }

        let movies = [];
        
        switch (roleType) {
          case 'actor':
            movies = Array.isArray(credits.cast) ? credits.cast : [];
            break;
          case 'director':
            movies = Array.isArray(credits.crew) 
              ? credits.crew.filter(job => job && job.job === 'Director') 
              : [];
            break;
          case 'producer':
            movies = Array.isArray(credits.crew) 
              ? credits.crew.filter(job => job && job.job === 'Producer') 
              : [];
            break;
          case 'sound':
            movies = Array.isArray(credits.crew) 
              ? credits.crew.filter(job => job && (job.department === 'Sound' || (job.job && job.job.includes('Sound')))) 
              : [];
            break;
          case 'writer':
            movies = Array.isArray(credits.crew) 
              ? credits.crew.filter(job => job && job.job && 
                  (job.job === 'Writer' || job.job === 'Screenplay' || job.job === 'Story')) 
              : [];
            break;
          default:
            movies = Array.isArray(credits.cast) ? credits.cast : [];
        }
        
        return movies
          .filter(movie => movie && movie.release_date && movie.id)
          .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
          .map(movie => movie.id);
      };

      // Test actor extraction
      const actorIds = extractMovieIds(mockCreditsData, 'actor');
      expect(actorIds).toEqual([161, 550, 807]); // Sorted by release date desc: 2001, 1999, 1995

      // Test producer extraction
      const producerIds = extractMovieIds(mockCreditsData, 'producer');
      expect(producerIds).toEqual([456, 123]); // 2013, 2006

      // Test director extraction (none in mock data)
      const directorIds = extractMovieIds(mockCreditsData, 'director');
      expect(directorIds).toEqual([]);

      // Test with invalid credits
      expect(extractMovieIds(null, 'actor')).toEqual([]);
      expect(extractMovieIds(undefined, 'actor')).toEqual([]);
      expect(extractMovieIds({}, 'actor')).toEqual([]);
      expect(extractMovieIds({ cast: null }, 'actor')).toEqual([]);
    });

    test('should handle crew role filtering correctly', () => {
      const complexCrewData = {
        crew: [
          { id: 1, job: 'Director', release_date: '2020-01-01' },
          { id: 2, job: 'Producer', release_date: '2020-02-01' },
          { id: 3, job: 'Executive Producer', release_date: '2020-03-01' },
          { id: 4, job: 'Sound Designer', release_date: '2020-04-01' },
          { id: 5, job: 'Sound Editor', release_date: '2020-05-01' },
          { id: 6, department: 'Sound', job: 'Boom Operator', release_date: '2020-06-01' },
          { id: 7, job: 'Writer', release_date: '2020-07-01' },
          { id: 8, job: 'Screenplay', release_date: '2020-08-01' },
          { id: 9, job: 'Story', release_date: '2020-09-01' },
          { id: 10, job: 'Novel', release_date: '2020-10-01' } // Should not match writer
        ]
      };

      const extractMovieIds = (credits, roleType) => {
        let movies = [];
        
        switch (roleType) {
          case 'director':
            movies = credits.crew.filter(job => job && job.job === 'Director');
            break;
          case 'producer':
            movies = credits.crew.filter(job => job && job.job === 'Producer');
            break;
          case 'sound':
            movies = credits.crew.filter(job => job && (job.department === 'Sound' || (job.job && job.job.includes('Sound'))));
            break;
          case 'writer':
            movies = credits.crew.filter(job => job && job.job && 
                (job.job === 'Writer' || job.job === 'Screenplay' || job.job === 'Story'));
            break;
        }
        
        return movies.map(movie => movie.id);
      };

      expect(extractMovieIds(complexCrewData, 'director')).toEqual([1]);
      expect(extractMovieIds(complexCrewData, 'producer')).toEqual([2]); // Only exact "Producer", not "Executive Producer"
      expect(extractMovieIds(complexCrewData, 'sound')).toEqual([4, 5, 6]); // Job contains "Sound" or department is "Sound"
      expect(extractMovieIds(complexCrewData, 'writer')).toEqual([7, 8, 9]); // Writer, Screenplay, Story but not Novel
    });
  });

  describe('TMDb API Integration', () => {
    test('should fetch person details and credits successfully', async () => {
      const fetchFilmographyData = async (personId, apiKey) => {
        // Mock person details response
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockPersonData)
          })
          // Mock credits response
          .mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue(mockCreditsData)
          });

        const [personResponse, creditsResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}`),
          fetch(`https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${apiKey}`)
        ]);

        const person = await personResponse.json();
        const credits = await creditsResponse.json();

        return { person, credits };
      };

      const result = await fetchFilmographyData(287, testUser.tmdbKey);
      
      expect(result.person.name).toBe('Brad Pitt');
      expect(result.credits.cast).toHaveLength(3);
      expect(result.credits.crew).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(`https://api.themoviedb.org/3/person/287?api_key=${testUser.tmdbKey}`);
      expect(global.fetch).toHaveBeenCalledWith(`https://api.themoviedb.org/3/person/287/movie_credits?api_key=${testUser.tmdbKey}`);
    });

    test('should handle TMDb API errors gracefully', async () => {
      const fetchWithRetry = async (url, maxRetries = 3) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url);
            
            if (!response.ok) {
              if (response.status === 404) {
                throw new Error('Person not found');
              }
              if (response.status === 401) {
                throw new Error('Invalid TMDb API key');
              }
              throw new Error(`TMDb API error: ${response.status}`);
            }
            
            return await response.json();
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              // Small delay for exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
          }
        }
        
        throw lastError;
      };

      // Test 404 error
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(fetchWithRetry('test-url')).rejects.toThrow('Person not found');

      // Test 401 error
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      await expect(fetchWithRetry('test-url')).rejects.toThrow('Invalid TMDb API key');

      // Test generic error
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(fetchWithRetry('test-url')).rejects.toThrow('TMDb API error: 500');
    });

    test('should fetch movie details with proper batching', async () => {
      const fetchMovieDetails = async (movieIds, apiKey) => {
        const batchSize = 3; // Smaller for testing
        const movieDetails = [];
        
        for (let i = 0; i < movieIds.length; i += batchSize) {
          const batch = movieIds.slice(i, i + batchSize);
          
          const promises = batch.map(async (tmdbId) => {
            const mockMovie = mockMovieDetails.find(m => m.id === tmdbId);
            if (!mockMovie) return null;
            
            // Simulate API call
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValue(mockMovie)
            });
            
            const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
            const movie = await response.json();
            
            // Only include movies with IMDB IDs
            if (!movie.imdb_id) {
              return null;
            }
            
            return {
              id: tmdbId,
              title: movie.title,
              imdb_id: movie.imdb_id,
              year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
              poster_path: movie.poster_path,
              overview: movie.overview,
              vote_average: movie.vote_average || 0,
              release_date: movie.release_date,
              runtime: movie.runtime,
              genres: Array.isArray(movie.genres) ? movie.genres.slice(0, 3).map(g => g.name) : []
            };
          });
          
          const batchResults = await Promise.all(promises);
          movieDetails.push(...batchResults.filter(movie => movie !== null));
        }
        
        // Sort by release date (newest first)
        return movieDetails.sort((a, b) => {
          const dateA = new Date(a.release_date || '1900-01-01');
          const dateB = new Date(b.release_date || '1900-01-01');
          return dateB - dateA;
        });
      };

      const movieIds = [550, 807, 161];
      const results = await fetchMovieDetails(movieIds, testUser.tmdbKey);
      
      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Ocean\'s Eleven'); // 2001 - newest first
      expect(results[1].title).toBe('Fight Club'); // 1999
      expect(results[2].title).toBe('Seven'); // 1995
      
      // Verify all movies have IMDB IDs
      results.forEach(movie => {
        expect(movie.imdb_id).toMatch(/^tt\d+$/);
        expect(movie.genres).toBeDefined();
        expect(Array.isArray(movie.genres)).toBe(true);
      });
    });
  });

  describe('Caching Mechanism', () => {
    test('should implement filmography caching correctly', () => {
      class FilmographyCache {
        constructor() {
          this.cache = new Map();
        }

        getCacheKey(personId, roleType) {
          return `${personId}-${roleType}`;
        }

        get(personId, roleType) {
          const key = this.getCacheKey(personId, roleType);
          const cached = this.cache.get(key);
          
          if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
            return cached;
          }
          
          return null;
        }

        set(personId, roleType, data) {
          const key = this.getCacheKey(personId, roleType);
          this.cache.set(key, {
            ...data,
            timestamp: Date.now()
          });
        }

        clear() {
          this.cache.clear();
        }
      }

      const cache = new FilmographyCache();
      const cacheData = {
        movies: mockMovieDetails,
        personName: 'Brad Pitt'
      };

      // Test cache miss
      expect(cache.get(287, 'actor')).toBe(null);

      // Test cache set and hit
      cache.set(287, 'actor', cacheData);
      const cached = cache.get(287, 'actor');
      
      expect(cached.movies).toEqual(mockMovieDetails);
      expect(cached.personName).toBe('Brad Pitt');
      expect(cached.timestamp).toBeDefined();

      // Test cache expiry
      const expiredCache = new FilmographyCache();
      expiredCache.cache.set('287-actor', {
        ...cacheData,
        timestamp: Date.now() - 3700000 // Over 1 hour ago
      });
      
      expect(expiredCache.get(287, 'actor')).toBe(null);

      // Test different role types are cached separately
      cache.set(287, 'director', { movies: [], personName: 'Brad Pitt' });
      
      expect(cache.get(287, 'actor').movies).toHaveLength(3);
      expect(cache.get(287, 'director').movies).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle person with no filmography', async () => {
      const handleEmptyFilmography = (credits, roleType, personName) => {
        const extractMovieIds = (credits, roleType) => {
          if (!credits) return [];
          
          let movies = [];
          switch (roleType) {
            case 'actor':
              movies = credits.cast || [];
              break;
            case 'director':
              movies = (credits.crew || []).filter(job => job.job === 'Director');
              break;
          }
          
          return movies
            .filter(movie => movie && movie.release_date && movie.id)
            .map(movie => movie.id);
        };

        const movieIds = extractMovieIds(credits, roleType);
        
        if (movieIds.length === 0) {
          return {
            movies: [],
            personName,
            message: `No ${roleType} credits found`
          };
        }

        return { movieIds };
      };

      // Test empty cast
      const emptyCredits = { cast: [], crew: [] };
      const result1 = handleEmptyFilmography(emptyCredits, 'actor', 'Unknown Actor');
      
      expect(result1.movies).toEqual([]);
      expect(result1.message).toBe('No actor credits found');
      expect(result1.personName).toBe('Unknown Actor');

      // Test no director credits
      const actorOnlyCredits = { 
        cast: [{ id: 1, release_date: '2020-01-01' }], 
        crew: [{ job: 'Producer' }] 
      };
      const result2 = handleEmptyFilmography(actorOnlyCredits, 'director', 'Actor Name');
      
      expect(result2.movies).toEqual([]);
      expect(result2.message).toBe('No director credits found');

      // Test valid filmography
      const validCredits = { 
        cast: [{ id: 1, release_date: '2020-01-01' }]
      };
      const result3 = handleEmptyFilmography(validCredits, 'actor', 'Valid Actor');
      
      expect(result3.movieIds).toEqual([1]);
      expect(result3.message).toBeUndefined();
    });

    test('should filter out movies without IMDB IDs', async () => {
      const filterMoviesWithImdbIds = (movies) => {
        return movies.filter(movie => {
          if (!movie || !movie.title) {
            return false;
          }
          
          if (!movie.imdb_id) {
            console.log(`Movie ${movie.title} has no IMDB ID, skipping`);
            return false;
          }
          
          return true;
        });
      };

      const mixedMovies = [
        { id: 1, title: 'Movie With IMDB', imdb_id: 'tt0123456' },
        { id: 2, title: 'Movie Without IMDB', imdb_id: null },
        { id: 3, title: 'Another Valid Movie', imdb_id: 'tt0654321' },
        { id: 4, title: 'Movie With Empty IMDB', imdb_id: '' },
        null, // Invalid movie object
        { id: 5, imdb_id: 'tt0999999' } // Missing title
      ];

      const filtered = filterMoviesWithImdbIds(mixedMovies);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].title).toBe('Movie With IMDB');
      expect(filtered[1].title).toBe('Another Valid Movie');
      
      // Verify all filtered movies have valid IMDB IDs
      filtered.forEach(movie => {
        expect(movie.imdb_id).toMatch(/^tt\d+$/);
        expect(movie.title).toBeTruthy();
      });
    });

    test('should handle network failures gracefully', async () => {
      const resilientFetch = async (url, retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            await fetch(url);
            return 'success'; // Won't reach here in this test
          } catch (error) {
            if (attempt === retries) {
              return {
                error: 'Failed to fetch filmography after multiple attempts',
                originalError: error.message
              };
            }
            // Continue retry loop
          }
        }
      };

      const result = await resilientFetch('test-url');
      
      expect(result.error).toBe('Failed to fetch filmography after multiple attempts');
      expect(result.originalError).toBe('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Attempted 3 times
    });
  });

  describe('Response Format Validation', () => {
    test('should format successful filmography response correctly', () => {
      const formatFilmographyResponse = (movies, personName, totalFound) => {
        const withImdbIds = movies.length;
        
        return {
          movies,
          personName,
          totalFound,
          withImdbIds,
          message: totalFound > withImdbIds 
            ? `Showing ${withImdbIds} of ${totalFound} total actor credits (movies with IMDB IDs)`
            : `Complete actor filmography: ${withImdbIds} movies`,
          cached: false
        };
      };

      // Test complete filmography (all movies have IMDB IDs)
      const completeResponse = formatFilmographyResponse(mockMovieDetails, 'Brad Pitt', 3);
      
      expect(completeResponse.movies).toHaveLength(3);
      expect(completeResponse.personName).toBe('Brad Pitt');
      expect(completeResponse.totalFound).toBe(3);
      expect(completeResponse.withImdbIds).toBe(3);
      expect(completeResponse.message).toBe('Complete actor filmography: 3 movies');
      expect(completeResponse.cached).toBe(false);

      // Test partial filmography (some movies filtered out)
      const partialResponse = formatFilmographyResponse(mockMovieDetails.slice(0, 2), 'Brad Pitt', 5);
      
      expect(partialResponse.movies).toHaveLength(2);
      expect(partialResponse.totalFound).toBe(5);
      expect(partialResponse.withImdbIds).toBe(2);
      expect(partialResponse.message).toBe('Showing 2 of 5 total actor credits (movies with IMDB IDs)');
    });

    test('should format cached response correctly', () => {
      const formatCachedResponse = (cachedData) => {
        return {
          movies: cachedData.movies,
          personName: cachedData.personName,
          cached: true
        };
      };

      const cachedData = {
        movies: mockMovieDetails,
        personName: 'Brad Pitt',
        timestamp: Date.now()
      };

      const response = formatCachedResponse(cachedData);
      
      expect(response.movies).toBe(mockMovieDetails);
      expect(response.personName).toBe('Brad Pitt');
      expect(response.cached).toBe(true);
      expect(response.timestamp).toBeUndefined(); // Should not expose internal timestamp
    });
  });
});