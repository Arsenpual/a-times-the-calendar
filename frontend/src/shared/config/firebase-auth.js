import { getAuth } from "firebase/auth";
import { firebaseApp } from "../../firebase-config.js";

export const auth = getAuth(firebaseApp);
