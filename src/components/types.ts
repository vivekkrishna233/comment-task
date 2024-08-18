// src/components/types.ts
import { Timestamp } from "firebase/firestore";

export type Comment = {
    id: string;
    text: string;
    fileUrl?: string;
    mentions: string[];
    userId: string;
    username: string;
    userPhoto?: string;
    parentId: string; // Ensure this is included
    createdAt: Timestamp;
    reactions: {
        like: number;
        love: number;
        laugh: number;
        angry: number;
    };
    replies?: Reply[];
};

export type Reply = {
    text: string;
    createdAt: Timestamp;
};
