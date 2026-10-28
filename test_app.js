const assert = require('node:assert');
const { claimOrAuthenticateUser, saveMessage, getRecentMessages } = require('./db');

console.log('--- RUNNING AUTOMATED UNIT TESTS ---');

// Test 1: Claim 1-character username with symbol
const res1 = claimOrAuthenticateUser('!');
assert.strictEqual(res1.success, true, 'Should allow 1-character symbol username');
assert.strictEqual(res1.isNew, true, 'Should be flagged as new');
assert.ok(res1.token.startsWith('key_'), 'Should return a valid secret token');
console.log('✓ 1-character username claim: PASSED');

// Test 2: Try claiming same username without key -> should fail
const res2 = claimOrAuthenticateUser('!');
assert.strictEqual(res2.success, false, 'Should reject duplicate claim without key');
assert.ok(res2.error.includes('already claimed'), 'Should return clear error message');
console.log('✓ Duplicate username rejection: PASSED');

// Test 3: Re-authenticate with valid key -> should succeed
const res3 = claimOrAuthenticateUser('!', res1.token);
assert.strictEqual(res3.success, true, 'Should authenticate with valid key');
assert.strictEqual(res3.isNew, false, 'Should be recognized as existing user');
console.log('✓ Valid key authentication: PASSED');

// Test 4: Re-authenticate with invalid key -> should fail
const res4 = claimOrAuthenticateUser('!', 'wrong_key_123');
assert.strictEqual(res4.success, false, 'Should reject invalid key');
console.log('✓ Invalid key rejection: PASSED');

// Test 5: Strict case sensitivity: 'User' and 'user' are different
const res5 = claimOrAuthenticateUser('TestUser');
const res6 = claimOrAuthenticateUser('testuser');
assert.strictEqual(res5.success, true);
assert.strictEqual(res6.success, true);
assert.notStrictEqual(res5.token, res6.token, 'Different case should be distinct entities');
console.log('✓ Strict exact match distinction: PASSED');

// Test 6: Username with symbols, numbers, and up to 20 chars
const symbolsUser = 'A_b$1#2@z';
const res7 = claimOrAuthenticateUser(symbolsUser);
assert.strictEqual(res7.success, true);
console.log('✓ Username with alphanumeric and symbols: PASSED');

// Test 7: Length validation (> 20 chars should fail)
const tooLong = '123456789012345678901'; // 21 chars
const res8 = claimOrAuthenticateUser(tooLong);
assert.strictEqual(res8.success, false, 'Should reject > 20 chars');
console.log('✓ Length constraint enforcement (>20 chars): PASSED');

// Test 8: Empty username rejected
const res9 = claimOrAuthenticateUser('   ');
assert.strictEqual(res9.success, false, 'Should reject empty username');
console.log('✓ Empty username rejection: PASSED');

// Test 9: Save and retrieve messages
const msg1 = saveMessage('!', 'Hello world from symbol user!');
assert.ok(msg1.id > 0, 'Message should have auto-increment ID');
assert.strictEqual(msg1.username, '!');
assert.strictEqual(msg1.text, 'Hello world from symbol user!');

const recent = getRecentMessages(10);
assert.ok(recent.length >= 1, 'Should return recent messages');
const found = recent.find(m => m.id === msg1.id);
assert.ok(found, 'Saved message should be in recent messages');
console.log('✓ SQLite message persistence: PASSED');

console.log('\nALL 9 UNIT TESTS PASSED SUCCESSFULLY! ✓✓✓');
