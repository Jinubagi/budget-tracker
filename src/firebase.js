import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBoCEs_PAnJ6hBPQGUdi7j9vELjSUm120w",
  authDomain: "budget-tracker-57b4f.firebaseapp.com",
  databaseURL: "https://budget-tracker-57b4f-default-rtdb.firebaseio.com",
  projectId: "budget-tracker-57b4f",
  storageBucket: "budget-tracker-57b4f.firebasestorage.app",
  messagingSenderId: "891818343978",
  appId: "1:891818343978:web:f9e990df47147b32f48d53"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getDatabase(app);