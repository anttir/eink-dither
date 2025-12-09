/**
 * React hook for Google Photos Picker API integration
 * Manages authentication state and photo selection via Picker
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initGoogleAuth,
  signIn as googleSignIn,
  signOut as googleSignOut,
  handleAuthCallback,
  getUserInfo,
  openPhotoPicker,
  isAuthenticated,
  getPhotoUrl,
  type GoogleUser,
  type PickerMediaItem,
} from '../lib/google-photos';

interface UseGooglePhotosState {
  isSignedIn: boolean;
  user: GoogleUser | null;
  loading: boolean;
  picking: boolean;
  error: string | null;
}

interface UseGooglePhotosReturn extends UseGooglePhotosState {
  signIn: () => void;
  signOut: () => void;
  openPicker: () => Promise<PickerMediaItem[]>;
  clearError: () => void;
}

/**
 * Hook for managing Google Photos authentication and picker
 */
export function useGooglePhotos(): UseGooglePhotosReturn {
  const [state, setState] = useState<UseGooglePhotosState>({
    isSignedIn: false,
    user: null,
    loading: true,
    picking: false,
    error: null,
  });

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
      loading: false,
      picking: false,
      error: null,
    });
  }, []);

  /**
   * Open the Google Photos Picker
   * Returns selected media items
   */
  const openPicker = useCallback(async (): Promise<PickerMediaItem[]> => {
    console.log('useGooglePhotos.openPicker: Starting...');
    console.log('useGooglePhotos.openPicker: isAuthenticated:', isAuthenticated());

    if (!isAuthenticated()) {
      console.log('useGooglePhotos.openPicker: Not authenticated');
      setState(prev => ({
        ...prev,
        error: 'Not authenticated. Please sign in first.',
      }));
      return [];
    }

    setState(prev => ({
      ...prev,
      picking: true,
      error: null,
    }));

    try {
      console.log('useGooglePhotos.openPicker: Calling openPhotoPicker...');
      const selectedItems = await openPhotoPicker();
      console.log('useGooglePhotos.openPicker: Got items:', selectedItems);

      setState(prev => ({
        ...prev,
        picking: false,
      }));

      return selectedItems;
    } catch (error) {
      console.error('useGooglePhotos.openPicker: Error:', error);
      setState(prev => ({
        ...prev,
        picking: false,
        error: error instanceof Error ? error.message : 'Failed to open photo picker',
      }));

      // If authentication expired, update state
      if (error instanceof Error && error.message.includes('expired')) {
        setState(prev => ({
          ...prev,
          isSignedIn: false,
          user: null,
        }));
      }

      return [];
    }
  }, []);

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
    openPicker,
    clearError,
  };
}

// Re-export useful utilities
export { getPhotoUrl, type PickerMediaItem };
