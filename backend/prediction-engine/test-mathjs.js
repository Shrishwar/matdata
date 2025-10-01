// Simple test to check if mathjs config works
import { create, all } from 'mathjs';

console.log('Testing mathjs config...');

try {
  const mathjs = create(all);
  console.log('mathjs instance created successfully');

  // Test basic operations
  const result = mathjs.mean([1, 2, 3, 4, 5]);
  console.log('Mean calculation:', result);

  // Test random function
  const randomVal = mathjs.random();
  console.log('Random value:', randomVal);

  console.log('mathjs test passed!');
} catch (error) {
  console.error('mathjs test failed:', error.message);
}
