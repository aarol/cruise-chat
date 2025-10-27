import { nanoid } from 'nanoid';
import { db } from './index';
import { messages, type NewMessage } from './schema';

/**
 * Adds a new message to the database
 * @param messageData - The message data to insert
 * @returns Promise<string> - The ID of the inserted message
 */
export const addMessage = async (messageData: Omit<NewMessage, 'id' | 'createdAt'>): Promise<string> => {
  // Generate a unique ID for the message (21 characters, URL-safe)
  const messageId = nanoid(12);
  
  const newMessage: NewMessage = {
    id: messageId,
    ...messageData,
  };

  try {
    await db.insert(messages).values(newMessage);
    return messageId;
  } catch (error) {
    console.error('Error adding message to database:', error);
    throw new Error(`Failed to add message: ${error}`);
  }
};

/**
 * Adds a text message to the database
 * @param content - The text content of the message
 * @param userId - The ID of the user sending the message
 * @returns Promise<string> - The ID of the inserted message
 */
export const addTextMessageToDb = async (content: string, userId: string): Promise<string> => {
  return addMessage({
    content,
    userId,
    messageType: 'text',
  });
};

export const getMessageIds = async (): Promise<string[]> => {
  try {
    const rows = await db.select({ id: messages.id }).from(messages);
    return rows.map(r => r.id);
  } catch (error) {
    console.error('Error fetching message ids:', error);
    throw new Error(`Failed to get message ids: ${error}`);
  }
};
