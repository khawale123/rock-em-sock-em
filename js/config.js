// Optional: Set your Google Cloud OAuth 2.0 Web Client ID here (or configure it inside the app UI)
// Example: '1234567890-abcdefg.apps.googleusercontent.com'
export const DEFAULT_GOOGLE_CLIENT_ID = '';

export const ROOM_PREFIX = 'rockemsockem-v1-';

export function getGoogleClientId() {
  return localStorage.getItem('rese_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
}

export function setGoogleClientId(clientId) {
  const trimmed = (clientId || '').trim();
  if (trimmed) {
    localStorage.setItem('rese_google_client_id', trimmed);
  } else {
    localStorage.removeItem('rese_google_client_id');
  }
}
