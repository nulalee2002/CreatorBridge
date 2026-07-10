import { checkMessage } from '../src/utils/messageFilter.js';

const cases = [
  { text: 'Instagram-style reel', allowPlatformNames: true, blocked: false },
  { text: 'Deliver for YouTube and TikTok', allowPlatformNames: true, blocked: false },
  { text: 'DM me on Instagram', allowPlatformNames: true, blocked: true },
  { text: 'my TikTok', allowPlatformNames: true, blocked: true },
  { text: 'email me at qa@example.com', allowPlatformNames: true, blocked: true },
  { text: 'Call 480-555-0188', allowPlatformNames: true, blocked: true },
  { text: 'Instagram-style reel', allowPlatformNames: false, blocked: true },
];

for (const testCase of cases) {
  const result = checkMessage(testCase.text, {
    allowPlatformNames: testCase.allowPlatformNames,
  });
  if (result.blocked !== testCase.blocked) {
    throw new Error(
      `${JSON.stringify(testCase.text)} expected blocked=${testCase.blocked}, got ${result.blocked}`
    );
  }
}

console.log(`OK: ${cases.length} brief and contact-filter cases passed.`);
