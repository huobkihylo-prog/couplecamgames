import { normalizeRoomCode } from './roomCode';

/**
 * Copies text reliably even inside cross-origin iframes where navigator.clipboard.writeText
 * may throw NotAllowedError, falling back cleanly to an offscreen textarea selection.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Builds a clean shareable invite URL containing ?room=XXXX without leaking transient params.
 */
export function buildRoomShareUrl(
  roomCode: string,
  origin?: string,
  pathname?: string,
): string {
  const cleanCode = normalizeRoomCode(roomCode);
  const baseOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const basePath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (!cleanCode) return `${baseOrigin}${basePath}`;
  return `${baseOrigin}${basePath}?room=${encodeURIComponent(cleanCode)}`;
}

/**
 * Extracts and normalizes a 4-character room code from URL query string (?room=4829).
 */
export function extractRoomCodeFromSearch(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('room');
    if (!raw) return '';
    const clean = normalizeRoomCode(raw);
    return clean.length === 4 ? clean : '';
  } catch {
    return '';
  }
}
