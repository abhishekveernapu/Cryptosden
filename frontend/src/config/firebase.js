import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: "cryptosden-82941",
  storageBucket: "cryptosden-82941.firebasestorage.app",
  messagingSenderId: "813879528017",
  appId: "1:813879528017:web:5492605bdfef04167b4670",
  measurementId: "G-1E04N1NPFF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
