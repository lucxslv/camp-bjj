#!/usr/bin/env node
/**
 * Generate TypeScript client types from OpenAPI spec
 * Run: npx ts-node scripts/generate-client-types.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OUTPUT_DIR = join(__dirname, '../../packages/shared/src/api-types');
const SPEC_URL = 'http://localhost:3000/v1/docs-json';

async function generateTypes() {
  console.log('🔄 Generating TypeScript types from OpenAPI spec...');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Use orval to generate types
    // First, fetch the spec
    console.log('📥 Fetching OpenAPI spec from', SPEC_URL);
    
    const response = await fetch(SPEC_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
    }
    
    const spec = await response.json();
    
    // Write spec to temp file for orval
    const tempSpecPath = join(__dirname, '../temp-openapi-spec.json');
    writeFileSync(tempSpecPath, JSON.stringify(spec, null, 2));
    
    // Generate types using orval
    console.log('⚙️  Running orval...');
    execSync(`npx orval --config orval.config.ts`, {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    
    console.log('✅ Types generated successfully!');
    console.log(`📁 Output: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

generateTypes();