#!/usr/bin/env node
/**
 * Generate TypeScript client types from OpenAPI spec
 * Run: npx ts-node scripts/generate-client-types.ts
 * Or: npm run generate:types (after adding to package.json)
 */

import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, '..', '..', 'packages', 'shared', 'src', 'api-types');
const SPEC_URL = 'http://localhost:3000/v1/docs-json';

async function generateTypes() {
  console.log('🔄 Generating TypeScript client types from OpenAPI spec...\n');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Method 1: Try using openapi-typescript-codegen (if available)
    // This is a more modern and actively maintained tool
    console.log('📦 Using openapi-typescript-codegen...');
    
    execSync(
      `npx openapi-typescript-codegen \
        -i ${SPEC_URL} \
        -o ${OUTPUT_DIR} \
        -c fetch \
        --name CampBjjApi \
        --useOptions \
        --useUnionTypes \
        --exportCore \
        --exportServices \
        --exportModels \
        --httpClient fetch \
        --requestTimeout 30000 \
        --enumPrefixRemove`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' }
    );

    console.log('\n✅ Client types generated successfully!');
    console.log(`📁 Output: ${OUTPUT_DIR}`);
    console.log('\n📋 Next steps:');
    console.log('  1. Import in frontend: import { CampBjjApi } from "@camp-bjj/shared/api-types"');
    console.log('  2. Configure base URL and auth interceptor');
    console.log('  3. Use generated hooks/services for type-safe API calls');

  } catch (error: unknown) {
    console.error('\n❌ Generation failed:', error instanceof Error ? error.message : String(error));
    
    // Fallback: try orval if available
    console.log('\n🔄 Trying fallback with orval...');
    try {
      execSync(
        `npx orval --input ${SPEC_URL} --output ${OUTPUT_DIR}/orval-generated.ts --client fetch`,
        { cwd: PROJECT_ROOT, stdio: 'inherit' }
      );
      console.log('\n✅ Fallback generation with orval succeeded!');
    } catch (fallbackError: unknown) {
      console.error('\n❌ Fallback also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      console.log('\n💡 Manual alternative:');
      console.log('  1. Open http://localhost:3000/docs-json in browser');
      console.log('  2. Save as swagger.json');
      console.log('  3. Run: npx openapi-typescript-codegen -i swagger.json -o ./generated');
      process.exit(1);
    }
  }
}

generateTypes();