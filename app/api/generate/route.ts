import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import QRCode from "qrcode";

export const maxDuration = 60;

async function generateWithFal(
  url: string,
  imageUrl: string | undefined,
  imageDescription: string | undefined
) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("fal.ai API key not configured");

  // Configure fal client
  fal.config({ credentials: apiKey });

  const styleHint = imageDescription || "artistic and visually stunning";
  
  // Optimized prompt for scannable QR codes with proper sizing and contrast
  const prompt = `Generate a square image containing a fully functional, scannable QR code for the URL: ${url}

CRITICAL REQUIREMENTS FOR SCANNABILITY:
1. HIGH CONTRAST: The QR code modules must be clearly BLACK on WHITE or WHITE on BLACK. Do NOT use low-contrast colors.
2. SIZING: The QR code should fill approximately 80-85% of the image width/height, leaving a consistent white margin (quiet zone) of about 8-10% on all sides.
3. FINDER PATTERNS: The three corner squares (finder patterns) must be perfectly clear, sharp, and undistorted.
4. MODULE CLARITY: Each QR code module (square) must have crisp, clean edges - no blur, gradients, or artistic distortion on the actual code elements.
5. QUIET ZONE: Maintain a clean, uncluttered margin around the QR code for reliable scanning.

ARTISTIC INTEGRATION:
- Style inspiration: ${styleHint}
- You may add subtle artistic elements to the BACKGROUND or AROUND the QR code
- The QR code itself must remain clean and high-contrast
- Any artistic styling should NOT interfere with the code's scannability

The QR code MUST be the primary focus, centered, and easily scannable by any smartphone camera.`;

  // Build input for fal.ai nano-banana-pro
  const input: any = {
    prompt: prompt,
    image_size: "square_hd",
  };

  // Add reference image if available (for style matching)
  if (imageUrl && imageUrl.startsWith("http")) {
    input.image_urls = [imageUrl];
  }

  // Use nano-banana-pro for best quality
  const result = await fal.subscribe("fal-ai/nano-banana-pro", {
    input,
    logs: true,
  });

  const data = result.data as any;
  
  if (data?.images?.[0]?.url) {
    return data.images[0].url;
  }
  if (data?.image?.url) {
    return data.image.url;
  }

  throw new Error("No image in fal.ai response");
}

export async function POST(request: NextRequest) {
  try {
    const { url, imageUrl, imageDescription } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const resultUrl = await generateWithFal(url, imageUrl, imageDescription);

    return NextResponse.json({ imageUrl: resultUrl });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (message.includes("rate limit") || message.includes("quota")) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again soon." }, { status: 429 });
    }
    if (message.includes("API key") || message.includes("authentication")) {
      return NextResponse.json({ error: "API configuration error" }, { status: 500 });
    }

    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
