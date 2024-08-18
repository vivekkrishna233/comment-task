// src/components/SignIn.jsx
import React from "react";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuth } from "../AuthProvider"; // Adjust the path if necessary

const SignIn = () => {
    const auth = getAuth(); // Get Firebase Auth instance
    const provider = new GoogleAuthProvider(); // Create a new Google Auth provider

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, provider); // Sign in with Google
            // You can access the user info from result.user
            console.log("result: ", result);
            console.log(result.user);
        } catch (error) {
            console.error("Error signing in with Google:", error);
        }
    };

    return (
        <div>
            <button onClick={signInWithGoogle}>Sign in with Google</button>
        </div>
    );
};

export default SignIn;
