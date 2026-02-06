import { vi } from 'vitest';

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';

// Global fetch mock
global.fetch = vi.fn();
