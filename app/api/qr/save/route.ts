import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { url, imageUrl, description, isPublic } = await request.json();

    if (!url || !imageUrl) {
      return NextResponse.json(
        { error: "URL and imageUrl are required" },
        { status: 400 }
      );
    }

    const sql = getDb();

    const result = await sql`
      INSERT INTO qr_codes (url, image_url, description, is_public)
      VALUES (${url}, ${imageUrl}, ${description || null}, ${isPublic || false})
      RETURNING id, url, image_url, description, is_public, created_at
    `;

    return NextResponse.json({ 
      success: true, 
      qrCode: result[0] 
    });
  } catch (error) {
    console.error("Save QR error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save QR code: ${message}` },
      { status: 500 }
    );
  }
}
