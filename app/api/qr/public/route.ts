import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    const sql = getDb();

    // Get public QR codes with pagination
    const qrCodes = await sql`
      SELECT id, url, image_url, description, created_at
      FROM qr_codes
      WHERE is_public = true
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total FROM qr_codes WHERE is_public = true
    `;
    const total = parseInt(countResult[0]?.total || "0");
    const hasMore = offset + qrCodes.length < total;

    return NextResponse.json({
      qrCodes,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Fetch public QR codes error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch QR codes: ${message}` },
      { status: 500 }
    );
  }
}
