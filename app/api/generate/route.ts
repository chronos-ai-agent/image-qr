import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import QRCode from "qrcode";

export const maxDuration = 60;

async function generateWithGemini(
  url: string,
  imageUrl: string | undefined,
  imageDescription: string | undefined,
  qrDataUrl: string
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: ["Text", "Image"],
    } as any,
  });

  const parts: any[] = [];

  // Include reference image if available
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const imgResponse = await fetch(imageUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(imgBuffer).toString("base64");
      const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
      parts.push({ inlineData: { mimeType, data: base64 } });
    } catch (e) {
      console.error("Failed to fetch reference image:", e);
    }
  }

  // Add QR code reference
  const qrBase64 = qrDataUrl.split(",")[1];
  parts.push({ inlineData: { mimeType: "image/png", data: qrBase64 } });

  const styleHint = imageDescription || "artistic";
  parts.push({
    text: `Create an artistic image that contains a scannable QR code for: ${url}
Style: ${styleHint}
The QR code must be fully functional with clear finder patterns. Integrate it beautifully into the design.`,
  });

  const response = await model.generateContent(parts);
  for (const part of response.response.candidates?.[0]?.content?.parts || []) {
    if ((part as any).inlineData) {
      const data = (part as any).inlineData.data;
      const mime = (part as any).inlineData.mimeType || "image/png";
      return `data:${mime};base64,${data}`;
    }
  }
  throw new Error("No image in Gemini response");
}

async function generateWithGPTImage(
  url: string,
  imageUrl: string | undefined,
  imageDescription: string | undefined,
  qrDataUrl: string
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const openai = new OpenAI({ apiKey });

  const styleHint = imageDescription || "artistic and visually stunning";
  
  // Build the prompt
  const prompt = `Create a beautiful artistic image with an embedded, scannable QR code.
Style: ${styleHint}
The QR code must encode: ${url}
Requirements:
- The QR code must be FULLY SCANNABLE with clear finder patterns (3 corner squares)
- Integrate the QR code seamlessly into an artistic design
- Make it visually stunning while keeping the QR functional
- High contrast between QR modules for scannability`;

  // gpt-image-1 with image input
  const messages: any[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
      ],
    },
  ];

  // Add reference image if available
  if (imageUrl && imageUrl.startsWith("http")) {
    messages[0].content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  // Add QR code as reference
  messages[0].content.push({
    type: "image_url", 
    image_url: { url: qrDataUrl },
  });

  const response = await openai.responses.create({
    model: "gpt-image-1",
    input: messages,
    tools: [{ type: "image_generation" }],
  });

  // Extract generated image
  for (const output of response.output || []) {
    if (output.type === "image_generation_call" && output.result) {
      return `data:image/png;base64,${output.result}`;
    }
  }

  // Fallback: try images.generate
  const imgResponse = await openai.images.generate({
    model: "gpt-image-1",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  });

  if (imgResponse.data?.[0]?.b64_json) {
    return `data:image/png;base64,${imgResponse.data[0].b64_json}`;
  }
  if (imgResponse.data?.[0]?.url) {
    return imgResponse.data[0].url;
  }

  throw new Error("No image in OpenAI response");
}

export async function POST(request: NextRequest) {
  try {
    const { url, imageUrl, imageDescription, model = "gpt-image" } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Generate base QR code
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
    });

    let resultUrl: string;

    if (model === "gemini") {
      resultUrl = await generateWithGemini(url, imageUrl, imageDescription, qrDataUrl);
    } else {
      resultUrl = await generateWithGPTImage(url, imageUrl, imageDescription, qrDataUrl);
    }

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
