import React, { useState, useRef, useEffect } from "react";
import {
  Grid,
  Avatar,
  Button,
  ListItemText,
  List,
  ListItem,
  Collapse,
} from "@mui/material";
import Quill from "quill";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  DocumentData,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "quill/dist/quill.snow.css";
import { toast } from "react-toastify"; // Assuming you're using react-toastify for notifications
import { useAuth } from "../AuthProvider";

interface Reply {
  id: string;
  body: string;
  fileUrl: string;
  mentions: string[];
  author: string;
  commentId: string;
  createdAt: any; // You might want to specify a more specific type for Firestore timestamps
}

interface ReplyCommentProps {
  commentId: string;
}

const initializeQuill = (element: HTMLElement | null, setEditor: React.Dispatch<React.SetStateAction<Quill | null>>) => {
  if (!element) return;
  const editor = new Quill(element, {
    theme: "snow",
    placeholder: "Write a comment...",
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        ["link", "image"],
        ["clean"], // Remove formatting
      ],
    },
  });
  setEditor(editor);
};

const ReplyComment: React.FC<ReplyCommentProps> = ({ commentId }) => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [text, setText] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const quillRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<Quill | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    initializeQuill(quillRef.current, setEditor);
  }, []);

  useEffect(() => {
    // Fetch replies when the component mounts or when commentId changes
    const fetchReplies = async () => {
      const firestore = getFirestore();
      const repliesQuery = query(
        collection(firestore, "Reply"),
        where("commentId", "==", `comments/${commentId}`)
      );
      const querySnapshot = await getDocs(repliesQuery);

      const fetchedReplies: Reply[] = [];
      querySnapshot.forEach((doc) => {
        fetchedReplies.push({ id: doc.id, ...(doc.data() as Omit<Reply, 'id'>) });
      });

      console.log("fetchedReplies:", fetchedReplies);

      setReplies(fetchedReplies);
    };

    fetchReplies();
  }, [commentId]);

  const handleSend = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Get the Quill editor instance
    if (!editor) {
      toast.error("Editor is not initialized.");
      return;
    }

    // Get plain text content from the Quill editor
    const textContent = editor.getText().trim(); // Plain text without HTML tags

    if (!textContent || textContent.length > 250) {
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

    // Extract mentions from the rich text content
    const mentionRegex = /<span.*?data-id="(\w+)".*?>.*?<\/span>/g;
    let match;
    const mentionList: string[] = [];
    const htmlContent = editor.root.innerHTML; // Get HTML content for mention extraction
    while ((match = mentionRegex.exec(htmlContent)) !== null) {
      mentionList.push(match[1]); // Capture the UID from the mention span
    }
    console.log("commentId:", commentId);
    console.log("user:", user);

    try {
      const response = await addDoc(collection(firestore, "Reply"), {
        body: textContent, // Plain text content
        fileUrl,
        mentions: mentionList, // Array of mentioned user UIDs
        author: `Users/${user?.uid}`, // Replace with actual user reference
        commentId: `comments/${commentId}`, // Replace with actual comment reference
        createdAt: serverTimestamp(),
      });

      console.log("Reply added with ID: ", response.id); // Log the ID of the added reply

      // Reset form fields
      if (editor) {
        editor.root.innerHTML = "";
      }
      setText("");
      setFile(null);
    } catch (error) {
      console.error("Error creating reply:", error);
      toast.error("Failed to create reply.");
    }
  };

  return (
    <Grid container alignItems="center" className="comment-input-container">
      <Grid item xs={1}>
        <Avatar
          alt="John Doe"
          src="https://via.placeholder.com/150"
          className="avatar"
        />
      </Grid>
      <Grid
        item
        xs={11}
        style={{
          position: "relative",
        }}
      >
        <div
          ref={quillRef}
          className="comment-textarea"
          style={{
            width: "100%",
            fontSize: "1rem",
            minHeight: "100px",
            padding: "10px",
            borderBottom: "1px solid #ddd",
            fontFamily: "inherit",
          }}
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          variant="contained"
          color="primary"
          className="send-button"
          onClick={handleSend}
        >
          Send
        </Button>
      </Grid>
      {/* Render Replies */}
      <Grid item xs={12}>
        {replies.length > 0 && (
          <Collapse in={replies.length > 0}>
            <List>
              {replies.map((reply) => (
                <ListItem key={reply.id}>
                  <Avatar alt="User" src="https://via.placeholder.com/150" />
                  <ListItemText
                    primary={reply.body}
                    secondary={`Posted by ${reply.author}`}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        )}
      </Grid>
    </Grid>
  );
};

export default ReplyComment;
