const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Province = require('../src/models/Province');
const District = require('../src/models/District');
const { isObjectId } = require('../src/utils/ids');
async function provisionAdmin(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['name', 'email', 'password', 'scope', 'provinceId', 'districtId'].includes(k))) throw new Error('Invalid administrator input');
  if (typeof input.password !== 'string' || input.password.length < 16 || Buffer.byteLength(input.password) > 72 || typeof input.name !== 'string' || !input.name.trim() || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Invalid administrator name, email or password');
  if (!['national', 'province', 'district'].includes(input.scope)) throw new Error('Invalid administrator scope');
  const field = input.scope === 'national' ? null : input.scope + 'Id';
  if ((input.provinceId && field !== 'provinceId') || (input.districtId && field !== 'districtId')) throw new Error('Conflicting jurisdiction');
  if (field && (!isObjectId(input[field]) || !await (input.scope === 'province' ? Province : District).exists({ _id: input[field] }))) throw new Error('Invalid jurisdiction reference');
  const passwordHash = await bcrypt.hash(input.password, 12);
  return User.create({ name: input.name.trim(), email: input.email, passwordHash, role: 'installation-admin', scope: input.scope,
    province: input.provinceId, district: input.districtId, scopes: ['analyst-read', 'installation-manage'] });
}
if (require.main === module) {
  const { connectDatabase, disconnectDatabase } = require('../src/config/database');
  (async () => {
    if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== 'create') throw new Error('Explicit create confirmation required');
    let text = ''; for await (const chunk of process.stdin) { text += chunk; if (text.length > 16384) throw new Error('Input too large'); }
    const input = JSON.parse(text); await connectDatabase(); await provisionAdmin(input);
    console.log('New administrator created; existing users were not changed.');
  })().catch(() => { console.error('Administrator creation failed; check confirmation, input, references and uniqueness. Details suppressed.'); process.exitCode = 1; }).finally(disconnectDatabase);
}
module.exports = { provisionAdmin };
