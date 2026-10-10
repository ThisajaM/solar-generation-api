const { verifySeedUsers } = require('../scripts/lib/verify-seed-users');
function fixture() {
  const provinces = [{ _id: 'wp', code: 'WP' }];
  const districts = 'CMB GAM KAL KAN MAT NUE GAL MTR HAM JAF KIL MAN MUL VAV BAT AMP TRI KUR PUT ANU POL BAD MON RAT KEG'.split(' ').map(code => ({ _id: code, code }));
  const installations = Array.from({ length: 200 }, (_, n) => ({ _id: `site${n}`, code: `INST-${String(n + 1).padStart(5, '0')}` }));
  const users = [
    { email: 'admin@example.test', role: 'national-analyst', scope: 'national', scopes: ['analyst-read'] },
    { email: 'analyst.western@example.test', role: 'province-analyst', scope: 'province', province: 'wp', scopes: ['analyst-read'] },
    ...districts.map(d => ({ email: `analyst.${d.code.toLowerCase()}@example.test`, role: 'district-analyst', scope: 'district', district: d._id, scopes: ['analyst-read'] })),
    ...installations.map(i => ({ email: `device${i.code.slice(-5)}@devices.example.test`, role: 'device', scope: 'installation', installation: i._id, scopes: ['installation-write'] }))
  ];
  return { users, provinces, districts, installations };
}
function admin() { return { name: 'Test administrator', email: 'new-admin@example.test', role: 'installation-admin', scope: 'national', scopes: ['analyst-read', 'installation-manage'], active: true, passwordHash: '$2b$12$' + 'a'.repeat(53) }; }
test('exact original 227 includes national analyst named admin, not an installation administrator', () => {
  const data = fixture(); const before = JSON.stringify(data);
  expect(verifySeedUsers(data)).toMatchObject({ seededAccounts: 227, additionalAccounts: 0, totalAccounts: 227 });
  expect(JSON.stringify(data)).toBe(before);
});
test.each(['national', 'province', 'district'])('accepts additional valid %s administrator without relaxing seed count', scope => {
  const data = fixture(); const extra = admin(); extra.scope = scope;
  if (scope !== 'national') extra[scope] = scope === 'province' ? 'wp' : 'CMB';
  data.users.push(extra);
  expect(verifySeedUsers(data)).toMatchObject({ expectedSeededAccounts: 227, seededAccounts: 227, additionalAdministratorAccounts: 1, totalAccounts: 228 });
});
test('accepts multiple valid additional administrators', () => {
  const data = fixture(); data.users.push(admin(), { ...admin(), email: 'second@example.test' });
  expect(verifySeedUsers(data).additionalAccounts).toBe(2);
});
test('an additional administrator cannot replace a missing seed account', () => {
  const data = fixture(); data.users.pop(); data.users.push(admin()); expect(() => verifySeedUsers(data)).toThrow('Expected 227');
});
test('a seed identity changed to administrator is rejected', () => {
  const data = fixture(); data.users[0] = { ...admin(), email: 'admin@example.test' }; expect(() => verifySeedUsers(data)).toThrow('Seed account');
});
test.each([
  { role: 'national-analyst' }, { scopes: ['analyst-read'] }, { scopes: ['analyst-read', 'installation-manage', 'installation-write'] },
  { scope: 'province', province: 'missing' }, { scope: 'district', district: 'CMB', province: 'wp' },
  { installation: 'site0' }, { passwordHash: 'plaintext' }, { name: '' }, { active: 'true' }
])('rejects malformed or unexpected extra account %j', change => {
  const data = fixture(); data.users.push({ ...admin(), ...change }); expect(() => verifySeedUsers(data)).toThrow();
});
test('rejects duplicate seed identity', () => {
  const data = fixture(); data.users.push({ ...data.users[0] }); expect(() => verifySeedUsers(data)).toThrow('duplicate');
});
test('rejects changed seed device assignment and extra grants', () => {
  const data = fixture(); data.users[27].installation = 'site1'; expect(() => verifySeedUsers(data)).toThrow('Seed account');
  const other = fixture(); other.users[0].scopes.push('installation-manage'); expect(() => verifySeedUsers(other)).toThrow('Seed account');
});
