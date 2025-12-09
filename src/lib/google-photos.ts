/**
 * Google Photos Picker API integration
 * Uses the new Picker API (2024+) instead of the deprecated Library API
 * https://developers.google.com/photos/picker/guides/get-started-picker
 */

// Types
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface PickerMediaItem {
  id: string;
  baseUrl: string;
  mimeType: string;
  mediaFile: {
    mimeType: string;
    filename: string;
    baseUrl: string;
    width?: number;
    height?: number;
  };
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet: boolean;
}

export interface AuthTokens {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: number;
}

// Constants
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

// Picker API scope (new, more limited scope)
const SCOPES = [
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

const STORAGE_KEY = 'google_auth_tokens';

// State
let tokenCache: AuthTokens | null = null;

/**
 * Initialize Google OAuth 2.0
 * Load tokens from storage if available
 */
export function initGoogleAuth(): AuthTokens | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tokens: AuthTokens = JSON.parse(stored);

      // Check if token is expired
      if (tokens.expires_at && Date.now() < tokens.expires_at) {
        tokenCache = tokens;
        return tokens;
      } else {
        // Token expired, clear storage
        localStorage.removeItem(STORAGE_KEY);
        tokenCache = null;
      }
    }
  } catch (error) {
    console.error('Error initializing Google auth:', error);
  }

  return null;
}

/**
 * Sign in with Google OAuth 2.0 (implicit flow)
 * Opens OAuth consent screen and handles redirect
 */
export function signIn(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID environment variable is not set');
  }

  const redirectUri = window.location.origin + window.location.pathname;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
    state: 'google_photos_auth',
  });

  const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  window.location.href = authUrl;
}

/**
 * Handle OAuth redirect and extract tokens from URL hash
 * Call this on app initialization to process OAuth callback
 */
export function handleAuthCallback(): AuthTokens | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const tokenType = params.get('token_type');
  const scope = params.get('scope');
  const state = params.get('state');

  if (accessToken && expiresIn && state === 'google_photos_auth') {
    const tokens: AuthTokens = {
      access_token: accessToken,
      expires_in: parseInt(expiresIn, 10),
      token_type: tokenType || 'Bearer',
      scope: scope || '',
      expires_at: Date.now() + parseInt(expiresIn, 10) * 1000,
    };

    // Store tokens
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    tokenCache = tokens;

    // Clean up URL
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    return tokens;
  }

  return null;
}

/**
 * Sign out and clear stored tokens
 */
export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
  tokenCache = null;
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  // Try to reload from storage
  const tokens = initGoogleAuth();
  return tokens ? tokens.access_token : null;
}

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Fetch current user information
 */
export async function getUserInfo(): Promise<GoogleUser> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Create a new Picker session
 * Returns a session with a pickerUri that opens the Google Photos picker
 */
export async function createPickerSession(): Promise<PickerSession> {
  console.log('createPickerSession: Starting...');
  const accessToken = getAccessToken();
  console.log('createPickerSession: Access token:', accessToken ? 'present' : 'missing');

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  console.log('createPickerSession: Calling API...');
  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  console.log('createPickerSession: Response status:', response.status);

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    const errorText = await response.text();
    console.error('createPickerSession: Error:', errorText);
    throw new Error(`Failed to create picker session: ${response.status} ${errorText}`);
  }

  const session = await response.json();
  console.log('createPickerSession: Success:', session);
  return session;
}

/**
 * Poll a Picker session to check if user has selected media
 */
export async function pollPickerSession(sessionId: string): Promise<PickerSession> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    throw new Error(`Failed to poll picker session: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List media items selected by the user in a Picker session
 */
export async function listPickerMediaItems(
  sessionId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<{ mediaItems: PickerMediaItem[]; nextPageToken?: string }> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    sessionId,
    pageSize: pageSize.toString(),
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(`${PICKER_API_BASE}/mediaItems?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    throw new Error(`Failed to list media items: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    mediaItems: data.mediaItems || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Delete a Picker session (cleanup)
 */
export async function deletePickerSession(sessionId: string): Promise<void> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    console.warn(`Failed to delete picker session: ${response.statusText}`);
  }
}

/**
 * Open the Google Photos Picker in a new window and wait for selection
 * Returns selected media items when user completes selection
 */
export async function openPhotoPicker(): Promise<PickerMediaItem[]> {
  console.log('openPhotoPicker: Creating session...');

  // Create a new session
  const session = await createPickerSession();
  console.log('openPhotoPicker: Session created:', session);

  // Open picker in new window (without autoclose to debug)
  const pickerUrl = session.pickerUri;
  console.log('openPhotoPicker: Opening picker URL:', pickerUrl);

  const pickerWindow = window.open(
    pickerUrl,
    'google-photos-picker',
    'width=1024,height=768'
  );

  if (!pickerWindow) {
    throw new Error('Failed to open picker window. Please allow popups for this site.');
  }

  // Poll session until user selects media or times out
  const pollIntervalMs = parseInt(session.pollingConfig.pollInterval.replace('s', '')) * 1000 || 5000;
  const timeoutMs = parseInt(session.pollingConfig.timeoutIn.replace('s', '')) * 1000 || 300000;
  const startTime = Date.now();

  console.log('openPhotoPicker: Poll interval:', pollIntervalMs, 'ms, timeout:', timeoutMs, 'ms');
  console.log('openPhotoPicker: pollingConfig raw:', session.pollingConfig);

  return new Promise((resolve, reject) => {
    console.log('openPhotoPicker: Starting polling loop...');
    const pollInterval = setInterval(async () => {
      console.log('openPhotoPicker: Poll tick');
      try {
        // Note: We cannot reliably check pickerWindow.closed due to cross-origin restrictions
        // The window navigates to photos.google.com which blocks access to the closed property
        // Instead, we rely on polling and timeout

        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          console.log('openPhotoPicker: Session timed out');
          clearInterval(pollInterval);
          pickerWindow.close();
          await deletePickerSession(session.id);
          reject(new Error('Picker session timed out'));
          return;
        }

        // Poll the session
        console.log('openPhotoPicker: Polling session...');
        const updatedSession = await pollPickerSession(session.id);
        console.log('openPhotoPicker: Poll result:', updatedSession);

        if (updatedSession.mediaItemsSet) {
          console.log('openPhotoPicker: Media items set! Fetching items...');
          clearInterval(pollInterval);

          // Fetch selected media items
          const result = await listPickerMediaItems(session.id);
          console.log('openPhotoPicker: Fetched media items:', result);
          const allItems: PickerMediaItem[] = [...result.mediaItems];

          // Fetch remaining pages if any
          let nextPageToken = result.nextPageToken;
          while (nextPageToken) {
            const nextResult = await listPickerMediaItems(session.id, 50, nextPageToken);
            allItems.push(...nextResult.mediaItems);
            nextPageToken = nextResult.nextPageToken;
          }

          console.log('openPhotoPicker: Total items:', allItems.length, allItems);

          // Cleanup
          await deletePickerSession(session.id);
          pickerWindow.close();

          resolve(allItems);
        }
      } catch (error) {
        console.error('openPhotoPicker: Error during polling:', error);
        clearInterval(pollInterval);
        pickerWindow.close();
        reject(error);
      }
    }, pollIntervalMs);
  });
}

/**
 * Get a downloadable photo URL with optional transformations
 */
export function getPhotoUrl(
  baseUrl: string,
  options?: {
    width?: number;
    height?: number;
    crop?: boolean;
  }
): string {
  const params: string[] = [];

  if (options?.width) {
    params.push(`w${options.width}`);
  }

  if (options?.height) {
    params.push(`h${options.height}`);
  }

  if (options?.crop) {
    params.push('c');
  }

  // Default to downloading the full resolution image
  const suffix = params.length > 0 ? `=${params.join('-')}` : '=d';

  return `${baseUrl}${suffix}`;
}
