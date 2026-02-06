import { neon } from "@neondatabase/serverless";

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

// Initialize the database schema
export async function initializeDatabase() {
  const sql = getDb();
  
  await sql`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      image_url TEXT NOT NULL,
      description TEXT,
      is_public BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  // Create index for public gallery queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_qr_codes_public_created 
    ON qr_codes (is_public, created_at DESC) 
    WHERE is_public = true
  `;
}
