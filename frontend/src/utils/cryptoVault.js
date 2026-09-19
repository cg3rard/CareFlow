/**
 * Zero-Knowledge Vault Engine using Web Crypto API (Client-Side Only)
 * Guarantees that user reflections and emotional shifts are encrypted on the client
 * and NEVER sent to or stored on any server.
 * Standard: AES-GCM 256-bit with PBKDF2 Key Derivation.
 */

const STORAGE_KEY = 'careflow_encrypted_vault_v1';
const SALT_KEY = 'careflow_vault_salt';

// Ensure a persistent device salt exists
function getOrCreateSalt() {
  let saltHex = localStorage.getItem(SALT_KEY);
  if (!saltHex) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SALT_KEY, saltHex);
  }
  return new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

// Derive a 256-bit AES-GCM key from a passphrase (or local device identity)
async function deriveKey(passphrase = 'careflow-zero-knowledge-default-seed') {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = getOrCreateSalt();

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a JavaScript object or string using AES-GCM
 */
export async function encryptData(data, passphrase) {
  try {
    const key = await deriveKey(passphrase);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const cipherBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    return {
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
      ciphertext: Array.from(new Uint8Array(cipherBuffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
      timestamp: new Date().toISOString(),
      algorithm: 'AES-GCM-256'
    };
  } catch (err) {
    console.error('[CryptoVault] Encryption failed:', err);
    throw err;
  }
}

/**
 * Decrypt an AES-GCM ciphertext payload back into the original object
 */
export async function decryptData(encryptedPackage, passphrase) {
  try {
    const key = await deriveKey(passphrase);
    const iv = new Uint8Array(encryptedPackage.iv.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    const cipherBytes = new Uint8Array(encryptedPackage.ciphertext.match(/.{1,2}/g).map(b => parseInt(b, 16)));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuffer));
  } catch (err) {
    console.error('[CryptoVault] Decryption failed (invalid key or corrupted data):', err);
    return null;
  }
}

/**
 * Save an encrypted reflection entry to localStorage
 */
export async function saveReflectionToVault(entry, passphrase) {
  const encryptedPayload = await encryptData(entry, passphrase);
  const rawStorage = localStorage.getItem(STORAGE_KEY);
  const vault = rawStorage ? JSON.parse(rawStorage) : [];
  vault.unshift(encryptedPayload); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  return encryptedPayload;
}

/**
 * Load and decrypt all entries from the vault
 */
export async function loadDecryptedVault(passphrase) {
  const rawStorage = localStorage.getItem(STORAGE_KEY);
  if (!rawStorage) return [];

  try {
    const vault = JSON.parse(rawStorage);
    const decryptedList = [];
    for (const item of vault) {
      const decrypted = await decryptData(item, passphrase);
      if (decrypted) {
        decryptedList.push({
          ...decrypted,
          timestamp: item.timestamp,
          rawIv: item.iv,
          isEncrypted: true
        });
      }
    }
    return decryptedList;
  } catch (err) {
    console.error('[CryptoVault] Failed to load vault:', err);
    return [];
  }
}

/**
 * Purge all data from the vault (zero trace)
 */
export function purgeVault() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

/**
 * Check count of encrypted items currently stored
 */
export function getVaultItemCount() {
  const rawStorage = localStorage.getItem(STORAGE_KEY);
  if (!rawStorage) return 0;
  try {
    const vault = JSON.parse(rawStorage);
    return Array.isArray(vault) ? vault.length : 0;
  } catch {
    return 0;
  }
}
