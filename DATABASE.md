# Drizzle ORM + Expo SQLite Setup

This project now includes Drizzle ORM with Expo SQLite for local database management.

## 🗄️ Database Structure

The database includes the following tables:
- **users** - User profiles and authentication data
- **chat_rooms** - Chat room information
- **messages** - Chat messages with user and room references
- **user_chat_rooms** - Junction table for user-room relationships
- **user_locations** - Location sharing data for cruise passengers

## 🚀 Getting Started

### 1. Database Initialization

The database is automatically initialized when the app starts. The `useDatabase` hook handles:
- Running migrations
- Creating tables
- Error handling

### 2. Using the Database

Import the database services in your components:

```typescript
import { 
  createUser, 
  createChatRoom, 
  createMessage,
  getChatRoomsForUser,
  getMessagesForChatRoom 
} from '@/database/services';
```

### 3. Using React Hooks

The project includes custom hooks for common operations:

```typescript
import { useUser, useChatRooms, useMessages } from '@/hooks/useCruiseChat';

// In your component
const { currentUser, registerUser } = useUser();
const { chatRooms, createNewChatRoom } = useChatRooms(currentUser?.id || 0);
const { messages, sendMessage } = useMessages(chatRoomId);
```

## 📝 Available Scripts

- `npm run db:generate` - Generate new migrations after schema changes
- `npm run db:studio` - Open Drizzle Studio (web interface for database)
- `npm run db:push` - Push schema changes directly to database

## 🔧 Schema Management

### Adding New Tables

1. Edit `database/schema.ts` to add new table definitions
2. Run `npm run db:generate` to create migration files
3. Restart the app to apply migrations

### Example: Adding a new table

```typescript
// In database/schema.ts
export const newTable = sqliteTable('new_table', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
```

## 🔍 Database Services

The `database/services.ts` file contains pre-built functions for common operations:

### User Operations
- `createUser(userData)` - Create a new user
- `getUserById(id)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `updateUser(id, data)` - Update user data

### Chat Room Operations
- `createChatRoom(roomData)` - Create a new chat room
- `getChatRoomsForUser(userId)` - Get all rooms for a user
- `joinChatRoom(userId, roomId)` - Join a user to a room
- `leaveChatRoom(userId, roomId)` - Remove user from room

### Message Operations
- `createMessage(messageData)` - Send a new message
- `getMessagesForChatRoom(roomId)` - Get messages for a room
- `deleteMessage(messageId, userId)` - Delete a message

### Location Operations
- `saveUserLocation(locationData)` - Save user's location
- `getSharedLocations()` - Get all shared locations
- `toggleLocationSharing(userId, isShared)` - Toggle location sharing

## 🎯 Example Usage

Check out `components/DatabaseExample.tsx` for a complete example of:
- User registration
- Chat room creation
- Displaying data from the database

## 🔒 Type Safety

All database operations are fully typed using Drizzle's inferred types:

```typescript
import type { User, NewUser, ChatRoom, Message } from '@/database/schema';

// Fully typed operations
const user: User = await getUserById(1);
const newUser: NewUser = { username: 'john', email: 'john@example.com', displayName: 'John' };
```

## 🛠️ Development Tips

1. **Database Studio**: Run `npm run db:studio` to visually inspect your database
2. **Migrations**: Always generate migrations after schema changes
3. **Type Safety**: Use the exported types from schema for better development experience
4. **Error Handling**: All database operations can throw errors, always wrap in try-catch
5. **Performance**: Use the provided hooks for automatic loading states and error handling

## 📱 Platform Support

This setup works on:
- ✅ iOS
- ✅ Android
- ✅ Web (using SQLite WASM)

## 🔄 Migration Workflow

1. Modify `database/schema.ts`
2. Run `npm run db:generate`
3. Review generated migration in `drizzle/` folder
4. Restart app to apply migrations automatically

The database will automatically run migrations on app startup, ensuring all users have the latest schema.