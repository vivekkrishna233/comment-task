import React, { useState, ChangeEvent } from "react";
import {
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Button,
    Chip,
    Grid,
    Typography,
    TextField,
} from "@mui/material";
import { Timestamp, getFirestore, collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { Comment } from "./types";
import ReplyComment from "./ReplyComment"; // Import the ReplyComment component
import "./CommentList.css";

type Reply = {
    text: string;
    createdAt: Timestamp;
};

interface CommentListProps {
    comments: Comment[];
    setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
}

const CommentList: React.FC<CommentListProps> = ({ comments, setComments }) => {
    const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
    const [replyVisible, setReplyVisible] = useState<{ [key: string]: boolean }>({});
    const [loading, setLoading] = useState<boolean>(false);

    const handleReplyClick = (commentId: string) => {
        setReplyVisible((prev) => ({
            ...prev,
            [commentId]: !prev[commentId],
        }));
    };

    const handleReplyChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, commentId: string) => {
        setReplyText((prev) => ({
            ...prev,
            [commentId]: e.target.value,
        }));
    };

    const handleReplySubmit = async (commentId: string) => {
        if (!replyText[commentId]) return;

        const firestore = getFirestore();
        const commentDoc = doc(firestore, "comments", commentId);
        const commentSnapshot = await getDoc(commentDoc);

        if (!commentSnapshot.exists()) return;

        const updatedReplies = [
            ...(commentSnapshot.data()?.replies || []),
            {
                text: replyText[commentId],
                createdAt: Timestamp.now(),
            },
        ];

        await updateDoc(commentDoc, { replies: updatedReplies });

        setComments((prevComments) =>
            prevComments.map((comment) =>
                comment.id === commentId
                    ? { ...comment, replies: updatedReplies }
                    : comment
            )
        );
        setReplyText((prev) => ({
            ...prev,
            [commentId]: "",
        }));
        setReplyVisible((prev) => ({
            ...prev,
            [commentId]: false,
        }));
    };

    const handleReaction = async (commentId: string, reactionType: keyof Comment["reactions"]) => {
        const firestore = getFirestore();
        const commentDoc = doc(firestore, "comments", commentId);
        const commentSnapshot = await getDoc(commentDoc);

        if (!commentSnapshot.exists()) return;

        const reactions = commentSnapshot.data()?.reactions || { like: 0, love: 0, laugh: 0, angry: 0 };
        reactions[reactionType] = (reactions[reactionType] || 0) + 1;

        await updateDoc(commentDoc, { reactions });

        setComments((prevComments) =>
            prevComments.map((comment) =>
                comment.id === commentId
                    ? { ...comment, reactions }
                    : comment
            )
        );
    };

    const loadMoreComments = async () => {
        setLoading(true);

        const firestore = getFirestore();
        const commentsRef = collection(firestore, "comments");
        const q = query(commentsRef, orderBy("createdAt", "desc"), startAfter(comments[comments.length - 1]?.createdAt || Timestamp.now()), limit(10));

        const snapshot = await getDocs(q);
        const newComments = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Comment[];

        setComments((prevComments) => [...prevComments, ...newComments]);
        setLoading(false);
    };

    return (
        <div className="comment-list">
            <List className="comment-list-content">
                {comments.map((comment) => (
                    <ListItem alignItems="flex-start" key={comment.id} className="comment-list-item">
                        <Grid container spacing={2}>
                            <Grid item xs={1}>
                                <ListItemAvatar>
                                    <Avatar
                                        alt={comment.username}
                                        src={comment.userPhoto || ""}
                                        className="comment-avatar"
                                    />
                                </ListItemAvatar>
                            </Grid>
                            <Grid item xs={11}>
                                <ListItemText
                                    primary={
                                        <Typography
                                            variant="subtitle1"
                                            className="comment-username"
                                        >
                                            {comment.username}
                                        </Typography>
                                    }
                                    secondary={
                                        <>
                                            <Typography variant="body2" className="comment-text">
                                                {comment.text}
                                            </Typography>
                                            {comment.fileUrl && (
                                                <img
                                                    src={comment.fileUrl}
                                                    alt="attachment"
                                                    className="comment-image"
                                                />
                                            )}
                                            <div className="comment-mentions">
                                                Mentions:{" "}
                                                {comment.mentions.map((mention) => (
                                                    <Chip
                                                        key={mention}
                                                        label={`@${mention}`}
                                                        size="small"
                                                        className="mention-chip"
                                                    />
                                                ))}
                                            </div>
                                            <div className="comment-reactions">
                                                <Button
                                                    variant="text"
                                                    onClick={() => handleReaction(comment.id, "like")}
                                                    className="reaction-button"
                                                >
                                                    👍 ({comment.reactions.like || 0})
                                                </Button>
                                                <Button
                                                    variant="text"
                                                    onClick={() => handleReaction(comment.id, "love")}
                                                    className="reaction-button"
                                                >
                                                    ❤️ ({comment.reactions.love || 0})
                                                </Button>
                                                <Button
                                                    variant="text"
                                                    onClick={() => handleReaction(comment.id, "laugh")}
                                                    className="reaction-button"
                                                >
                                                    😂 ({comment.reactions.laugh || 0})
                                                </Button>
                                                <Button
                                                    variant="text"
                                                    onClick={() => handleReaction(comment.id, "angry")}
                                                    className="reaction-button"
                                                >
                                                    😡 ({comment.reactions.angry || 0})
                                                </Button>
                                            </div>
                                            <Button
                                                variant="text"
                                                onClick={() => handleReplyClick(comment.id)}
                                                className="reply-button"
                                            >
                                                Reply
                                            </Button>
                                            {replyVisible[comment.id] && (
                                                <div className="reply-section">
                                                    <ReplyComment commentId={comment.id} />
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            </Grid>
                        </Grid>
                    </ListItem>
                ))}
                <Button
                    onClick={loadMoreComments}
                    disabled={loading}
                    className="load-more-button"
                >
                    {loading ? "Loading..." : "Load More"}
                </Button>
            </List>
        </div>
    );
};

export default CommentList;
