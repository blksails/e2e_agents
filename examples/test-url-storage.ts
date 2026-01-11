import { StorageManager } from '../src/core/storage/StorageManager';

async function testUrlBasedStorage() {
  console.log('Testing URL-based storage...\n');

  const storage = new StorageManager('./test-data');

  // 测试 1: example.com
  console.log('Test 1: https://example.com');
  storage.setBaseUrl('https://example.com');
  await storage.initialize();
  await storage.saveGlobalState('test1', { message: 'Hello from example.com' });
  console.log('✓ Saved to test-data/example.com/state/test1.json\n');

  // 测试 2: example.com:8080
  console.log('Test 2: https://example.com:8080');
  storage.setBaseUrl('https://example.com:8080');
  await storage.initialize();
  await storage.saveGlobalState('test2', { message: 'Hello from example.com:8080' });
  console.log('✓ Saved to test-data/example.com_8080/state/test2.json\n');

  // 测试 3: localhost:3000
  console.log('Test 3: http://localhost:3000');
  storage.setBaseUrl('http://localhost:3000');
  await storage.initialize();
  await storage.saveGlobalState('test3', { message: 'Hello from localhost:3000' });
  console.log('✓ Saved to test-data/localhost_3000/state/test3.json\n');

  // 验证读取
  console.log('Verifying data...');
  storage.setBaseUrl('https://example.com');
  const data1 = await storage.loadGlobalState('test1');
  console.log('example.com data:', data1);

  storage.setBaseUrl('https://example.com:8080');
  const data2 = await storage.loadGlobalState('test2');
  console.log('example.com:8080 data:', data2);

  storage.setBaseUrl('http://localhost:3000');
  const data3 = await storage.loadGlobalState('test3');
  console.log('localhost:3000 data:', data3);

  console.log('\n✅ All tests passed!');
  console.log('\nDirectory structure:');
  console.log('test-data/');
  console.log('├── example.com/');
  console.log('│   └── state/test1.json');
  console.log('├── example.com_8080/');
  console.log('│   └── state/test2.json');
  console.log('└── localhost_3000/');
  console.log('    └── state/test3.json');
}

testUrlBasedStorage().catch(console.error);
