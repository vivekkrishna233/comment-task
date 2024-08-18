// src/components/CommentForm.tsx
import React, { useState, useRef, useEffect, ChangeEvent, MouseEvent } from "react";
import {
    Button,
    Avatar,
    Grid,
    List,
    ListItem,
    ListItemText,
} from "@mui/material";
import { AttachFile } from "@mui/icons-material";
import { toast } from "react-toastify";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    getDocs,
    orderBy,
    query,
    DocumentData
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    User as FirebaseUser
} from "firebase/auth";
import "./CommentForm.css";
import CommentList from "./CommentList";
import { Comment } from "./types"; // Import the Comment type

interface User {
    id: string;
    uid: string;
    displayName: string;
    email: string;
}

const CommentForm: React.FC = () => {
    const [text, setText] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
    const [showMentions, setShowMentions] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>([]);
    const [user, setUser] = useState<FirebaseUser | null>(null); // State for user authentication
    const textRef = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const firestore = getFirestore();
                const usersCollection = collection(firestore, "Users"); // Replace with your collection name for users
                const usersSnapshot = await getDocs(usersCollection);

                const usersList = usersSnapshot.docs.map((doc) => {
                    const data = doc.data() as User;

                    return {
                        id: doc.id,
                        uid: data.uid,
                        displayName: data.displayName,
                        email: data.email,
                    };
                });

                setMentionSuggestions(usersList);
                setUsers(usersList);
            } catch (error) {
                console.error("Error fetching users:", error); // Log any errors
            }
        };

        const loadComments = async () => {
            const firestore = getFirestore();
            const commentsRef = collection(firestore, "comments");
            const q = query(commentsRef, orderBy("createdAt", "desc"));

            const snapshot = await getDocs(q);
            const commentsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Comment[];
            setComments(commentsData);

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);
            setLoading(false);
        };
        loadComments();

        fetchUsers();
    }, []);

    const handleSignInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const auth = getAuth();
        try {
            await signInWithPopup(auth, provider);
            toast.success("Successfully signed in!");
        } catch (error) {
            toast.error("Error signing in: " + (error as Error).message);
        }
    };

    const handleSignOut = async () => {
        const auth = getAuth();
        try {
            await signOut(auth);
            toast.success("Successfully signed out!");
        } catch (error) {
            toast.error("Error signing out: " + (error as Error).message);
        }
    };

    const handleSubmit = async (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!user) {
            toast.info("You need to sign in to post a comment.");
            return;
        }
        if (!text || text.length > 250) {
            toast.error("Comment must be between 1 and 250 characters.");
            return;
        }

        const firestore = getFirestore();
        const storage = getStorage();
        let fileUrl = "";

        if (file) {
            const storageRef = ref(storage, `uploads/${file.name}`);
            await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(storageRef);
        }

        // Extract mentioned display names from the comment text
        const mentionRegex = /data-name="([^"]+)"/g;
        let match;
        const mentions: string[] = [];
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]); // Capture the display name from the mention span
        }

        await addDoc(collection(firestore, "comments"), {
            text: textRef.current?.innerText || "",
            fileUrl,
            mentions, // Array of mentioned user display names
            userId: user.uid,
            username: user.displayName || "",
            userPhoto: user.photoURL || "",
            parentId: "",
            createdAt: serverTimestamp(),
            reactions: {
                like: 0,
                love: 0,
                laugh: 0,
                angry: 0,
            },
        });

        if (textRef.current) {
            textRef.current.innerHTML = "";
        }
        setText("");
        setFile(null);
        setMentionSuggestions([]);
        setShowMentions(false);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files ? e.target.files[0] : null);

    const applyStyle = (command: string) => {
        document.execCommand(command, false, ""); // Use empty string instead of null
        if (textRef.current) {
            setText(textRef.current.innerHTML); // Update the text state with the new content
        }
    };

    const handleTextChange = (e: React.FormEvent<HTMLDivElement>) => {
        const value = (e.target as HTMLDivElement).innerHTML;
        setText(value);

        // Check for '@' character and suggest mentions only if it is present
        const mentionTrigger = /@(\w*)$/;
        const match = value.match(mentionTrigger);
        if (match) {
            const query = match[1]?.toLowerCase();
            const filteredUsers = users.filter((user) =>
                user.displayName.toLowerCase().includes(query)
            );
            setMentionSuggestions(filteredUsers);
            setShowMentions(true);
        } else {
            setMentionSuggestions([]);
            setShowMentions(false);
        }
    };

    const handleMentionClick = (user: User) => {
        const currentText = textRef.current?.innerHTML || "";
        const mentionTrigger = /@(\w*)$/;
        const newText = currentText.replace(
            mentionTrigger,
            `<span contenteditable="false" data-name="${user.displayName}" class="mention">@${user.displayName}</span> `
        );
        if (textRef.current) {
            textRef.current.innerHTML = newText;
        }
        setText(newText);
        setMentionSuggestions([]);
        setShowMentions(false);
        textRef.current?.focus();
    };

    return (
        <div className="comment-form">
            {!user ? (
                <div className="sign-in-container">
                    <Button
                        onClick={handleSignInWithGoogle}
                        variant="contained"
                        color="primary"
                    >
                        Sign in with Google
                    </Button>
                </div>
            ) : (
                <div className="sign-out-container">
                    <Button onClick={handleSignOut} variant="contained" color="secondary">
                        Sign out
                    </Button>
                </div>
            )}
            <div className="comment-header">
                <h3>Comments({comments.length})</h3>
                <div className="sort-options">
                    <button className="sort-button active">Latest</button>
                    <button className="sort-button">Popular</button>
                </div>
            </div>
            <Grid container alignItems="center" className="comment-input-container">
                <Grid item xs={1}>
                    {user && (
                        <Avatar
                            alt={user.displayName || ""}
                            src={user.photoURL || ""}
                            className="avatar"
                        />
                    )}
                </Grid>
                <Grid item xs={11} style={{ position: "relative" }}>
                    <div
                        ref={textRef}
                        contentEditable
                        className="comment-textarea"
                        onInput={handleTextChange}
                        style={{
                            border: "none",
                            outline: "none",
                            width: "100%",
                            fontSize: "1rem",
                            minHeight: "100px",
                            padding: "10px",
                            borderBottom: "1px solid #ddd",
                            fontFamily: "inherit",
                        }}
                    />
                    {showMentions && mentionSuggestions.length > 0 && (
                        <List className="mention-list">
                            {mentionSuggestions.map((user) => (
                                <ListItem
                                    button
                                    key={user.id}
                                    onClick={() => handleMentionClick(user)}
                                    className="mention-item"
                                >
                                    <ListItemText primary={user.displayName || user.email} />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Grid>
                <Grid item xs={12} className="toolbar">
                    <Button
                        variant="text"
                        className="toolbar-button"
                        onClick={() => applyStyle("bold")}
                    >
                        B
                    </Button>
                    <Button
                        variant="text"
                        className="toolbar-button"
                        onClick={() => applyStyle("italic")}
                    >
                        I
                    </Button>
                    <Button
                        variant="text"
                        className="toolbar-button"
                        onClick={() => applyStyle("underline")}
                    >
                        U
                    </Button>
                    <Button variant="text" component="label" className="toolbar-button">
                        <AttachFile />
                        <input type="file" hidden onChange={handleFileChange} />
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        className="send-button"
                        onClick={handleSubmit} // Ensure handleSubmit matches MouseEvent type
                    >
                        Send
                    </Button>
                </Grid>
            </Grid>
            <CommentList comments={comments} setComments={setComments} />
        </div>
    );
};

export default CommentForm;
