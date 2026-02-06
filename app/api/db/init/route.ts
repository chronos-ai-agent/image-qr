import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db";

// This endpoint initializes the database schema
// Call once during deployment or first setup
export async function POST() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: "Database initialized" });
  } catch (error) {
    console.error("Database initialization error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to initialize database: ${message}` },
      { status: 500 }
    );
  }
}
