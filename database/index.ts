import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

// Open SQLite database
const expo = openDatabaseSync("cruise-chat.db", { enableChangeListener: true });

// Create drizzle instance
export const db = drizzle(expo, { schema });

// Function to run migrations
export const runMigrations = async () => {
  try {
    console.log("Running database migrations...");
    // Import migrations from the drizzle folder
    const migrations = require("../drizzle/migrations.js");
    await migrate(db, migrations.default);
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

// Export the database instance and schema
export { schema };
export default db;
