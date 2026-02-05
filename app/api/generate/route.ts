import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import QRCode from "qrcode";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url, image } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Generate base QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
    });

    const openai = new OpenAI({ apiKey });

    // Use DALL-E 3 to create an artistic QR code
    const prompt = `Create an artistic QR code image that:
1. Is a beautiful, artistic rendition that incorporates visual patterns from natural imagery
2. Has a clear QR code pattern visible with high contrast between modules
3. The QR code must encode the URL: ${url}
4. Make it scannable by maintaining clear position markers (the three corner squares)
5. Keep the QR modules (squares) clearly defined with good contrast
6. Make it visually stunning while maintaining scannability
7. Use vibrant colors and artistic effects while keeping the QR code functional

Important: The QR code must be functional and scannable. Maintain the standard QR code structure with clear finder patterns in three corners.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    const imageData = response.data?.[0];
    
    if (!imageData) {
      // Fallback: return the basic QR code
      return NextResponse.json({ imageUrl: qrDataUrl });
    }

    // If we got a URL, return it directly
    if (imageData.url) {
      return NextResponse.json({ imageUrl: imageData.url });
    }

    // Fallback to basic QR
    return NextResponse.json({ imageUrl: qrDataUrl });
  } catch (error) {
    console.error("Generation error:", error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          { status: 429 }
        );
      }
      if (error.message.includes("invalid_api_key")) {
        return NextResponse.json(
          { error: "API configuration error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate QR code. Please try again." },
      { status: 500 }
    );
  }
}
