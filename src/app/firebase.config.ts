import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";


const firebaseConfig = {
  apiKey: "AIzaSyDxCBGKk8nT09hdW85-PyOkhw5_JPZLF1A",
  authDomain: "beapp-501d1.firebaseapp.com",
  databaseURL: "https://beapp-501d1-default-rtdb.firebaseio.com",
  projectId: "beapp-501d1",
  storageBucket: "beapp-501d1.appspot.com",
  messagingSenderId: "151993360357",
  appId: "1:151993360357:web:127db5b6d20896fb84990c"
};

// Initialize Firebase only if it hasn't been initialized yet
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);


