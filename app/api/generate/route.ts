import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import QRCode from "qrcode";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url, image, imageUrl, imageDescription } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Accept either image, imageUrl, or imageDescription
    const imageRef = image || imageUrl || imageDescription;
    if (!imageRef) {
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
    const styleDesc = typeof imageRef === 'string' && imageRef.startsWith('http') 
      ? 'inspired by a beautiful artistic image'
      : imageRef || 'artistic and visually stunning';
    
    const prompt = `Create an artistic image with an embedded QR code that:
1. Has the visual style of: ${styleDesc}
2. Contains a clearly visible, scannable QR code seamlessly integrated into the design
3. The QR code encodes: ${url}
4. Maintains clear position markers (three corner squares) for scannability
5. Uses creative artistic interpretation while keeping the QR code functional
6. The overall image should be beautiful and shareable

Important: The QR code must be functional and scannable. Keep the finder patterns clear.`;

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
