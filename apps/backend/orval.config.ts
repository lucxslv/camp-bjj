import { defineConfig } from 'orval';

export default defineConfig({
  campBjj: {
    input: {
      target: './temp-openapi-spec.json',
    },
    output: {
      target: '../../packages/shared/src/api-types/generated.ts',
      client: 'fetch',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
      prettier: true,
      clean: true,
    },
  },
});