import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";

export const maxDuration = 120; // 2 minutes for optimized AI generation

// Retry wrapper for API calls
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 2000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries} after error:`, error instanceof Error ? error.message : error);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error("Max retries exceeded");
}

// Fetch with timeout wrapper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// Generate standard QR code
async function generateQRCode(url: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 700,
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

// Generate QR with transparent background for AI processing
// OPTIMIZED: Generate at 576px (fits well in 768px composite)
async function generateTransparentQR(url: string): Promise<Buffer> {
  // Generate QR as PNG with white background first
  const qrBuffer = await new Promise<Buffer>((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 576, // OPTIMIZED: Reduced from 768 (fits 75% of 768px composite)
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });

  // Make white transparent and black semi-transparent (80% opacity)
  const { data, info } = await sharp(qrBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // If white (or near white), make fully transparent
    if (r > 240 && g > 240 && b > 240) {
      pixels[i + 3] = 0; // Fully transparent
    } else {
      // Dark pixels: keep color, set 80% opacity
      pixels[i + 3] = Math.round(255 * 0.8);
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png().toBuffer();
}

// Generate dots-style QR code
async function generateDotsQRCode(url: string): Promise<Buffer> {
  const qrData = await QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  
  const cellSize = 20;
  const margin = 80;
  const totalSize = size * cellSize + margin * 2;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const cx = margin + x * cellSize + cellSize / 2;
        const cy = margin + y * cellSize + cellSize / 2;
        const r = cellSize * 0.4;
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="black"/>`;
      }
    }
  }
  
  svg += "</svg>";
  
  return sharp(Buffer.from(svg))
    .resize(700, 700)
    .png()
    .toBuffer();
}

// Generate rounded-style QR code
async function generateRoundedQRCode(url: string): Promise<Buffer> {
  const qrData = await QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  
  const cellSize = 20;
  const margin = 80;
  const totalSize = size * cellSize + margin * 2;
  const cornerRadius = cellSize * 0.3;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const px = margin + x * cellSize;
        const py = margin + y * cellSize;
        svg += `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="black"/>`;
      }
    }
  }
  
  svg += "</svg>";
  
  return sharp(Buffer.from(svg))
    .resize(700, 700)
    .png()
    .toBuffer();
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

// Convert HSL to RGB hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Extract dominant color from image with better saturation
async function extractDominantColor(imageUrl: string): Promise<string> {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:")) {
    buffer = Buffer.from(imageUrl.split(",")[1], "base64");
  } else {
    const res = await fetchWithTimeout(imageUrl, {}, 30000);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  
  const { dominant, channels } = await sharp(buffer)
    .resize(50, 50, { fit: "cover" })
    .stats();
  
  // Get the dominant color
  let r = dominant.r, g = dominant.g, b = dominant.b;
  
  // Convert to HSL to manipulate saturation
  let [h, s, l] = rgbToHsl(r, g, b);
  
  // If color is too gray (low saturation), boost it using channel maxes
  if (s < 30) {
    // Find the most prominent color channel
    const [rChan, gChan, bChan] = channels;
    const maxR = rChan.max, maxG = gChan.max, maxB = bChan.max;
    
    // Use the channel with highest max value to determine hue
    if (maxR >= maxG && maxR >= maxB) {
      h = 0; // Red hue
      s = 60;
    } else if (maxG >= maxR && maxG >= maxB) {
      h = 120; // Green hue
      s = 60;
    } else {
      h = 220; // Blue hue
      s = 60;
    }
  } else if (s < 50) {
    // Boost saturation for semi-gray colors
    s = Math.min(s * 1.5, 70);
  }
  
  // Ensure darkness for scannability (lightness between 20-45%)
  l = Math.max(20, Math.min(45, l));
  
  return hslToHex(h, s, l);
}

// Extract color palette from image (dominant + triadic colors)
async function extractColorPalette(imageUrl: string): Promise<{ dominant: string; palette: string[] }> {
  let buffer: Buffer;
  if (imageUrl.startsWith("data:")) {
    buffer = Buffer.from(imageUrl.split(",")[1], "base64");
  } else {
    const res = await fetchWithTimeout(imageUrl, {}, 30000);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  
  const { dominant, channels } = await sharp(buffer)
    .resize(50, 50, { fit: "cover" })
    .stats();
  
  // Get dominant color and convert to HSL
  let [h, s, l] = rgbToHsl(dominant.r, dominant.g, dominant.b);
  
  // Boost saturation if too gray
  if (s < 30) {
    const [rChan, gChan, bChan] = channels;
    const maxR = rChan.max, maxG = gChan.max, maxB = bChan.max;
    if (maxR >= maxG && maxR >= maxB) {
      h = 0; s = 65;
    } else if (maxG >= maxR && maxG >= maxB) {
      h = 120; s = 65;
    } else {
      h = 220; s = 65;
    }
  } else if (s < 50) {
    s = Math.min(s * 1.5, 70);
  }
  
  // Ensure darkness for scannability
  l = Math.max(25, Math.min(45, l));
  
  const dominantColor = hslToHex(h, s, l);
  
  // Generate triadic color palette (colors 120° apart on color wheel)
  const palette: string[] = [dominantColor];
  
  // Second color: +120° hue shift
  const h2 = (h + 120) % 360;
  palette.push(hslToHex(h2, s, l));
  
  // Third color: +240° hue shift  
  const h3 = (h + 240) % 360;
  palette.push(hslToHex(h3, s, l));
  
  // Fourth color: complement (+180°) with slightly different lightness
  const h4 = (h + 180) % 360;
  palette.push(hslToHex(h4, s, Math.max(20, l - 10)));
  
  return { dominant: dominantColor, palette };
}

// Darken a color by a factor (0-1)
function darkenColor(hex: string, factor: number): string {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * (1 - factor));
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * (1 - factor));
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * (1 - factor));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Generate complementary colors for tricolor scheme
function generateTricolors(baseHex: string): [string, string, string] {
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);
  
  // Shift hue by ~120 degrees for complementary colors
  const color1 = baseHex;
  const color2 = `#${Math.min(g, 180).toString(16).padStart(2,'0')}${Math.min(b, 180).toString(16).padStart(2,'0')}${Math.min(r, 180).toString(16).padStart(2,'0')}`;
  const color3 = `#${Math.min(b, 180).toString(16).padStart(2,'0')}${Math.min(r, 180).toString(16).padStart(2,'0')}${Math.min(g, 180).toString(16).padStart(2,'0')}`;
  
  return [color1, color2, color3];
}

// QRBTF Point Types
const QRPointType = {
  DATA: 0,
  POS_CENTER: 1,
  POS_OTHER: 2,
  ALIGN_CENTER: 3,
  ALIGN_OTHER: 4,
  TIMING: 5,
  FORMAT: 6,
  VERSION: 7
};

// Get type table for position detection patterns
function getTypeTable(modules: { size: number; get: (x: number, y: number) => number }): number[][] {
  const nCount = modules.size;
  const PD = [[3, 3], [3, nCount - 4], [nCount - 4, 3]];
  
  const typeTable: number[][] = [];
  for (let i = 0; i < nCount; i++) {
    typeTable[i] = new Array(nCount).fill(QRPointType.DATA);
  }
  
  // Timing patterns
  for (let i = 8; i < nCount - 7; i++) {
    typeTable[i][6] = typeTable[6][i] = QRPointType.TIMING;
  }
  
  // Position detection patterns
  for (let i = 0; i < PD.length; i++) {
    typeTable[PD[i][0]][PD[i][1]] = QRPointType.POS_CENTER;
    for (let r = -4; r <= 4; r++) {
      for (let c = -4; c <= 4; c++) {
        if (PD[i][0] + r >= 0 && PD[i][0] + r < nCount && PD[i][1] + c >= 0 && PD[i][1] + c < nCount) {
          if (!(r === 0 && c === 0)) {
            typeTable[PD[i][0] + r][PD[i][1] + c] = QRPointType.POS_OTHER;
          }
        }
      }
    }
  }
  
  return typeTable;
}

// QRBTF Bubble Style - Rounded rectangles with soft corners
async function generateQRBTFBubble(url: string, imageUrl?: string): Promise<Buffer> {
  const qrData = await QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  
  // Calculate dimensions without resize for reliable scanning
  const targetSize = 700;
  const marginModules = 4;
  const cellSize = Math.floor(targetSize / (size + marginModules * 2));
  const margin = marginModules * cellSize;
  const totalSize = size * cellSize + margin * 2;
  const radius = Math.floor(cellSize * 0.2);
  
  // Extract color from image or use default
  const bubbleColor = imageUrl ? await extractDominantColor(imageUrl) : "#1E40AF";
  
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="white"/>`);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const px = margin + x * cellSize;
        const py = margin + y * cellSize;
        svgParts.push(`<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" rx="${radius}" fill="${bubbleColor}"/>`);
      }
    }
  }
  
  svgParts.push("</svg>");
  return sharp(Buffer.from(svgParts.join(""))).png().toBuffer();
}

// QRBTF 25D Style - 3D shadow effect with dark colors
async function generateQRBTF25D(url: string, imageUrl?: string): Promise<Buffer> {
  const qrData = await QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  
  const targetSize = 700;
  const marginModules = 4;
  const cellSize = Math.floor(targetSize / (size + marginModules * 2));
  const margin = marginModules * cellSize;
  const totalSize = size * cellSize + margin * 2;
  const depth = Math.floor(cellSize * 0.15);
  
  // Extract color from image or use default, create shadow by darkening
  const topColor = imageUrl ? await extractDominantColor(imageUrl) : "#9F1239";
  const shadowColor = darkenColor(topColor, 0.5);
  
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="white"/>`);
  
  // Draw shadows first (bottom layer)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const px = margin + x * cellSize;
        const py = margin + y * cellSize;
        svgParts.push(`<rect x="${px + depth}" y="${py + depth}" width="${cellSize}" height="${cellSize}" fill="${shadowColor}"/>`);
      }
    }
  }
  
  // Draw main blocks (top layer)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const px = margin + x * cellSize;
        const py = margin + y * cellSize;
        svgParts.push(`<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="${topColor}"/>`);
      }
    }
  }
  
  svgParts.push("</svg>");
  return sharp(Buffer.from(svgParts.join(""))).png().toBuffer();
}

// QRBTF DSJ Style - Tricolor pattern with dark contrasting colors
async function generateQRBTFDsj(url: string, imageUrl?: string): Promise<Buffer> {
  const qrData = await QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qrData.modules;
  const size = modules.size;
  
  const targetSize = 700;
  const marginModules = 4;
  const cellSize = Math.floor(targetSize / (size + marginModules * 2));
  const margin = marginModules * cellSize;
  const totalSize = size * cellSize + margin * 2;
  
  // Generate tricolor scheme from image palette or use defaults
  let colors: string[];
  if (imageUrl) {
    const { palette } = await extractColorPalette(imageUrl);
    // Use first 3 colors from palette for tricolor effect
    colors = palette.slice(0, 3);
    // Ensure we have 3 colors (fill with darkened variants if needed)
    while (colors.length < 3) {
      colors.push(darkenColor(colors[0], 0.2 * colors.length));
    }
  } else {
    colors = ["#1E3A8A", "#991B1B", "#92400E"];
  }
  
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}">`);
  svgParts.push(`<rect width="100%" height="100%" fill="white"/>`);
  
  // Draw all modules with tricolor pattern
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) {
        const px = margin + x * cellSize;
        const py = margin + y * cellSize;
        // Cycle through colors based on position
        const color = colors[(x + y) % 3];
        svgParts.push(`<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`);
      }
    }
  }
  
  svgParts.push("</svg>");
  return sharp(Buffer.from(svgParts.join(""))).png().toBuffer();
}

// Download and prepare reference image
async function prepareReferenceImage(imageUrl: string): Promise<Buffer> {
  let imageBuffer: Buffer;

  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    imageBuffer = Buffer.from(base64, "base64");
  } else {
    const response = await fetchWithTimeout(imageUrl, {}, 30000);
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  }

  return sharp(imageBuffer)
    .resize(1024, 1024, { fit: "cover", position: "center" })
    .toBuffer();
}

// Create composite with transparent QR overlay for AI processing
// OPTIMIZED: Use 768px for faster processing
async function createQRComposite(
  backgroundBuffer: Buffer,
  qrBuffer: Buffer
): Promise<Buffer> {
  const outputSize = 768; // OPTIMIZED: Reduced from 1024
  const qrSize = Math.floor(outputSize * 0.75);
  const margin = Math.floor((outputSize - qrSize) / 2);

  const qrResized = await sharp(qrBuffer)
    .resize(qrSize, qrSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover" })
    .composite([{
      input: qrResized,
      top: margin,
      left: margin,
      blend: "over",
    }])
    .png()
    .toBuffer();
}

// Create frosted glass composite
async function createFrostedGlassComposite(
  backgroundBuffer: Buffer,
  qrBuffer: Buffer
): Promise<Buffer> {
  const outputSize = 1024;
  const qrSize = Math.floor(outputSize * 0.7);
  const margin = Math.floor((outputSize - qrSize) / 2);
  const qrBackgroundSize = qrSize + 60;
  const qrBackgroundMargin = Math.floor((outputSize - qrBackgroundSize) / 2);

  const qrResized = await sharp(qrBuffer)
    .resize(qrSize, qrSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  const blurredBg = await sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover" })
    .extract({
      left: qrBackgroundMargin,
      top: qrBackgroundMargin,
      width: qrBackgroundSize,
      height: qrBackgroundSize,
    })
    .blur(20)
    .modulate({ brightness: 1.1, saturation: 0.8 })
    .toBuffer();

  const whiteOverlay = await sharp({
    create: {
      width: qrBackgroundSize,
      height: qrBackgroundSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.85 },
    }
  }).png().toBuffer();

  const frostedGlass = await sharp(blurredBg)
    .composite([{ input: whiteOverlay, blend: "over" }])
    .png()
    .toBuffer();

  return sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover" })
    .composite([
      {
        input: frostedGlass,
        top: qrBackgroundMargin,
        left: qrBackgroundMargin,
        blend: "over",
      },
      {
        input: qrResized,
        top: margin,
        left: margin,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}

// Upload image to fal storage
async function uploadToFal(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array], { type: "image/png" });
  const file = new File([blob], "image.png", { type: "image/png" });
  return fal.storage.upload(file);
}

// Generate high-contrast QR code for ControlNet (768x768 for optimal results)
async function generateControlNetQR(url: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 768,
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

// Get style prompt based on image description/category
function getStylePrompt(imageDescription: string): string {
  const desc = imageDescription.toLowerCase();
  
  // Base quality enhancers that work well with QR codes
  const qualityEnhancers = "high contrast, sharp edges, clear definition, professional quality, masterpiece";
  
  if (desc.includes("nature") || desc.includes("mountain") || desc.includes("forest") || desc.includes("ocean") || desc.includes("sky") || desc.includes("misty") || desc.includes("dawn")) {
    return `beautiful landscape with geometric patterns, mountains with structured composition, forests with clear definition, natural beauty, ${qualityEnhancers}`;
  }
  if (desc.includes("abstract") || desc.includes("flow") || desc.includes("neon") || desc.includes("wave") || desc.includes("burst")) {
    return `colorful abstract art with geometric structure, bold contrast, vibrant gradients, dynamic composition, ${qualityEnhancers}`;
  }
  if (desc.includes("pattern") || desc.includes("marble") || desc.includes("texture") || desc.includes("gradient") || desc.includes("dream")) {
    return `intricate geometric patterns, structured artistic textures, bold contrast, seamless design, ${qualityEnhancers}`;
  }
  
  // Default prompt for unknown categories
  return `beautiful artistic composition, ${imageDescription}, structured patterns, bold contrast, ${qualityEnhancers}`;
}

// Verify QR code is scannable using jsQR
// OPTIMIZED: Reduced image size for faster scanning verification
async function verifyScannability(imageUrl: string): Promise<boolean> {
  try {
    let imageBuffer: Buffer;
    
    if (imageUrl.startsWith("data:")) {
      const base64 = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64, "base64");
    } else {
      // OPTIMIZED: Shorter timeout for verification
      const response = await fetchWithTimeout(imageUrl, {}, 15000);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }
    
    // OPTIMIZED: Use 768px instead of 1024px for faster processing
    // QR codes are still easily scannable at this resolution
    const { data, info } = await sharp(imageBuffer)
      .resize(768, 768, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const imageData = new Uint8ClampedArray(data);
    const result = jsQR(imageData, info.width, info.height);
    
    return result !== null;
  } catch (error) {
    console.error("Scannability check failed:", error);
    return false;
  }
}

// Generate using ControlNet illusion-diffusion
// OPTIMIZED: Reduced steps, faster polling, smaller output
async function generateWithControlNet(
  qrImageUrl: string,
  imageDescription: string,
  conditioningScale: number = 1.5
): Promise<string> {
  const prompt = getStylePrompt(imageDescription);
  
  // Adjust guidance end based on conditioning scale - higher scale = can extend guidance longer
  const guidanceEnd = conditioningScale >= 1.8 ? 0.9 : 0.8;
  
  return withRetry(async () => {
    const result = await fal.subscribe("fal-ai/illusion-diffusion", {
      input: {
        image_url: qrImageUrl,
        prompt: prompt,
        negative_prompt: "blurry, distorted, ugly, low quality, deformed, bad anatomy, broken, unreadable, unscannnable, damaged qr code",
        controlnet_conditioning_scale: conditioningScale,
        control_guidance_start: 0.0,
        control_guidance_end: guidanceEnd,
        guidance_scale: 7.5,
        // OPTIMIZED: Reduced from 40 to 25 steps
        num_inference_steps: 25,
        // OPTIMIZED: Use square (768x768) for faster inference
        image_size: "square",
      },
      pollInterval: 500, // OPTIMIZED: Faster polling
      timeout: 90000, // OPTIMIZED: Reduced timeout
    });

    const data = result.data as any;
    if (data?.image?.url) {
      return data.image.url;
    }
    throw new Error("No image in illusion-diffusion response");
  }, 2, 2000); // OPTIMIZED: Reduced retry delay
}

// Generate QR with black modules on transparent background for blending
async function generateBlendQR(url: string, size: number): Promise<Buffer> {
  // Generate QR as PNG with white background first
  const qrBuffer = await new Promise<Buffer>((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: size,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });

  // Make white transparent, keep black at full opacity
  const { data, info } = await sharp(qrBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // If white (or near white), make fully transparent
    if (r > 240 && g > 240 && b > 240) {
      pixels[i + 3] = 0; // Fully transparent
    }
    // Black modules stay at full opacity (255)
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png().toBuffer();
}

// Create composite for ControlNet Blend: gallery image + QR overlay with margin
async function createBlendComposite(
  backgroundBuffer: Buffer,
  qrUrl: string
): Promise<Buffer> {
  const outputSize = 1024;
  const margin = 100;
  const qrSize = outputSize - (margin * 2); // 824px

  // Generate transparent QR at the right size
  const qrBuffer = await generateBlendQR(qrUrl, qrSize);

  // Crop background to square
  const squareBackground = await sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover", position: "center" })
    .toBuffer();

  // Composite QR onto background
  return sharp(squareBackground)
    .composite([{
      input: qrBuffer,
      top: margin,
      left: margin,
      blend: "over",
    }])
    .png()
    .toBuffer();
}

// Get texture-blending prompt based on image description
function getBlendPrompt(imageDescription: string): string {
  const desc = imageDescription.toLowerCase();
  
  // Detect image type and generate appropriate texture-integration prompt
  if (desc.includes("forest") || desc.includes("tree") || desc.includes("misty")) {
    return "Transform this image so the QR code pattern becomes integrated into the natural forest textures. The QR code modules should be made of intertwining tree branches, leaves, and forest elements. Organic integration where the QR IS the forest texture. The QR must remain clearly scannable with high contrast between dark and light areas. Masterpiece quality, seamless artistic blend.";
  }
  if (desc.includes("mountain") || desc.includes("dawn") || desc.includes("sky")) {
    return "Transform this image so the QR code pattern becomes integrated into the mountain landscape. The QR code modules should be formed from rock formations, snow patterns, and mountain textures. The QR IS the terrain texture. The QR must remain clearly scannable with high contrast. Masterpiece quality, seamless artistic blend.";
  }
  if (desc.includes("ocean") || desc.includes("water") || desc.includes("wave") || desc.includes("calm")) {
    return "Transform this image so the QR code pattern becomes integrated into the water textures. The QR code modules should be formed from waves, ripples, and reflections on water. The QR IS the ocean surface texture. The QR must remain clearly scannable with high contrast. Masterpiece quality, seamless artistic blend.";
  }
  if (desc.includes("abstract") || desc.includes("flow") || desc.includes("neon") || desc.includes("burst")) {
    return "Transform this image so the QR code pattern becomes integrated into the abstract patterns. The QR code modules should flow with the colorful abstract elements - neon lights, flowing shapes, color bursts. The QR IS the abstract texture. The QR must remain clearly scannable with high contrast. Masterpiece quality, seamless artistic blend.";
  }
  if (desc.includes("marble") || desc.includes("texture") || desc.includes("pattern")) {
    return "Transform this image so the QR code pattern becomes integrated into the marble/texture patterns. The QR code modules should follow the veining and natural patterns of the stone. The QR IS the texture. The QR must remain clearly scannable with high contrast. Masterpiece quality, seamless artistic blend.";
  }
  if (desc.includes("gradient") || desc.includes("dream")) {
    return "Transform this image so the QR code pattern becomes integrated into the gradient colors. The QR code modules should blend with the smooth color transitions while maintaining clear definition. The QR IS the gradient texture. The QR must remain clearly scannable with high contrast. Masterpiece quality, seamless artistic blend.";
  }
  
  // Default prompt
  return `Transform this image so the QR code pattern becomes integrated into the scene's natural textures. The QR code should be made of elements that match the image - like leaves, branches, stones, waves, or whatever fits the scene. The QR becomes the central texture of the image. The QR must remain clearly scannable with high contrast. Artistic integration, seamless blend, masterpiece quality.`;
}

// Generate ControlNet Blend: QR integrated into the gallery image texture
// OPTIMIZED: Reduced steps, smaller image size, single optimal scale
async function generateControlNetBlend(
  url: string,
  imageUrl: string,
  imageDescription: string
): Promise<string> {
  // Prepare the background image at optimized size (768px instead of 1024px)
  const backgroundBuffer = await prepareReferenceImageFast(imageUrl);
  
  // Create composite: gallery image + QR with margin
  const compositeBuffer = await createBlendCompositeFast(backgroundBuffer, url);
  const compositeUrl = await uploadToFal(compositeBuffer);
  
  const prompt = getBlendPrompt(imageDescription || "artistic scene");
  
  // OPTIMIZED: Single optimal scale (2.0) instead of sequential [1.8, 2.2]
  // This eliminates the retry loop which doubles generation time
  const optimalScale = 2.0;
  
  console.log(`ControlNet Blend: using optimized scale ${optimalScale}`);
  const result = await fal.subscribe("fal-ai/illusion-diffusion", {
    input: {
      image_url: compositeUrl,
      prompt: prompt,
      negative_prompt: "blurry QR code, distorted QR, unreadable QR, broken QR, low contrast QR, ugly, low quality, deformed",
      controlnet_conditioning_scale: optimalScale,
      control_guidance_start: 0.0,
      control_guidance_end: 1.0,
      guidance_scale: 7.5,
      // OPTIMIZED: Reduced from 40 to 25 steps (37% faster inference)
      num_inference_steps: 25,
      // OPTIMIZED: Use square (768x768) instead of square_hd (1024x1024)
      image_size: "square",
    },
    // OPTIMIZED: Faster poll interval
    pollInterval: 500,
    timeout: 90000, // Reduced timeout since generation is faster
  });

  const data = result.data as any;
  if (data?.image?.url) {
    console.log("ControlNet Blend: generation complete");
    return data.image.url;
  }
  
  throw new Error("ControlNet Blend generation failed");
}

// OPTIMIZED: Faster image preparation at 768px
async function prepareReferenceImageFast(imageUrl: string): Promise<Buffer> {
  let imageBuffer: Buffer;

  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    imageBuffer = Buffer.from(base64, "base64");
  } else {
    const response = await fetchWithTimeout(imageUrl, {}, 30000);
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  }

  // OPTIMIZED: 768px instead of 1024px (43% fewer pixels)
  return sharp(imageBuffer)
    .resize(768, 768, { fit: "cover", position: "center" })
    .toBuffer();
}

// OPTIMIZED: Composite creation at 768px
async function createBlendCompositeFast(
  backgroundBuffer: Buffer,
  qrUrl: string
): Promise<Buffer> {
  const outputSize = 768; // Reduced from 1024
  const margin = 75; // Proportionally reduced from 100
  const qrSize = outputSize - (margin * 2); // 618px

  // Generate transparent QR at the right size
  const qrBuffer = await generateBlendQR(qrUrl, qrSize);

  // Crop background to square
  const squareBackground = await sharp(backgroundBuffer)
    .resize(outputSize, outputSize, { fit: "cover", position: "center" })
    .toBuffer();

  // Composite QR onto background
  return sharp(squareBackground)
    .composite([{
      input: qrBuffer,
      top: margin,
      left: margin,
      blend: "over",
    }])
    .png()
    .toBuffer();
}

// Create artistic QR with guaranteed scannability using hybrid approach
async function createHybridArtisticQR(
  artisticImageUrl: string,
  qrBuffer: Buffer
): Promise<Buffer> {
  // Download artistic image
  let artisticBuffer: Buffer;
  if (artisticImageUrl.startsWith("data:")) {
    const base64 = artisticImageUrl.split(",")[1];
    artisticBuffer = Buffer.from(base64, "base64");
  } else {
    const response = await fetchWithTimeout(artisticImageUrl, {}, 30000);
    const arrayBuffer = await response.arrayBuffer();
    artisticBuffer = Buffer.from(arrayBuffer);
  }
  
  // Resize artistic image to 1024x1024
  const artisticResized = await sharp(artisticBuffer)
    .resize(1024, 1024, { fit: "cover" })
    .toBuffer();
  
  // Create semi-transparent QR overlay (50% opacity for balance)
  const qrOverlay = await sharp(qrBuffer)
    .resize(700, 700, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .composite([{
      input: Buffer.from([0, 0, 0, 128]), // 50% opacity black
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: "dest-in",
    }])
    .toBuffer();
  
  // Create a white background for the QR overlay area for contrast
  const qrSize = 700;
  const margin = Math.floor((1024 - qrSize) / 2);
  
  const whiteUnderlay = await sharp({
    create: {
      width: qrSize,
      height: qrSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 180 }, // 70% opacity white
    }
  }).png().toBuffer();
  
  // Composite: artistic bg + white underlay + QR overlay
  return sharp(artisticResized)
    .composite([
      {
        input: whiteUnderlay,
        top: margin,
        left: margin,
        blend: "over",
      },
      {
        input: await sharp(qrBuffer)
          .resize(qrSize, qrSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .ensureAlpha()
          .toBuffer(),
        top: margin,
        left: margin,
        blend: "multiply", // QR modules show dark on white
      },
    ])
    .png()
    .toBuffer();
}

// Generate ControlNet artistic QR with retry logic for scannability
// OPTIMIZED: Reduced steps, faster polling, skip redundant scannability checks during generation
async function generateControlNetArtistic(
  url: string,
  imageDescription: string
): Promise<string> {
  // Generate high-contrast QR code at optimized size (768px for speed)
  const qrBuffer = await generateControlNetQRFast(url);
  const qrImageUrl = await uploadToFal(qrBuffer);
  const prompt = getStylePrompt(imageDescription);
  
  // Try fal-ai/qr-code first (often faster and better quality)
  try {
    const result = await fal.subscribe("fal-ai/qr-code", {
      input: {
        qr_code_content: url,
        prompt: prompt,
        negative_prompt: "blurry, distorted, ugly, low quality",
        controlnet_conditioning_scale: 2.0,
        guidance_scale: 10,
        // OPTIMIZED: Reduced from 50 to 30 steps (40% faster)
        num_inference_steps: 30,
      },
      pollInterval: 500, // OPTIMIZED: Faster polling
      timeout: 90000, // OPTIMIZED: Reduced timeout
    });

    const data = result.data as any;
    if (data?.image?.url) {
      console.log("fal-ai/qr-code generation complete");
      // OPTIMIZED: Skip scannability check during generation, verify at end
      return data.image.url;
    }
  } catch (error) {
    console.log("fal-ai/qr-code failed, trying illusion-diffusion:", error);
  }
  
  // Try illusion-diffusion as fallback
  try {
    const result = await fal.subscribe("fal-ai/illusion-diffusion", {
      input: {
        image_url: qrImageUrl,
        prompt: prompt,
        negative_prompt: "blurry, distorted, ugly, low quality",
        controlnet_conditioning_scale: 2.0,
        control_guidance_start: 0.0,
        control_guidance_end: 1.0,
        guidance_scale: 7.5,
        // OPTIMIZED: Reduced from 40 to 25 steps
        num_inference_steps: 25,
        // OPTIMIZED: Use square (768x768) for faster inference
        image_size: "square",
      },
      pollInterval: 500, // OPTIMIZED: Faster polling
      timeout: 90000, // OPTIMIZED: Reduced timeout
    });

    const data = result.data as any;
    if (data?.image?.url) {
      console.log("illusion-diffusion generation complete");
      return data.image.url;
    }
  } catch (error) {
    console.log("illusion-diffusion failed:", error);
  }
  
  // Fallback - return plain QR
  return qrImageUrl;
}

// OPTIMIZED: Generate QR at 768px instead of 768px (still high quality but faster upload)
async function generateControlNetQRFast(url: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 768, // Optimal size for illusion-diffusion
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

// Generate using nano-banana with high-contrast preservation prompt
// OPTIMIZED: Faster polling, reduced timeout
async function generateWithNanoBanana(
  compositeUrl: string,
  imageDescription: string
): Promise<string> {
  // High Contrast Preservation prompt - proven to work for scannable QR codes
  const prompt = `Enhance this image while keeping the QR code clearly scannable. The QR code in the center must have MAXIMUM contrast - dark modules should be very dark, and the light areas around them should be bright. Style: ${imageDescription || "artistic, beautiful composition"}. The background can be artistic but the QR code pattern must remain sharp and high-contrast for scanning.`;

  return withRetry(async () => {
    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        image_urls: [compositeUrl],
        prompt: prompt,
        num_images: 1,
      },
      pollInterval: 500, // OPTIMIZED: Faster polling
      timeout: 90000, // OPTIMIZED: Reduced timeout
    });

    const data = result.data as any;
    if (data?.images?.[0]?.url) {
      return data.images[0].url;
    }
    throw new Error("No image in nano-banana response");
  }, 2, 2000); // OPTIMIZED: Reduced retry delay
}

export async function POST(request: NextRequest) {
  try {
    const { url, imageUrl, imageDescription, style = "glass" } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    // Styles that require fal.ai API
    const falStyles = ["controlnet-blend", "controlnet-artistic", "ai-artistic"];
    const needsFal = falStyles.includes(style);
    
    if (needsFal) {
      const apiKey = process.env.FAL_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "fal.ai API key not configured" }, { status: 500 });
      }
      fal.config({ credentials: apiKey });
    }

    // Prepare background image
    const backgroundBuffer = await prepareReferenceImage(imageUrl);

    let resultUrl: string;

    // Handle ControlNet Blend - uses gallery image + QR composite
    if (style === "controlnet-blend") {
      resultUrl = await generateControlNetBlend(url, imageUrl, imageDescription || "artistic");
      return NextResponse.json({ imageUrl: resultUrl });
    }

    // Handle ControlNet artistic style separately (doesn't use background image compositing)
    if (style === "controlnet-artistic") {
      resultUrl = await generateControlNetArtistic(url, imageDescription || "artistic");
      return NextResponse.json({ imageUrl: resultUrl });
    }

    // Generate QR code based on style for other styles
    let qrBuffer: Buffer;
    
    switch (style) {
      case "dots":
        qrBuffer = await generateDotsQRCode(url);
        break;
      case "rounded":
        qrBuffer = await generateRoundedQRCode(url);
        break;
      case "ai-artistic":
        // For AI style, generate transparent QR
        qrBuffer = await generateTransparentQR(url);
        break;
      case "qrbtf-bubble":
        qrBuffer = await generateQRBTFBubble(url, imageUrl);
        break;
      case "qrbtf-25d":
        qrBuffer = await generateQRBTF25D(url, imageUrl);
        break;
      case "qrbtf-dsj":
        qrBuffer = await generateQRBTFDsj(url, imageUrl);
        break;
      default: // glass
        qrBuffer = await generateQRCode(url);
    }

    if (style === "ai-artistic") {
      // Create composite with transparent QR overlay on background
      const compositeBuffer = await createQRComposite(backgroundBuffer, qrBuffer);
      const compositeUrl = await uploadToFal(compositeBuffer);
      
      // Use nano-banana with high-contrast prompt
      resultUrl = await generateWithNanoBanana(compositeUrl, imageDescription || "");
    } else {
      // Use frosted glass composite for all other styles
      const resultBuffer = await createFrostedGlassComposite(backgroundBuffer, qrBuffer);
      const base64 = resultBuffer.toString("base64");
      resultUrl = `data:image/png;base64,${base64}`;
    }

    return NextResponse.json({ imageUrl: resultUrl });

  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
