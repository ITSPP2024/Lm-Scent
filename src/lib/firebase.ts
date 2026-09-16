import { initializeApp } from "firebase/app";

import {
getFirestore
} from "firebase/firestore";

const firebaseConfig = {

apiKey:
"AITUKEY",

authDomain:
"lm-scent.firebaseapp.com",

projectId:
"lm-scent",

storageBucket:
"lm-scent.firebasestorage.app",

messagingSenderId:
"608014416238",

appId:
"1:608014416238:web:8bc31a274ab727062ea97f"

};

const app =
initializeApp(
firebaseConfig
);

export const db =
getFirestore(
app
);

export default app;