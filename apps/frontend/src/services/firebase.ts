import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAgRrE4DgrTkKf54TsQXARvtpOWKr-3kgs",
    authDomain: "sarah-and-frank-parties.firebaseapp.com",
    projectId: "sarah-and-frank-parties",
    storageBucket: "sarah-and-frank-parties.firebasestorage.app",
    messagingSenderId: "474808305837",
    appId: "1:474808305837:web:9828edca8ad56ee24a5e24"
  };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);