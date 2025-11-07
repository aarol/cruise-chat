# Drizzle ORM + Expo SQLite Setup

This project uses Drizzle ORM with Expo SQLite for local database management, specifically designed for peer-to-peer messaging in a cruise chat application.

## 🗄️ Database Structure

The database currently includes one main table:
- **messages** - Chat messages with user and chat room references

## 🚀 Getting Started

The database is automatically initialized when the app starts. The setup includes:
- Automatic migration running
- SQLite database creation
- Schema validation

## 📝 Available Scripts

- `npm run db:generate` - Generate new migrations after schema changes
- `npm run db:studio` - Open Drizzle Studio (web interface for database)
- `npm run db:push` - Push schema changes directly to database

## 🌐 Mesh Network Integration

The database is tightly integrated with the mesh peer-to-peer network:

- Messages are stored locally when sent or received
- `sentToPeers` field tracks P2P synchronization status
- Message IDs are generated using `nanoid(12)` for uniqueness across peers
- The `useMessages` hook automatically handles P2P message events

### Message Flow

1. User sends message → Stored in local database → Sent to mesh network
2. Message received from peer → Stored in local database → UI updated

## 🔄 Migration Workflow

1. Modify `database/schema.ts`
2. Run `npm run db:generate`
3. Review generated migration in `drizzle/` folder
4. Restart app to apply migrations automatically

The database will automatically run migrations on app startup via the `runMigrations()` function.
