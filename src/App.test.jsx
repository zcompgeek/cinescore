import { it, expect, describe, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInAnonymously: vi.fn().mockResolvedValue({}),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({ uid: 'test-uid' });
    return () => {};
  }),
  signInWithCustomToken: vi.fn(),
  connectAuthEmulator: vi.fn()
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  arrayUnion: vi.fn(),
  increment: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  connectFirestoreEmulator: vi.fn()
}));

describe('App Component', () => {
    it('renders the CineScore title', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('CineScore')).toBeInTheDocument();
        });
        expect(screen.getByText('The Ultimate Soundtrack Trivia')).toBeInTheDocument();
    });
});
