import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isPublic } = await request.json();
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid QR code ID" },
        { status: 400 }
      );
    }

    if (typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "isPublic must be a boolean" },
        { status: 400 }
      );
    }

    const sql = getDb();

    const result = await sql`
      UPDATE qr_codes
      SET is_public = ${isPublic}
      WHERE id = ${id}
      RETURNING id, url, image_url, description, is_public, created_at
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "QR code not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      qrCode: result[0],
    });
  } catch (error) {
    console.error("Update visibility error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update visibility: ${message}` },
      { status: 500 }
    );
  }
}
