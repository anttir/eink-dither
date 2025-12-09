/**
 * Google Photos API integration
 * Handles OAuth 2.0 authentication and photo fetching
 */

// Types
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Photo {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
      focalLength?: number;
      apertureFNumber?: number;
      isoEquivalent?: number;
    };
  };
}

export interface PhotosResponse {
  mediaItems: Photo[];
  nextPageToken?: string;
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
const GOOGLE_PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
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
 * List photos from Google Photos library
 */
export async function listPhotos(
  pageSize: number = 50,
  pageToken?: string
): Promise<PhotosResponse> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const params: Record<string, string> = {
    pageSize: pageSize.toString(),
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const url = `${GOOGLE_PHOTOS_API_BASE}/mediaItems?${new URLSearchParams(params)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    throw new Error(`Failed to fetch photos: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    mediaItems: data.mediaItems || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get a downloadable photo URL with optional transformations
 *
 * @param baseUrl - The base URL from the photo object
 * @param width - Optional width for the image
 * @param height - Optional height for the image
 * @returns Transformed URL for downloading/displaying the photo
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

/**
 * Search photos by date range
 */
export async function searchPhotos(
  startDate: Date,
  endDate: Date,
  pageSize: number = 50,
  pageToken?: string
): Promise<PhotosResponse> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const body = {
    pageSize,
    pageToken,
    filters: {
      dateFilter: {
        ranges: [
          {
            startDate: {
              year: startDate.getFullYear(),
              month: startDate.getMonth() + 1,
              day: startDate.getDate(),
            },
            endDate: {
              year: endDate.getFullYear(),
              month: endDate.getMonth() + 1,
              day: endDate.getDate(),
            },
          },
        ],
      },
    },
  };

  const response = await fetch(`${GOOGLE_PHOTOS_API_BASE}/mediaItems:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401) {
      signOut();
      throw new Error('Authentication expired');
    }
    throw new Error(`Failed to search photos: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    mediaItems: data.mediaItems || [],
    nextPageToken: data.nextPageToken,
  };
}
