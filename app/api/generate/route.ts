import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import QRCode from "qrcode";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url, imageUrl, imageDescription } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Generate a basic QR code first (as fallback and reference)
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
    });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["Text", "Image"],
      } as any,
    });

    // Build prompt parts
    const parts: any[] = [];

    // If we have an image URL, fetch and include it
    if (imageUrl && imageUrl.startsWith("http")) {
      try {
        const imgResponse = await fetch(imageUrl);
        const imgBuffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(imgBuffer).toString("base64");
        const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";

        parts.push({
          inlineData: {
            mimeType,
            data: base64,
          },
        });
      } catch (e) {
        console.error("Failed to fetch reference image:", e);
      }
    }

    // Add the QR code as reference
    const qrBase64 = qrDataUrl.split(",")[1];
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: qrBase64,
      },
    });

    // Add the prompt
    const styleHint = imageDescription || "artistic and visually stunning";
    parts.push({
      text: `Create a beautiful artistic image that:
1. Contains a FULLY SCANNABLE QR code that encodes: ${url}
2. The QR code should be seamlessly integrated into an artistic design inspired by the reference image style
3. Style inspiration: ${styleHint}
4. CRITICAL: The QR code must have clear finder patterns (the three large squares in corners) and be scannable
5. Make it visually stunning while keeping the QR code functional
6. The QR code pattern from the second image shows what needs to be encoded

Generate the image now.`,
    });

    const response = await model.generateContent(parts);
    const result = response.response;

    // Extract image from response
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if ((part as any).inlineData) {
        const imageData = (part as any).inlineData.data;
        const mimeType = (part as any).inlineData.mimeType || "image/png";
        return NextResponse.json({
          imageUrl: `data:${mimeType};base64,${imageData}`,
        });
      }
    }

    // Fallback to basic QR
    return NextResponse.json({ imageUrl: qrDataUrl });
  } catch (error) {
    console.error("Generation error:", error);

    if (error instanceof Error) {
      if (error.message.includes("rate limit") || error.message.includes("quota")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          { status: 429 }
        );
      }
      if (error.message.includes("API key") || error.message.includes("authentication")) {
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
