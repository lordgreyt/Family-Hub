import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCIjri46O0Ewffwyw2Y1jOHFuLOCHvTtZw",
  authDomain: "familyhub-a588b.firebaseapp.com",
  databaseURL: "https://familyhub-a588b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "familyhub-a588b",
  storageBucket: "familyhub-a588b.firebasestorage.app",
  messagingSenderId: "773504758843",
  appId: "1:773504758843:web:3eb8e389a79d043d06981e",
  measurementId: "G-7ZBNNV1L6F"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
