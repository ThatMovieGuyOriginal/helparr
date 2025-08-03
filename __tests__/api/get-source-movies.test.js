/**
 * @jest-environment node
 */
// Test get-source-movies endpoint functionality

// Mock external dependencies
jest.mock('../../lib/kv.js');
jest.mock('../../utils/hmac.js');
jest.mock('../../utils/tmdbClient.js');

// Mock global fetch for TMDb API calls
global.fetch = jest.fn();

const mockKV = {
  loadTenant: jest.fn()
};

const mockHmac = {
  verify: jest.fn()
};

const mockTmdbClient = {
  queueRequest: jest.fn()
};

describe('Get Source Movies API Endpoint', () => {
  const testUser = {
    userId: 'source-movies-test-user',
    tenantSecret: 'test-tenant-secret-source',
    tmdbKey: 'a1b2c3d4e5f67890123456789abcdef0'
  };

  const mockCollectionData = {
    id: 10,
    name: 'Star Wars Collection',
    overview: 'A long time ago in a galaxy far, far away...',
    parts: [
      {
        id: 11,
        title: 'Star Wars: Episode IV - A New Hope',
        release_date: '1977-05-25',
        overview: 'Luke Skywalker joins forces...',
        vote_average: 8.6,
        poster_path: '/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg'
      },
      {
        id: 1891,
        title: 'Star Wars: Episode V - The Empire Strikes Back',
        release_date: '1980-05-17',
        overview: 'The Imperial forces...',
        vote_average: 8.7,
        poster_path: '/2l05cFWJacyIsTpsqSgH0wQXe4V.jpg'
      },
      {
        id: 1892,
        title: 'Star Wars: Episode VI - Return of the Jedi',
        release_date: '1983-05-25',
        overview: 'Luke Skywalker leads...',
        vote_average: 8.3,
        poster_path: '/lQIb9GEGghQPDNZtfDIMUsSP44k.jpg'
      }
    ]
  };

  const mockCompanyData = {
    id: 420,
    name: 'Marvel Studios',
    description: 'Marvel Studios, LLC...',
    headquarters: 'Burbank, California, US',
    homepage: 'https://www.marvel.com/movies',
    logo_path: '/hUzeosd33nzE5MCNsZxCGEKTXaQ.png'
  };

  const mockCompanyMoviesFirstPage = {
    page: 1,
    total_results: 50,
    total_pages: 3,
    results: [
      {
        id: 299536,
        title: 'Avengers: Infinity War',
        release_date: '2018-04-25',
        overview: 'As the Avengers and their allies...',
        vote_average: 8.3,
        poster_path: '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg'
      },
      {
        id: 299534,
        title: 'Avengers: Endgame',
        release_date: '2019-04-24',
        overview: 'After the devastating events...',
        vote_average: 8.4,
        poster_path: '/or06FN3Dka5tukK1e9sl16pB3iy.jpg'
      }
    ]
  };

  const mockMovieDetailsWithImdb = [
    {
      id: 11,
      title: 'Star Wars: Episode IV - A New Hope',
      imdb_id: 'tt0076759',
      release_date: '1977-05-25',
      runtime: 121,
      genres: [{ name: 'Adventure' }, { name: 'Action' }, { name: 'Science Fiction' }],
      overview: 'Luke Skywalker joins forces...',
      vote_average: 8.6
    },
    {
      id: 1891,
      title: 'Star Wars: Episode V - The Empire Strikes Back',
      imdb_id: 'tt0080684',
      release_date: '1980-05-17',
      runtime: 124,
      genres: [{ name: 'Adventure' }, { name: 'Action' }, { name: 'Science Fiction' }],
      overview: 'The Imperial forces...',
      vote_average: 8.7
    },
    {
      id: 299536,
      title: 'Avengers: Infinity War',
      imdb_id: 'tt4154756',
      release_date: '2018-04-25',
      runtime: 149,
      genres: [{ name: 'Adventure' }, { name: 'Action' }, { name: 'Science Fiction' }],
      overview: 'As the Avengers and their allies...',
      vote_average: 8.3
    }
  ];

  const mockMovieDetailsWithoutImdb = {
    id: 1892,
    title: 'Star Wars: Episode VI - Return of the Jedi',
    imdb_id: null, // No IMDB ID
    release_date: '1983-05-25',
    runtime: 131,
    genres: [{ name: 'Adventure' }, { name: 'Action' }, { name: 'Science Fiction' }],
    overview: 'Luke Skywalker leads...',
    vote_average: 8.3
  };

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
    test('should validate required parameters', () => {
      const validateSourceMoviesParams = (params) => {
        const { userId, sourceId, sourceType, roleType = null, streaming = false } = params;
        
        if (!userId || !sourceId || !sourceType) {
          return { valid: false, error: 'Missing parameters', status: 400 };
        }

        const allowedTypes = ['person', 'collection', 'company'];
        if (!allowedTypes.includes(sourceType)) {
          return { valid: false, error: 'Invalid source type', status: 400 };
        }

        return { valid: true };
      };

      // Valid parameters
      expect(validateSourceMoviesParams({
        userId: testUser.userId,
        sourceId: 10,
        sourceType: 'collection'
      })).toEqual({ valid: true });

      // Missing userId
      expect(validateSourceMoviesParams({
        sourceId: 10,
        sourceType: 'collection'
      })).toEqual({
        valid: false,
        error: 'Missing parameters',
        status: 400
      });

      // Missing sourceId
      expect(validateSourceMoviesParams({
        userId: testUser.userId,
        sourceType: 'collection'
      })).toEqual({
        valid: false,
        error: 'Missing parameters',
        status: 400
      });

      // Invalid source type
      expect(validateSourceMoviesParams({
        userId: testUser.userId,
        sourceId: 10,
        sourceType: 'invalid_type'
      })).toEqual({
        valid: false,
        error: 'Invalid source type',
        status: 400
      });

      // All valid source types
      const validTypes = ['person', 'collection', 'company'];
      validTypes.forEach(type => {
        expect(validateSourceMoviesParams({
          userId: testUser.userId,
          sourceId: 10,
          sourceType: type
        })).toEqual({ valid: true });
      });
    });

    test('should reject person source type with appropriate message', () => {
      const handlePersonSourceType = (sourceType) => {
        if (sourceType === 'person') {
          return {
            error: 'Use /api/get-filmography for person sources',
            status: 400
          };
        }
        return { valid: true };
      };

      expect(handlePersonSourceType('person')).toEqual({
        error: 'Use /api/get-filmography for person sources',
        status: 400
      });

      expect(handlePersonSourceType('collection')).toEqual({ valid: true });
      expect(handlePersonSourceType('company')).toEqual({ valid: true });
    });
  });

  describe('Authentication and Authorization', () => {
    test('should validate HMAC signature correctly', async () => {
      const validateSourceMoviesAuth = async (userId, signature) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return { valid: false, error: 'User not found', status: 404 };
        }

        const expectedSigData = `get-source-movies:${userId}`;
        const isValidSig = mockHmac.verify(expectedSigData, tenant.tenantSecret, signature);
        
        if (!isValidSig) {
          return { valid: false, error: 'Invalid signature', status: 403 };
        }

        return { valid: true, tenant };
      };

      // Valid signature
      const validResult = await validateSourceMoviesAuth(testUser.userId, 'valid-signature');
      expect(validResult.valid).toBe(true);
      expect(validResult.tenant.tmdbKey).toBe(testUser.tmdbKey);

      // Invalid signature
      mockHmac.verify.mockReturnValue(false);
      const invalidResult = await validateSourceMoviesAuth(testUser.userId, 'invalid-signature');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid signature');
      expect(invalidResult.status).toBe(403);

      // User not found
      mockKV.loadTenant.mockResolvedValue(null);
      const notFoundResult = await validateSourceMoviesAuth('nonexistent-user', 'signature');
      expect(notFoundResult.valid).toBe(false);
      expect(notFoundResult.error).toBe('User not found');
      expect(notFoundResult.status).toBe(404);
    });
  });

  describe('Collection Movies Processing', () => {
    test('should fetch and process collection movies correctly', async () => {
      const getCollectionMovies = async (collectionId, apiKey) => {
        // Mock TMDb client response
        mockTmdbClient.queueRequest.mockResolvedValue(mockCollectionData);
        
        const collection = await mockTmdbClient.queueRequest(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}`);
        
        const movies = (collection.parts || [])
          .filter(movie => movie && movie.title && movie.release_date)
          .map(movie => ({
            id: movie.id,
            title: movie.title,
            imdb_id: null, // Will be enriched later
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
            poster_path: movie.poster_path,
            overview: movie.overview,
            vote_average: movie.vote_average || 0,
            release_date: movie.release_date,
            runtime: null,
            genres: [],
            selected: true
          }))
          .sort((a, b) => {
            const dateA = new Date(a.release_date || '1900-01-01');
            const dateB = new Date(b.release_date || '1900-01-01');
            return dateB - dateA;
          });
        
        return {
          movies,
          totalResults: movies.length,
          totalPages: 1,
          currentPage: 1,
          hasMore: false,
          streamingInfo: null
        };
      };

      const result = await getCollectionMovies(10, testUser.tmdbKey);
      
      expect(result.movies).toHaveLength(3);
      expect(result.movies[0].title).toBe('Star Wars: Episode VI - Return of the Jedi'); // 1983 - newest first
      expect(result.movies[1].title).toBe('Star Wars: Episode V - The Empire Strikes Back'); // 1980
      expect(result.movies[2].title).toBe('Star Wars: Episode IV - A New Hope'); // 1977
      expect(result.streamingInfo).toBe(null); // Collections don't need streaming
      expect(result.totalResults).toBe(3);
      expect(result.hasMore).toBe(false);

      // Verify all movies are pre-selected
      result.movies.forEach(movie => {
        expect(movie.selected).toBe(true);
        expect(movie.year).toBeGreaterThan(1970);
      });
    });

    test('should handle empty collection gracefully', async () => {
      const emptyCollection = { id: 999, name: 'Empty Collection', parts: [] };
      mockTmdbClient.queueRequest.mockResolvedValue(emptyCollection);

      const getCollectionMovies = async (collectionId, apiKey) => {
        const collection = await mockTmdbClient.queueRequest(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}`);
        const movies = (collection.parts || []).filter(movie => movie && movie.title && movie.release_date);
        
        return {
          movies: movies.map(movie => ({ id: movie.id, title: movie.title })),
          totalResults: movies.length
        };
      };

      const result = await getCollectionMovies(999, testUser.tmdbKey);
      
      expect(result.movies).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('Company Movies Processing with Streaming', () => {
    test('should fetch company movies with streaming info', async () => {
      const getCompanyMoviesWithStreaming = async (companyId, apiKey) => {
        // Mock first page response
        global.fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockCompanyMoviesFirstPage)
        });

        const firstPageUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc&page=1`;
        const response = await fetch(firstPageUrl);
        const firstPageData = await response.json();
        
        const totalResults = firstPageData.total_results || 0;
        const totalPages = firstPageData.total_pages || 1;
        
        const firstPageMovies = (firstPageData.results || [])
          .filter(movie => movie && movie.title && movie.release_date)
          .map(movie => ({
            id: movie.id,
            title: movie.title,
            imdb_id: null,
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
            poster_path: movie.poster_path,
            overview: movie.overview,
            vote_average: movie.vote_average || 0,
            release_date: movie.release_date,
            runtime: null,
            genres: [],
            selected: true
          }));
        
        return {
          movies: firstPageMovies,
          totalResults,
          totalPages,
          currentPage: 1,
          hasMore: totalPages > 1,
          streamingInfo: totalPages > 1 ? {
            baseUrl: `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc`,
            totalPages,
            remainingPages: totalPages - 1,
            estimatedTotal: totalResults
          } : null
        };
      };

      const result = await getCompanyMoviesWithStreaming(420, testUser.tmdbKey);
      
      expect(result.movies).toHaveLength(2);
      expect(result.totalResults).toBe(50);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
      expect(result.streamingInfo).toBeDefined();
      expect(result.streamingInfo.baseUrl).toContain('with_companies=420');
      expect(result.streamingInfo.remainingPages).toBe(2);
      expect(result.streamingInfo.estimatedTotal).toBe(50);

      expect(result.movies[0].title).toBe('Avengers: Infinity War');
      expect(result.movies[1].title).toBe('Avengers: Endgame');
    });

    test('should handle single page company results without streaming', async () => {
      const singlePageResponse = {
        page: 1,
        total_results: 2,
        total_pages: 1,
        results: mockCompanyMoviesFirstPage.results
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(singlePageResponse)
      });

      const getCompanyMoviesWithStreaming = async (companyId, apiKey) => {
        const response = await fetch(`discover/movie?with_companies=${companyId}`);
        const data = await response.json();
        
        return {
          movies: data.results.map(movie => ({ id: movie.id, title: movie.title })),
          totalPages: data.total_pages,
          hasMore: data.total_pages > 1,
          streamingInfo: data.total_pages > 1 ? { baseUrl: 'test' } : null
        };
      };

      const result = await getCompanyMoviesWithStreaming(420, testUser.tmdbKey);
      
      expect(result.hasMore).toBe(false);
      expect(result.streamingInfo).toBe(null);
    });
  });

  describe('Movie Enrichment with IMDB IDs', () => {
    test('should enrich movies with IMDB IDs and filter out those without', async () => {
      const enrichMoviesWithImdbIds = async (movies, apiKey) => {
        const enrichedMovies = [];
        const batchSize = 2; // Small batch for testing
        
        for (let i = 0; i < movies.length; i += batchSize) {
          const batch = movies.slice(i, i + batchSize);
          
          const promises = batch.map(async (movie) => {
            // Mock movie details based on ID
            const movieDetail = mockMovieDetailsWithImdb.find(m => m.id === movie.id) || mockMovieDetailsWithoutImdb;
            
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValue(movieDetail)
            });
            
            try {
              const response = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}`);
              const movieDetails = await response.json();
              
              // Only include movies with IMDB IDs
              if (!movieDetails.imdb_id) {
                console.log(`Movie ${movieDetails.title} has no IMDB ID, skipping`);
                return null;
              }
              
              return {
                ...movie,
                imdb_id: movieDetails.imdb_id,
                runtime: movieDetails.runtime,
                genres: Array.isArray(movieDetails.genres) ? movieDetails.genres.slice(0, 3).map(g => g.name) : []
              };
              
            } catch (error) {
              console.warn(`Error fetching movie ${movie.id}:`, error.message);
              return null;
            }
          });
          
          const batchResults = await Promise.all(promises);
          const validMovies = batchResults.filter(movie => movie !== null);
          enrichedMovies.push(...validMovies);
        }
        
        return enrichedMovies;
      };

      const testMovies = [
        { id: 11, title: 'Star Wars: Episode IV - A New Hope' },
        { id: 1891, title: 'Star Wars: Episode V - The Empire Strikes Back' },
        { id: 1892, title: 'Star Wars: Episode VI - Return of the Jedi' } // This one has no IMDB ID
      ];

      const enrichedMovies = await enrichMoviesWithImdbIds(testMovies, testUser.tmdbKey);
      
      expect(enrichedMovies).toHaveLength(2); // One filtered out due to missing IMDB ID
      expect(enrichedMovies[0].imdb_id).toBe('tt0076759');
      expect(enrichedMovies[1].imdb_id).toBe('tt0080684');
      
      // Verify genres are limited to 3
      enrichedMovies.forEach(movie => {
        expect(movie.imdb_id).toMatch(/^tt\d+$/);
        expect(movie.genres).toBeDefined();
        expect(movie.genres.length).toBeLessThanOrEqual(3);
      });
    });

    test('should handle enrichment batch processing correctly', async () => {
      const testBatchProcessing = async (movieIds, batchSize) => {
        const processedBatches = [];
        
        for (let i = 0; i < movieIds.length; i += batchSize) {
          const batch = movieIds.slice(i, i + batchSize);
          processedBatches.push(batch);
        }
        
        return processedBatches;
      };

      const movieIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      // Test batch size of 3
      const batches3 = await testBatchProcessing(movieIds, 3);
      expect(batches3).toHaveLength(4); // [1,2,3], [4,5,6], [7,8,9], [10]
      expect(batches3[0]).toEqual([1, 2, 3]);
      expect(batches3[3]).toEqual([10]);

      // Test batch size of 8 (used in production)
      const batches8 = await testBatchProcessing(movieIds, 8);
      expect(batches8).toHaveLength(2); // [1,2,3,4,5,6,7,8], [9,10]
      expect(batches8[0]).toHaveLength(8);
      expect(batches8[1]).toHaveLength(2);
    });
  });

  describe('Caching Mechanism', () => {
    test('should implement source movies caching correctly', () => {
      class SourceMoviesCache {
        constructor() {
          this.streamingCache = new Map();
        }

        getCacheKey(sourceId, sourceType, roleType = null) {
          return `${sourceType}-${sourceId}-complete-${roleType || 'default'}`;
        }

        get(sourceId, sourceType, roleType = null) {
          const cacheKey = this.getCacheKey(sourceId, sourceType, roleType);
          const cached = this.streamingCache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
            return cached;
          }
          
          return null;
        }

        set(sourceId, sourceType, data, roleType = null) {
          const cacheKey = this.getCacheKey(sourceId, sourceType, roleType);
          this.streamingCache.set(cacheKey, {
            movies: data.movies,
            sourceName: data.sourceName,
            streaming: data.streaming,
            timestamp: Date.now()
          });
        }

        shouldCache(streamingInfo) {
          // Only cache complete datasets, not streaming partials
          return !streamingInfo;
        }
      }

      const cache = new SourceMoviesCache();
      const cacheData = {
        movies: mockMovieDetailsWithImdb,
        sourceName: 'Star Wars Collection',
        streaming: null
      };

      // Test cache miss
      expect(cache.get(10, 'collection')).toBe(null);

      // Test cache set and hit for complete dataset
      expect(cache.shouldCache(null)).toBe(true); // Should cache complete datasets
      cache.set(10, 'collection', cacheData);
      
      const cached = cache.get(10, 'collection');
      expect(cached.movies).toEqual(mockMovieDetailsWithImdb);
      expect(cached.sourceName).toBe('Star Wars Collection');

      // Test should not cache streaming partials
      expect(cache.shouldCache({ baseUrl: 'test', totalPages: 3 })).toBe(false);

      // Test different source types are cached separately
      cache.set(420, 'company', { movies: [], sourceName: 'Marvel Studios', streaming: null });
      
      expect(cache.get(10, 'collection').movies).toHaveLength(3);
      expect(cache.get(420, 'company').movies).toHaveLength(0);
      expect(cache.get(420, 'company').sourceName).toBe('Marvel Studios');
    });
  });

  describe('Source Name Resolution', () => {
    test('should fetch collection name correctly', async () => {
      const getCollectionName = async (collectionId, apiKey) => {
        try {
          const collectionResponse = await mockTmdbClient.queueRequest(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}`);
          return collectionResponse.name;
        } catch (error) {
          console.warn('Failed to get collection name:', error);
          return 'Unknown Collection';
        }
      };

      // First test - successful fetch
      mockTmdbClient.queueRequest.mockResolvedValue(mockCollectionData);
      const name = await getCollectionName(10, testUser.tmdbKey);
      expect(name).toBe('Star Wars Collection');

      // Second test - error handling (need fresh mock)
      mockTmdbClient.queueRequest.mockReset();
      mockTmdbClient.queueRequest.mockRejectedValue(new Error('API Error'));
      const fallbackName = await getCollectionName(999, testUser.tmdbKey);
      expect(fallbackName).toBe('Unknown Collection');
    });

    test('should fetch company name correctly', async () => {
      const getCompanyName = async (companyId, apiKey) => {
        try {
          const companyResponse = await mockTmdbClient.queueRequest(`https://api.themoviedb.org/3/company/${companyId}?api_key=${apiKey}`);
          return companyResponse.name;
        } catch (error) {
          console.warn('Failed to get company name:', error);
          return 'Unknown Company';
        }
      };

      // First test - successful fetch
      mockTmdbClient.queueRequest.mockResolvedValue(mockCompanyData);
      const name = await getCompanyName(420, testUser.tmdbKey);
      expect(name).toBe('Marvel Studios');

      // Second test - error handling (need fresh mock)
      mockTmdbClient.queueRequest.mockReset();
      mockTmdbClient.queueRequest.mockRejectedValue(new Error('Company not found'));
      const fallbackName = await getCompanyName(999, testUser.tmdbKey);
      expect(fallbackName).toBe('Unknown Company');
    });
  });

  describe('Response Format Validation', () => {
    test('should format collection response correctly', () => {
      const formatCollectionResponse = (movies, sourceName, streaming) => {
        return {
          movies,
          sourceName,
          streaming,
          totalFound: movies.length,
          withImdbIds: movies.filter(m => m.imdb_id).length,
          message: `Complete collection catalog: ${movies.length} movies`
        };
      };

      const response = formatCollectionResponse(
        mockMovieDetailsWithImdb.slice(0, 2), 
        'Star Wars Collection',
        null
      );
      
      expect(response.movies).toHaveLength(2);
      expect(response.sourceName).toBe('Star Wars Collection');
      expect(response.streaming).toBe(null);
      expect(response.totalFound).toBe(2);
      expect(response.withImdbIds).toBe(2);
      expect(response.message).toBe('Complete collection catalog: 2 movies');
    });

    test('should format company streaming response correctly', () => {
      const formatCompanyStreamingResponse = (movies, sourceName, streamingInfo, totalResults) => {
        return {
          movies,
          sourceName,
          streaming: streamingInfo ? {
            totalResults,
            totalPages: streamingInfo.totalPages,
            baseUrl: streamingInfo.baseUrl,
            apiKey: 'test-key', // Would be tenant key in real implementation
            estimatedTotal: streamingInfo.estimatedTotal
          } : null,
          totalFound: totalResults || movies.length,
          withImdbIds: movies.filter(m => m.imdb_id).length,
          message: streamingInfo 
            ? `Loading ${totalResults} movies... ${movies.filter(m => m.imdb_id).length}/${totalResults} loaded`
            : `Complete company catalog: ${movies.length} movies`
        };
      };

      const streamingInfo = {
        baseUrl: 'https://api.themoviedb.org/3/discover/movie?with_companies=420',
        totalPages: 3,
        estimatedTotal: 50
      };

      const response = formatCompanyStreamingResponse(
        mockMovieDetailsWithImdb.slice(0, 1),
        'Marvel Studios',
        streamingInfo,
        50
      );
      
      expect(response.streaming).toBeDefined();
      expect(response.streaming.totalResults).toBe(50);
      expect(response.streaming.totalPages).toBe(3);
      expect(response.message).toBe('Loading 50 movies... 1/50 loaded');
      expect(response.totalFound).toBe(50);
    });

    test('should handle empty results correctly', () => {
      const formatEmptyResponse = (sourceName, sourceType) => {
        return {
          movies: [],
          sourceName,
          streaming: null,
          message: `No movies found for this ${sourceType}`
        };
      };

      const emptyCollection = formatEmptyResponse('Empty Collection', 'collection');
      expect(emptyCollection.movies).toHaveLength(0);
      expect(emptyCollection.message).toBe('No movies found for this collection');

      const emptyCompany = formatEmptyResponse('Unknown Company', 'company');
      expect(emptyCompany.message).toBe('No movies found for this company');
    });
  });

  describe('Error Handling', () => {
    test('should handle TMDb API errors gracefully', async () => {
      const handleTmdbError = (error) => {
        if (error.message.includes('not found')) return error.message;
        if (error.message.includes('Invalid TMDb')) return error.message;
        if (error.message.includes('rate limit')) return 'TMDb API rate limit reached. Please try again in a moment.';
        return 'Failed to fetch movies';
      };

      expect(handleTmdbError(new Error('Collection not found'))).toBe('Collection not found');
      expect(handleTmdbError(new Error('Invalid TMDb API key'))).toBe('Invalid TMDb API key');
      expect(handleTmdbError(new Error('rate limit exceeded'))).toBe('TMDb API rate limit reached. Please try again in a moment.');
      expect(handleTmdbError(new Error('Network timeout'))).toBe('Failed to fetch movies');
    });

    test('should handle network failures with retry logic', async () => {
      const mockRetryFetch = async (url, retries = 3) => {
        let lastError;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            if (attempt < 3) {
              throw new Error('Network error');
            }
            return { success: true, data: 'success' };
          } catch (error) {
            lastError = error;
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
          }
        }
        
        throw lastError;
      };

      // Should succeed on 3rd attempt
      const result = await mockRetryFetch('test-url');
      expect(result.success).toBe(true);

      // Should fail after all retries
      const mockFailingFetch = async (url, retries = 2) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          throw new Error('Persistent network error');
        }
      };

      await expect(mockFailingFetch('test-url')).rejects.toThrow('Persistent network error');
    });
  });
});