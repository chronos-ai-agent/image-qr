// Test script for nano-banana QR experiment mode
// Run with: npx tsx tests/test-experiment.ts

import jsQR from "jsqr";
import sharp from "sharp";

const API_URL = process.env.API_URL || "https://image-qr-three.vercel.app/api/generate";

// Test image - Abstract Flow from gallery
const TEST_IMAGE_URL = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=800&fit=crop";
const TEST_URL = "https://example.com";

async function downloadAndScanQR(imageUrl: string): Promise<{ scannable: boolean; data: string | null; error?: string }> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { scannable: false, data: null, error: `Failed to fetch: ${response.status}` };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert to raw RGBA
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Scan with jsQR
    const qrData = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    
    if (qrData) {
      return { scannable: true, data: qrData.data };
    }
    
    return { scannable: false, data: null };
  } catch (error) {
    return { scannable: false, data: null, error: String(error) };
  }
}

async function runExperiment() {
  console.log("🧪 Running Nano-Banana QR Experiment\n");
  console.log(`Target URL: ${TEST_URL}`);
  console.log(`Background Image: ${TEST_IMAGE_URL}`);
  console.log(`API Endpoint: ${API_URL}\n`);

  console.log("📡 Calling experiment API...\n");

  const startTime = Date.now();
  
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: TEST_URL,
      imageDescription: "abstract colorful flow patterns",
      imageUrl: TEST_IMAGE_URL,
      experimentMode: true,
      qrOpacity: 0.8,
    }),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️ API response received in ${elapsed}s\n`);

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ API Error:", error);
    process.exit(1);
  }

  const result = await response.json();

  console.log("📊 EXPERIMENT RESULTS\n");
  console.log("=".repeat(60) + "\n");

  // Input composite
  console.log("📌 INPUT COMPOSITE (QR overlaid on image):");
  console.log(`   ${result.inputComposite}\n`);

  // Scan input composite first
  console.log("🔍 Scanning input composite...");
  const inputScan = await downloadAndScanQR(result.inputComposite);
  console.log(`   Scannable: ${inputScan.scannable ? "✅ YES" : "❌ NO"}`);
  if (inputScan.data) console.log(`   Data: ${inputScan.data}`);
  console.log();

  // Results summary
  const summary: Array<{
    strategy: string;
    total: number;
    scannable: number;
    images: Array<{ url: string; scannable: boolean; data: string | null }>;
  }> = [];

  // Process each strategy
  for (const strategy of result.strategies) {
    console.log("-".repeat(60));
    console.log(`\n📋 STRATEGY: ${strategy.name}`);
    console.log(`   ${strategy.description}\n`);
    console.log(`   Prompt: "${strategy.prompt.substring(0, 100)}..."\n`);

    const strategyResults: Array<{ url: string; scannable: boolean; data: string | null }> = [];

    if (strategy.images.length === 0) {
      console.log("   ⚠️ No images generated for this strategy\n");
      summary.push({ strategy: strategy.name, total: 0, scannable: 0, images: [] });
      continue;
    }

    console.log(`   Generated ${strategy.images.length} images:\n`);

    for (let i = 0; i < strategy.images.length; i++) {
      const imgUrl = strategy.images[i];
      console.log(`   [${i + 1}] ${imgUrl}`);
      
      const scanResult = await downloadAndScanQR(imgUrl);
      strategyResults.push({ url: imgUrl, scannable: scanResult.scannable, data: scanResult.data });
      
      if (scanResult.scannable) {
        console.log(`       ✅ SCANNABLE - Data: ${scanResult.data}`);
      } else {
        console.log(`       ❌ Not scannable${scanResult.error ? ` (${scanResult.error})` : ""}`);
      }
    }
    
    const scannableCount = strategyResults.filter(r => r.scannable).length;
    summary.push({
      strategy: strategy.name,
      total: strategy.images.length,
      scannable: scannableCount,
      images: strategyResults,
    });
    
    console.log();
  }

  // Final summary
  console.log("=".repeat(60));
  console.log("\n📊 FINAL SUMMARY\n");

  let totalImages = 0;
  let totalScannable = 0;

  for (const s of summary) {
    totalImages += s.total;
    totalScannable += s.scannable;
    const rate = s.total > 0 ? ((s.scannable / s.total) * 100).toFixed(0) : "N/A";
    console.log(`   ${s.strategy}: ${s.scannable}/${s.total} scannable (${rate}%)`);
  }

  console.log();
  const overallRate = totalImages > 0 ? ((totalScannable / totalImages) * 100).toFixed(0) : "N/A";
  console.log(`   TOTAL: ${totalScannable}/${totalImages} scannable (${overallRate}%)\n`);

  // Output all image URLs for easy access
  console.log("=".repeat(60));
  console.log("\n🔗 ALL IMAGE URLs FOR MANUAL TESTING\n");
  console.log(`Input Composite: ${result.inputComposite}\n`);
  
  for (const s of summary) {
    console.log(`${s.strategy}:`);
    for (let i = 0; i < s.images.length; i++) {
      const marker = s.images[i].scannable ? "✅" : "❌";
      console.log(`  ${marker} ${s.images[i].url}`);
    }
    console.log();
  }

  console.log("\n✨ Experiment complete!");
}

runExperiment().catch(console.error);
