import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import QRCode from "qrcode";
import sharp from "sharp";

export const maxDuration = 60;

// Generate a valid QR code as PNG buffer
async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 0, // We'll add margin in composite
      width: 600,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

// Generate artistic background using fal.ai
async function generateArtisticBackground(description: string): Promise<Buffer> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("fal.ai API key not configured");

  fal.config({ credentials: apiKey });

  const prompt = `(masterpiece:1.4), (best quality:1.4), ${description}, abstract artistic patterns, soft gradients, beautiful aesthetic, vibrant colors, professional design, square composition, high contrast`;
  
  const negativePrompt = "QR code, barcode, text, letters, numbers, watermark, signature, low quality, blurry, grid pattern, squares";

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
    },
    logs: true,
  });

  const data = result.data as any;
  
  if (!data?.images?.[0]?.url) {
    throw new Error("No image in fal.ai response");
  }

  // Download the background image
  const response = await fetch(data.images[0].url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Create a beautiful composite: artistic background with QR code overlay
async function createCompositeQRCode(
  qrBuffer: Buffer,
  backgroundBuffer: Buffer
): Promise<Buffer> {
  const outputSize = 1024;
  const qrSize = Math.floor(outputSize * 0.65); // QR takes 65% of image
  const margin = Math.floor((outputSize - qrSize) / 2);

  // Process the background
  const background = await sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover" })
    .toBuffer();

  // Create a white rounded rectangle for QR code background
  const qrBackgroundSize = qrSize + 60; // Add padding around QR
  const qrBackground = await sharp({
    create: {
      width: qrBackgroundSize,
      height: qrBackgroundSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.95 },
    }
  })
    .png()
    .toBuffer();

  // Resize QR code
  const qrResized = await sharp(qrBuffer)
    .resize(qrSize, qrSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  // Composite everything together
  const qrBackgroundOffset = Math.floor((outputSize - qrBackgroundSize) / 2);
  const qrOffset = margin;

  const result = await sharp(background)
    .composite([
      {
        input: qrBackground,
        top: qrBackgroundOffset,
        left: qrBackgroundOffset,
        blend: "over",
      },
      {
        input: qrResized,
        top: qrOffset,
        left: qrOffset,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { url, imageDescription } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const description = imageDescription || "beautiful abstract art with vibrant colors";

    // Step 1: Generate valid QR code
    const qrBuffer = await generateQRCodeBuffer(url);

    // Step 2: Generate artistic background
    const backgroundBuffer = await generateArtisticBackground(description);

    // Step 3: Composite them together
    const compositeBuffer = await createCompositeQRCode(qrBuffer, backgroundBuffer);

    // Convert to base64 data URL
    const base64 = compositeBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ imageUrl: dataUrl });
    
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
