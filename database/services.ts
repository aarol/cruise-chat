import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { type Message, messages, type NewMessage } from "./schema";

/**
 * Adds a new message to the database
 * @param messageData - The message data to insert
 * @returns Promise<string> - The ID of the inserted message
 */
export const addMessage = async (
  message: string,
  userId: string,
  chatId: string,
): Promise<Message> => {
  const messageId = nanoid(12);

  const newMessage: NewMessage = {
    id: messageId,
    content: message,
    userId,
    chatId,
  };

  try {
    const msg = await db.insert(messages).values(newMessage).returning();
    return msg[0];
  } catch (error) {
    console.error("Error adding message to database:", error);
    throw new Error(`Failed to add message: ${error}`);
  }
};

export const getMessageIds = async (): Promise<string[]> => {
  try {
    const rows = await db.select({ id: messages.id }).from(messages);
    return rows.map((r) => r.id);
  } catch (error) {
    console.error("Error fetching message ids:", error);
    throw new Error(`Failed to get message ids: ${error}`);
  }
};

export const getMessages = async (chatId: string): Promise<Message[]> => {
  try {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw new Error(`Failed to get messages: ${error}`);
  }
};

export const getMessageCount = async (): Promise<number> => {
  try {
    const result = await db.select().from(messages);
    return result.length;
  } catch (error) {
    console.error("Error counting messages:", error);
    throw new Error(`Failed to count messages: ${error}`);
  }
};
