#!/usr/bin/env node
// Generates an EC P-256 key pair for API response encryption.
// Run once, add outputs to .env (backend) and frontend build env.
import crypto from 'crypto'

const ecdh = crypto.createECDH('prime256v1')
ecdh.generateKeys()

// Private key — 32 bytes, base64
const privateKey = ecdh.getPrivateKey('base64')

// Public key — uncompressed point (04 || x || y), 65 bytes, base64
// Web Crypto importKey('raw', ...) expects this format.
const publicKey = ecdh.getPublicKey('base64')

console.log('# ── Backend (add to .env, keep secret) ─────────────────────────')
console.log(`API_ENCRYPTION_KEY=${privateKey}`)
console.log()
console.log('# ── Frontend build (add to .env for frontend image build) ───────')
console.log(`PUBLIC_API_ENCRYPTION_PUBKEY=${publicKey}`)
