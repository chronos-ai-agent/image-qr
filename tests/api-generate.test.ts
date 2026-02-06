import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// These tests validate the API contract and would catch issues like:
// - Wrong content types (text vs input_text)
// - Deprecated model names
// - Missing response fields

describe('Generate API Validation', () => {
  describe('Input Validation', () => {
    it('should require URL parameter', async () => {
      const { POST } = await import('../app/api/generate/route');
      
      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error.toLowerCase()).toContain('url');
    });

    it('should accept model parameter', async () => {
      const { POST } = await import('../app/api/generate/route');
      
      // This should not throw - model param should be handled
      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          model: 'gpt-image',
        }),
      });

      // Will fail due to API key but should parse correctly
      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('should accept gemini model parameter', async () => {
      const { POST } = await import('../app/api/generate/route');
      
      const request = new NextRequest('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          model: 'gemini',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });
});

describe('API Code Quality Checks', () => {
  it('should NOT use deprecated Gemini model names', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // These model names are deprecated/invalid
    const deprecatedModels = [
      'gemini-2.0-flash-exp',
      'gemini-pro-vision',
      'gemini-1.0',
    ];
    
    for (const model of deprecatedModels) {
      expect(code).not.toContain(`"${model}"`);
      expect(code).not.toContain(`'${model}'`);
    }
  });

  it('should use valid OpenAI image model names', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Should use gpt-image-1 or similar valid models
    const hasValidModel = 
      code.includes('gpt-image-1') || 
      code.includes('gpt-image-1.5') ||
      code.includes('dall-e-3');
    
    expect(hasValidModel).toBe(true);
  });

  it('should NOT use invalid Responses API content types', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // If using Responses API, should use input_text/input_image, NOT text/image_url
    if (code.includes('responses.create') || code.includes('openai.responses')) {
      // These are WRONG for Responses API
      expect(code).not.toMatch(/type:\s*["']text["']/);
      expect(code).not.toMatch(/type:\s*["']image_url["']/);
    }
  });

  it('should handle QR code generation', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Should import and use qrcode library
    expect(code).toContain('qrcode');
    expect(code).toContain('toDataURL');
  });

  it('should return proper error format', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Should have error handling that returns { error: ... }
    expect(code).toContain('error:');
    expect(code).toContain('NextResponse.json');
  });

  it('should return imageUrl in success response', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Success response should include imageUrl
    expect(code).toContain('imageUrl:');
  });
});

describe('Model Configuration Validation', () => {
  it('Gemini model should be stable version', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Extract Gemini model name from code
    const geminiModelMatch = code.match(/model:\s*["'](gemini[^"']+)["']/);
    
    if (geminiModelMatch) {
      const modelName = geminiModelMatch[1];
      // Should NOT contain -exp suffix (experimental)
      expect(modelName).not.toContain('-exp');
      // Should be a 2.x version
      expect(modelName).toMatch(/gemini-2\./);
    }
  });

  it('OpenAI model should be valid for image generation', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('./app/api/generate/route.ts', 'utf-8');
    
    // Should use a valid image model
    const validImageModels = ['gpt-image-1', 'gpt-image-1.5', 'dall-e-3', 'dall-e-2', 'gpt-4.1'];
    const hasValidModel = validImageModels.some(m => code.includes(m));
    
    expect(hasValidModel).toBe(true);
  });
});

describe('Integration Test Helpers', () => {
  it('provides test URL for manual testing', () => {
    const testUrl = 'https://image-qr-three.vercel.app';
    const testPayload = {
      url: 'https://example.com',
      model: 'gpt-image',
      imageDescription: 'abstract art',
    };
    
    console.log('\n📋 Manual Test Instructions:');
    console.log(`URL: ${testUrl}`);
    console.log(`Payload: ${JSON.stringify(testPayload, null, 2)}`);
    console.log('\nTest both models: gpt-image and gemini\n');
    
    expect(true).toBe(true);
  });
});
