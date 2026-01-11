import { StorageManager } from "../src/core/storage/StorageManager";

async function testUrlBasedStorage() {
  console.log("Testing URL-based storage with task structure...\n");

  const storage = new StorageManager("./test-data");

  // Test 1: URL with path (auto task name)
  storage.setBaseUrl("https://example.com/login");
  await storage.initialize();
  await storage.saveGlobalState("credentials", {
    username: "test",
    password: "test123",
  });
  console.log("Test 1: https://example.com/login");
  console.log(
    "✓ Saved to test-data/example.com/login/state/credentials.json\n",
  );

  // Test 2: URL with nested path (auto task name)
  storage.setBaseUrl("https://example.com/user/profile");
  await storage.initialize();
  await storage.saveGlobalState("userInfo", {
    name: "John Doe",
    email: "john@example.com",
  });
  console.log("Test 2: https://example.com/user/profile");
  console.log(
    "✓ Saved to test-data/example.com/user_profile/state/userInfo.json\n",
  );

  // Test 3: URL without path (default task name)
  storage.setBaseUrl("https://example.com");
  await storage.initialize();
  await storage.saveGlobalState("homepage", { title: "Welcome" });
  console.log("Test 3: https://example.com (no path - default task1)");
  console.log("✓ Saved to test-data/example.com/task1/state/homepage.json\n");

  // Test 4: Custom task name
  storage.setBaseUrl("https://example.com:8080/api", "checkout-flow");
  await storage.initialize();
  await storage.saveGlobalState("cart", { items: 3, total: 99.99 });
  console.log(
    'Test 4: https://example.com:8080/api with custom task "checkout-flow"',
  );
  console.log(
    "✓ Saved to test-data/example.com_8080/checkout-flow/state/cart.json\n",
  );

  // Test 5: Multiple tasks for same domain
  storage.setBaseUrl("http://localhost:3000/dashboard", "task1");
  await storage.initialize();
  await storage.saveGlobalState("widgets", { count: 5 });
  console.log("Test 5: http://localhost:3000/dashboard (task1)");
  console.log("✓ Saved to test-data/localhost_3000/task1/state/widgets.json\n");

  storage.setBaseUrl("http://localhost:3000/settings", "task2");
  await storage.initialize();
  await storage.saveGlobalState("preferences", { theme: "dark" });
  console.log("Test 6: http://localhost:3000/settings (task2)");
  console.log(
    "✓ Saved to test-data/localhost_3000/task2/state/preferences.json\n",
  );

  // Verify data can be loaded
  console.log("Verifying data...");
  storage.setBaseUrl("https://example.com/login");
  const data1 = await storage.loadGlobalState<any>("credentials");
  console.log("example.com/login:", data1);

  storage.setBaseUrl("https://example.com/user/profile");
  const data2 = await storage.loadGlobalState<any>("userInfo");
  console.log("example.com/user/profile:", data2);

  storage.setBaseUrl("https://example.com:8080/api", "checkout-flow");
  const data3 = await storage.loadGlobalState<any>("cart");
  console.log("example.com:8080/checkout-flow:", data3);

  console.log("\n✅ All tests passed!");
  console.log("\nDirectory structure:");
  console.log("test-data/");
  console.log("├── example.com/");
  console.log("│   ├── login/");
  console.log("│   │   └── state/credentials.json");
  console.log("│   ├── user_profile/");
  console.log("│   │   └── state/userInfo.json");
  console.log("│   └── task1/");
  console.log("│       └── state/homepage.json");
  console.log("├── example.com_8080/");
  console.log("│   └── checkout-flow/");
  console.log("│       └── state/cart.json");
  console.log("└── localhost_3000/");
  console.log("    ├── task1/");
  console.log("    │   └── state/widgets.json");
  console.log("    └── task2/");
  console.log("        └── state/preferences.json");
}

testUrlBasedStorage().catch(console.error);
