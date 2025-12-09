/**
 * React hook for Google Photos integration
 * Manages authentication state and photo fetching
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initGoogleAuth,
  signIn as googleSignIn,
  signOut as googleSignOut,
  handleAuthCallback,
  getUserInfo,
  listPhotos as googleListPhotos,
  isAuthenticated,
  type GoogleUser,
  type Photo,
} from '../lib/google-photos';

interface UseGooglePhotosState {
  isSignedIn: boolean;
  user: GoogleUser | null;
  photos: Photo[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

interface UseGooglePhotosReturn extends UseGooglePhotosState {
  signIn: () => void;
  signOut: () => void;
  fetchPhotos: (reset?: boolean) => Promise<void>;
  fetchMore: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing Google Photos authentication and data
 */
export function useGooglePhotos(): UseGooglePhotosReturn {
  const [state, setState] = useState<UseGooglePhotosState>({
    isSignedIn: false,
    user: null,
    photos: [],
    loading: true,
    error: null,
    hasMore: false,
  });

  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check for OAuth callback
        const tokens = handleAuthCallback();

        if (tokens) {
          // Just got authenticated via OAuth callback
          await loadUserInfo();
        } else {
          // Check existing auth
          const existingTokens = initGoogleAuth();

          if (existingTokens) {
            await loadUserInfo();
          } else {
            setState(prev => ({
              ...prev,
              loading: false,
              isSignedIn: false,
            }));
          }
        }
      } catch (error) {
        console.error('Error initializing Google Photos:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    };

    initialize();
  }, []);

  /**
   * Load user information
   */
  const loadUserInfo = async () => {
    try {
      const userInfo = await getUserInfo();
      setState(prev => ({
        ...prev,
        isSignedIn: true,
        user: userInfo,
        loading: false,
        error: null,
      }));
    } catch (error) {
      console.error('Error loading user info:', error);
      setState(prev => ({
        ...prev,
        isSignedIn: false,
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load user info',
      }));
    }
  };

  /**
   * Sign in with Google
   */
  const signIn = useCallback(() => {
    try {
      googleSignIn();
    } catch (error) {
      console.error('Error signing in:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sign in',
      }));
    }
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(() => {
    googleSignOut();
    setState({
      isSignedIn: false,
      user: null,
      photos: [],
      loading: false,
      error: null,
      hasMore: false,
    });
    setNextPageToken(undefined);
  }, []);

  /**
   * Fetch photos from Google Photos
   */
  const fetchPhotos = useCallback(async (reset: boolean = false) => {
    if (!isAuthenticated()) {
      setState(prev => ({
        ...prev,
        error: 'Not authenticated',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const pageToken = reset ? undefined : nextPageToken;
      const response = await googleListPhotos(50, pageToken);

      setState(prev => ({
        ...prev,
        photos: reset ? response.mediaItems : [...prev.photos, ...response.mediaItems],
        loading: false,
        hasMore: !!response.nextPageToken,
      }));

      setNextPageToken(response.nextPageToken);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch photos',
      }));

      // If authentication expired, update state
      if (error instanceof Error && error.message.includes('expired')) {
        setState(prev => ({
          ...prev,
          isSignedIn: false,
          user: null,
        }));
      }
    }
  }, [nextPageToken]);

  /**
   * Fetch more photos (pagination)
   */
  const fetchMore = useCallback(async () => {
    if (!state.hasMore || state.loading) {
      return;
    }

    await fetchPhotos(false);
  }, [state.hasMore, state.loading, fetchPhotos]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    signIn,
    signOut,
    fetchPhotos,
    fetchMore,
    clearError,
  };
}

/**
 * Hook variant for auto-fetching photos on authentication
 */
export function useGooglePhotosAutoFetch(): UseGooglePhotosReturn {
  const googlePhotos = useGooglePhotos();

  useEffect(() => {
    if (googlePhotos.isSignedIn && googlePhotos.photos.length === 0 && !googlePhotos.loading) {
      googlePhotos.fetchPhotos(true);
    }
  }, [googlePhotos.isSignedIn]);

  return googlePhotos;
}
