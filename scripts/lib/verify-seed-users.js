// Read-only identity/integrity verification, not proof of account creation provenance.
const DISTRICT_CODES = 'CMB GAM KAL KAN MAT NUE GAL MTR HAM JAF KIL MAN MUL VAV BAT AMP TRI KUR PUT ANU POL BAD MON RAT KEG'.split(' ');
const EXPECTED_SEEDED_USERS = 227;
const refs = ['province', 'district', 'substation', 'installation'];
const sameId = (a, b) => String(a) === String(b);
function fail(message) { throw new Error(message); }
function grantsMatch(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === expected.length && expected.every(s => actual.includes(s));
}
function verifySeedUsers({ users, provinces, districts, installations }) {
  const expected = new Map();
  function add(email, role, scope, field, id) {
    if (field && !id) fail('Seed user reference catalog is incomplete');
    expected.set(email, { role, scope, field, id });
  }
  add('admin@example.test', 'national-analyst', 'national');
  add('analyst.western@example.test', 'province-analyst', 'province', 'province', provinces.find(p => p.code === 'WP')?._id);
  for (const code of DISTRICT_CODES) add(`analyst.${code.toLowerCase()}@example.test`, 'district-analyst', 'district', 'district', districts.find(d => d.code === code)?._id);
  for (let n = 1; n <= 200; n++) {
    const suffix = String(n).padStart(5, '0');
    add(`device${suffix}@devices.example.test`, 'device', 'installation', 'installation', installations.find(i => i.code === `INST-${suffix}`)?._id);
  }
  const seen = new Set(); let seededAccounts = 0; let additionalAccounts = 0;
  for (const user of users) {
    if (typeof user.email !== 'string' || user.email !== user.email.trim().toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || seen.has(user.email)) fail('Invalid or duplicate user identity');
    seen.add(user.email);
    const seed = expected.get(user.email);
    if (seed) {
      if (user.role !== seed.role || user.scope !== seed.scope || !grantsMatch(user.scopes, [seed.role === 'device' ? 'installation-write' : 'analyst-read']) || refs.some(field => field === seed.field ? !sameId(user[field], seed.id) : user[field] != null)) fail('Seed account role, grants or jurisdiction differs from seed definition');
      seededAccounts++;
    } else {
      // A role alone is insufficient: require provisioner-compatible identity,
      // grants, bcrypt cost and valid, non-conflicting jurisdiction references.
      const field = user.scope === 'national' ? null : user.scope;
      const catalog = field === 'province' ? provinces : field === 'district' ? districts : [];
      if (user.role !== 'installation-admin' || !['national', 'province', 'district'].includes(user.scope) ||
          !grantsMatch(user.scopes, ['analyst-read', 'installation-manage']) ||
          typeof user.name !== 'string' || !user.name.trim() || typeof user.active !== 'boolean' ||
          !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(user.passwordHash || '') ||
          refs.some(key => key === field ? !catalog.some(row => sameId(row._id, user[key])) : user[key] != null)) fail('Unexpected additional account or invalid administrator configuration');
      additionalAccounts++;
    }
  }
  if (seededAccounts !== EXPECTED_SEEDED_USERS) fail(`Expected ${EXPECTED_SEEDED_USERS} seed identities; matched ${seededAccounts}`);
  return { expectedSeededAccounts: EXPECTED_SEEDED_USERS, seededAccounts, additionalAccounts, additionalAdministratorAccounts: additionalAccounts, totalAccounts: users.length,
    classification: 'Seed identity/role/reference match; additional provisioner-compatible administrators. Creation provenance is not stored or proven.' };
}
async function verifySeedUsersInDatabase(db) {
  const [users, provinces, districts, installations] = await Promise.all([
    db.collection('users').find({}, { projection: { email: 1, name: 1, role: 1, scope: 1, scopes: 1, province: 1, district: 1, substation: 1, installation: 1, active: 1, passwordHash: 1 } }).toArray(),
    db.collection('provinces').find({}, { projection: { code: 1 } }).toArray(),
    db.collection('districts').find({}, { projection: { code: 1 } }).toArray(),
    db.collection('solarinstallations').find({}, { projection: { code: 1 } }).toArray()
  ]);
  return verifySeedUsers({ users, provinces, districts, installations });
}
module.exports = { verifySeedUsers, verifySeedUsersInDatabase, EXPECTED_SEEDED_USERS };
