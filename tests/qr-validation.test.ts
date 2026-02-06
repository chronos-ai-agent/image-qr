import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import sharp from 'sharp';
import jsQR from 'jsqr';

/**
 * QR Code Validation Tests
 * 
 * These tests:
 * 1. Make REAL API calls to fal.ai via our endpoint
 * 2. Download the generated images
 * 3. Scan them with jsQR to extract the encoded URL
 * 4. Verify the URL matches what we sent
 * 
 * Run with: RUN_INTEGRATION=true npm run test -- tests/qr-validation.test.ts
 */

const LIVE_URL = 'https://image-qr-three.vercel.app/api/generate';
const TIMEOUT = 180000; // 3 minutes for image generation

// Test cases with different URLs and image styles
const TEST_CASES = [
  {
    name: 'Simple URL with abstract style',
    url: 'https://example.com',
    imageDescription: 'abstract colorful swirls',
    imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop',
  },
  {
    name: 'URL with path',
    url: 'https://github.com/test',
    imageDescription: 'dark moody atmosphere',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
  },
  {
    name: 'URL with query params',
    url: 'https://shop.example.com/product?id=123&ref=qr',
    imageDescription: 'vibrant gradient patterns',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=400&fit=crop',
  },
];

// Helper to make HTTP requests using curl
function curlPost(url: string, body: object): { status: number; data: any } {
  try {
    const result = execSync(
      `curl -s -w "\\n%{http_code}" -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`,
      { timeout: TIMEOUT, encoding: 'utf-8' }
    );
    
    const lines = result.trim().split('\n');
    const statusCode = parseInt(lines.pop() || '0', 10);
    const jsonStr = lines.join('\n');
    
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      data = { raw: jsonStr };
    }
    
    return { status: statusCode, data };
  } catch (error: any) {
    return { status: 0, data: { error: error.message } };
  }
}

// Download image and convert to raw RGBA pixel data for jsQR
async function downloadAndDecodeImage(imageUrl: string): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  try {
    let imageBuffer: Buffer;
    
    if (imageUrl.startsWith('data:')) {
      // Base64 data URL
      const base64 = imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64, 'base64');
    } else {
      // HTTP URL - download with curl
      const result = execSync(`curl -s -L "${imageUrl}"`, { 
        encoding: 'buffer',
        timeout: 30000 
      });
      imageBuffer = result;
    }
    
    // Use sharp to convert to raw RGBA
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    return {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data),
    };
  } catch (error) {
    console.error('Failed to download/decode image:', error);
    return null;
  }
}

// Scan QR code from image data
function scanQRCode(imageData: { width: number; height: number; data: Uint8ClampedArray }): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  return code?.data || null;
}

// Check if we should run integration tests
const shouldRunIntegration = process.env.RUN_INTEGRATION === 'true';

describe.skipIf(!shouldRunIntegration)('QR Code Validation - Real API Tests', () => {
  
  describe('QR Code Scannability', () => {
    
    for (const testCase of TEST_CASES) {
      it(`should generate scannable QR for: ${testCase.name}`, async () => {
        console.log(`\n🔄 Testing: ${testCase.name}`);
        console.log(`   Input URL: ${testCase.url}`);
        
        // Generate the QR code
        const { status, data } = curlPost(LIVE_URL, {
          url: testCase.url,
          imageDescription: testCase.imageDescription,
          imageUrl: testCase.imageUrl,
        });
        
        console.log(`   API Status: ${status}`);
        
        if (status !== 200) {
          console.log(`   ❌ API Error: ${data.error || JSON.stringify(data)}`);
          expect(status).toBe(200);
          return;
        }
        
        expect(data.imageUrl).toBeDefined();
        console.log(`   Image URL: ${data.imageUrl.substring(0, 80)}...`);
        
        // Download and decode the image
        const imageData = await downloadAndDecodeImage(data.imageUrl);
        
        if (!imageData) {
          console.log('   ❌ Failed to download/decode image');
          expect(imageData).not.toBeNull();
          return;
        }
        
        console.log(`   Image size: ${imageData.width}x${imageData.height}`);
        
        // Scan the QR code
        const scannedUrl = scanQRCode(imageData);
        
        if (!scannedUrl) {
          console.log('   ❌ QR code NOT SCANNABLE');
          expect(scannedUrl).not.toBeNull();
          return;
        }
        
        console.log(`   Scanned URL: ${scannedUrl}`);
        
        // Verify the URL matches
        const urlsMatch = scannedUrl === testCase.url;
        
        if (urlsMatch) {
          console.log('   ✅ URL MATCHES - QR code is valid!');
        } else {
          console.log('   ❌ URL MISMATCH');
          console.log(`      Expected: ${testCase.url}`);
          console.log(`      Got: ${scannedUrl}`);
        }
        
        expect(scannedUrl).toBe(testCase.url);
        
      }, TIMEOUT);
    }
  });
  
  describe('QR Code Quality Report', () => {
    it('generates a full quality report', async () => {
      console.log('\n📊 QR Code Quality Report');
      console.log('='.repeat(50));
      
      const results: Array<{
        name: string;
        url: string;
        generated: boolean;
        scannable: boolean;
        urlMatches: boolean;
        scannedUrl: string | null;
      }> = [];
      
      for (const testCase of TEST_CASES) {
        console.log(`\nTesting: ${testCase.name}`);
        
        const result = {
          name: testCase.name,
          url: testCase.url,
          generated: false,
          scannable: false,
          urlMatches: false,
          scannedUrl: null as string | null,
        };
        
        try {
          // Generate
          const { status, data } = curlPost(LIVE_URL, {
            url: testCase.url,
            imageDescription: testCase.imageDescription,
            imageUrl: testCase.imageUrl,
          });
          
          result.generated = status === 200 && !!data.imageUrl;
          
          if (result.generated) {
            // Download and scan
            const imageData = await downloadAndDecodeImage(data.imageUrl);
            
            if (imageData) {
              result.scannedUrl = scanQRCode(imageData);
              result.scannable = !!result.scannedUrl;
              result.urlMatches = result.scannedUrl === testCase.url;
            }
          }
        } catch (error: any) {
          console.log(`  Error: ${error.message}`);
        }
        
        results.push(result);
        
        const status = result.urlMatches ? '✅' : result.scannable ? '⚠️' : result.generated ? '❌' : '💀';
        console.log(`  ${status} Generated: ${result.generated}, Scannable: ${result.scannable}, Matches: ${result.urlMatches}`);
      }
      
      console.log('\n' + '='.repeat(50));
      console.log('Summary:');
      console.log(`  Total tests: ${results.length}`);
      console.log(`  Generated: ${results.filter(r => r.generated).length}`);
      console.log(`  Scannable: ${results.filter(r => r.scannable).length}`);
      console.log(`  URL Matches: ${results.filter(r => r.urlMatches).length}`);
      console.log('='.repeat(50) + '\n');
      
      // At least some should be scannable
      const scannableCount = results.filter(r => r.scannable).length;
      expect(scannableCount).toBeGreaterThan(0);
      
    }, TIMEOUT * TEST_CASES.length);
  });
});

// Quick local test without API calls
describe('QR Scanner Library Test', () => {
  it('can scan a known good QR code', async () => {
    // Generate a simple QR code locally and verify we can scan it
    const QRCode = await import('qrcode');
    const testUrl = 'https://test.example.com';
    
    // Generate QR as PNG buffer
    const qrBuffer = await QRCode.toBuffer(testUrl, {
      errorCorrectionLevel: 'H',
      width: 512,
      margin: 2,
    });
    
    // Decode with sharp
    const { data, info } = await sharp(qrBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Scan with jsQR
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    
    expect(code).not.toBeNull();
    expect(code?.data).toBe(testUrl);
    console.log('✅ QR scanner library working correctly');
  });
});
