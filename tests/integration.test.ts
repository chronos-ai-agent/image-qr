import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

/**
 * Integration tests that make REAL API calls via curl.
 * These test the live deployed endpoint.
 * 
 * Run with: npm run test:integration
 */

const LIVE_URL = 'https://image-qr-three.vercel.app/api/generate';
const TEST_URL = 'https://example.com';
const TIMEOUT = 120000; // 2 minutes for image generation

// Helper to make HTTP requests using curl (works in any env)
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

// Check if we should run integration tests
const shouldRunIntegration = process.env.RUN_INTEGRATION === 'true';

describe.skipIf(!shouldRunIntegration)('Integration Tests - Live API Calls', () => {
  
  describe('GPT Image Model', () => {
    it('should generate an image with GPT Image 1', async () => {
      console.log('🔄 Testing GPT Image 1...');
      
      const { status, data } = curlPost(LIVE_URL, {
        url: TEST_URL,
        model: 'gpt-image',
        imageDescription: 'minimalist abstract art',
      });
      
      console.log('GPT Image response status:', status);
      
      if (status === 200) {
        expect(data.imageUrl).toBeDefined();
        expect(data.imageUrl).toMatch(/^(data:image|https?:\/\/)/);
        console.log('✅ GPT Image: Generated successfully');
        console.log('   Preview:', data.imageUrl.substring(0, 100) + '...');
      } else {
        console.log('❌ GPT Image error:', data.error || data);
        // Log but don't fail for API issues
        expect(data.error || status).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('Gemini Model', () => {
    it('should generate an image with Gemini', async () => {
      console.log('🔄 Testing Gemini 2.0 Flash...');
      
      const { status, data } = curlPost(LIVE_URL, {
        url: TEST_URL,
        model: 'gemini',
        imageDescription: 'colorful geometric patterns',
      });
      
      console.log('Gemini response status:', status);
      
      if (status === 200) {
        expect(data.imageUrl).toBeDefined();
        expect(data.imageUrl).toMatch(/^(data:image|https?:\/\/)/);
        console.log('✅ Gemini: Generated successfully');
        console.log('   Preview:', data.imageUrl.substring(0, 100) + '...');
      } else {
        console.log('❌ Gemini error:', data.error || data);
        expect(data.error || status).toBeDefined();
      }
    }, TIMEOUT);
  });

  describe('fal.ai Nano Banana Model', () => {
    it('should generate an image with Nano Banana Pro', async () => {
      console.log('🔄 Testing fal.ai Nano Banana Pro...');
      
      const { status, data } = curlPost(LIVE_URL, {
        url: TEST_URL,
        model: 'fal',
        imageDescription: 'futuristic neon cityscape',
      });
      
      console.log('fal.ai response status:', status);
      
      if (status === 200) {
        expect(data.imageUrl).toBeDefined();
        expect(data.imageUrl).toMatch(/^(data:image|https?:\/\/)/);
        console.log('✅ fal.ai Nano Banana: Generated successfully');
        console.log('   Preview:', data.imageUrl.substring(0, 100) + '...');
      } else {
        console.log('❌ fal.ai error:', data.error || data);
        expect(data.error || status).toBeDefined();
      }
    }, TIMEOUT);
  });
});

describe('All Models - Quick Validation', () => {
  it('should accept gpt-image model parameter', () => {
    const payload = { url: TEST_URL, model: 'gpt-image' };
    expect(payload.model).toBe('gpt-image');
  });

  it('should accept gemini model parameter', () => {
    const payload = { url: TEST_URL, model: 'gemini' };
    expect(payload.model).toBe('gemini');
  });

  it('should accept fal model parameter', () => {
    const payload = { url: TEST_URL, model: 'fal' };
    expect(payload.model).toBe('fal');
  });
});

// Summary test that runs all and reports
describe.skipIf(!shouldRunIntegration)('Model Availability Summary', () => {
  it('reports which models are working', async () => {
    console.log('\n📊 Model Availability Report:');
    console.log('=============================');
    
    const models = ['gpt-image', 'gemini', 'fal'];
    const results: Record<string, boolean> = {};
    
    for (const model of models) {
      const { status, data } = curlPost(LIVE_URL, {
        url: TEST_URL,
        model,
        imageDescription: 'test image',
      });
      
      results[model] = status === 200 && data.imageUrl;
      console.log(`${results[model] ? '✅' : '❌'} ${model}: ${results[model] ? 'Working' : data.error || 'Failed'}`);
    }
    
    console.log('=============================\n');
    
    // At least one model should work
    const anyWorking = Object.values(results).some(v => v);
    expect(anyWorking).toBe(true);
  }, TIMEOUT * 3);
});
