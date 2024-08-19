import { initializeApp } from "firebase/app";
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

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);


