import OpenAI from 'openai';

// Constructed on first use, not at import. `next build` evaluates this module
// while collecting page data, where OPENAI_API_KEY is not available.
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= create();
      const value = (instance as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  });
}

const openai = lazy<OpenAI>(() => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export const MODEL = 'gpt-4o-mini';

export default openai;
