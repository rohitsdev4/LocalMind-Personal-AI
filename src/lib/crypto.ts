// ============================================================
// LocalMind — Encryption Utility
// Handles encrypting and decrypting data using AES
// ============================================================

import CryptoJS from "crypto-js";

/**
 * Encrypts a string payload using a PIN (or password).
 * @param payload The data to encrypt
 * @param pin The secret key
 * @returns The encrypted string (Base64)
 */
export function encryptData(payload: string, pin: string): string {
    if (!pin) return payload; // If no PIN is provided, return unencrypted
    try {
        const ciphertext = CryptoJS.AES.encrypt(payload, pin).toString();
        return ciphertext;
    } catch (e) {
        console.error("Encryption failed:", e);
        return payload;
    }
}

/**
 * Decrypts a string payload using a PIN (or password).
 * @param ciphertext The encrypted data (Base64)
 * @param pin The secret key
 * @returns The decrypted string
 */
export function decryptData(ciphertext: string, pin: string): string {
    if (!pin) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, pin);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || ciphertext; // Fallback if decryption fails (e.g. wrong PIN)
    } catch (e) {
        console.error("Decryption failed:", e);
        return ciphertext; // Return original if error
    }
}

/**
 * Hashes a PIN for storage/verification using PBKDF2 to protect against local brute force attacks.
 * Since this is local, we use a static app-level salt to make rainbow tables ineffective,
 * but rely on PBKDF2's iterations for brute force resistance.
 * @param pin The PIN to hash
 * @returns The PBKDF2 hashed PIN
 */
export function hashPin(pin: string): string {
    const salt = "localmind-journal-salt-v1"; // App-level static salt for local use
    const hash = CryptoJS.PBKDF2(pin, salt, {
        keySize: 256 / 32,
        iterations: 100000
    });
    return hash.toString();
}
