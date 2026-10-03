require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { colomboHourDecimal } = require('../src/utils/sriLankaTime');
const Province = require('../src/models/Province');
const District = require('../src/models/District');
const Substation = require('../src/models/Substation');
const SolarInstallation = require('../src/models/SolarInstallation');
const GenerationReading = require('../src/models/GenerationReading');
const User = require('../src/models/User');

const INTERVAL_MS = 15 * 60 * 1000;
const DAYS = 7;
const READINGS_PER_DAY = 96;
const READINGS_PER_INSTALLATION = DAYS * READINGS_PER_DAY;
const INSTALLATION_COUNT = 200;

const provinceData = [
  ['Western', 'WP'], ['Central', 'CP'], ['Southern', 'SP'], ['Northern', 'NP'], ['Eastern', 'EP'],
  ['North Western', 'NWP'], ['North Central', 'NCP'], ['Uva', 'UP'], ['Sabaragamuwa', 'SGP']
];

const districtData = [
  ['Colombo', 'CMB', 'WP'], ['Gampaha', 'GAM', 'WP'], ['Kalutara', 'KAL', 'WP'],
  ['Kandy', 'KAN', 'CP'], ['Matale', 'MAT', 'CP'], ['Nuwara Eliya', 'NUE', 'CP'],
  ['Galle', 'GAL', 'SP'], ['Matara', 'MTR', 'SP'], ['Hambantota', 'HAM', 'SP'],
  ['Jaffna', 'JAF', 'NP'], ['Kilinochchi', 'KIL', 'NP'], ['Mannar', 'MAN', 'NP'],
  ['Mullaitivu', 'MUL', 'NP'], ['Vavuniya', 'VAV', 'NP'],
  ['Batticaloa', 'BAT', 'EP'], ['Ampara', 'AMP', 'EP'], ['Trincomalee', 'TRI', 'EP'],
  ['Kurunegala', 'KUR', 'NWP'], ['Puttalam', 'PUT', 'NWP'],
  ['Anuradhapura', 'ANU', 'NCP'], ['Polonnaruwa', 'POL', 'NCP'],
  ['Badulla', 'BAD', 'UP'], ['Monaragala', 'MON', 'UP'],
  ['Ratnapura', 'RAT', 'SGP'], ['Kegalle', 'KEG', 'SGP']
];

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function alignedEnd(now) {
  const date = new Date(now);
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 15) * 15);
  return date;
}

function solarPowerKw(capacityKw, timestamp, random) {
  const hour = colomboHourDecimal(timestamp);
  if (hour < 6 || hour > 18.25) return 0;
  const daylight = Math.sin(Math.PI * (hour - 6) / 12.25);
  const weather = 0.82 + random() * 0.18;
  return Math.max(0, Math.round(capacityKw * daylight * weather * 100) / 100);
}

async function main() {
  const random = mulberry32(6007);
  if (process.env.SEED_CONFIRM !== 'yes') throw new Error('Set SEED_CONFIRM=yes to explicitly allow replacing the six demo collections');
  const end = alignedEnd(process.env.SEED_END || new Date());
  if (!Number.isFinite(end.getTime())) throw new Error('SEED_END must be a valid ISO date-time');
  await connectDatabase();
  await Promise.all([Province, District, Substation, SolarInstallation, GenerationReading, User].map(model => model.init()));
  console.log('Clearing existing collections...');
  await Promise.all([
    GenerationReading.deleteMany({}),
    SolarInstallation.deleteMany({}),
    Substation.deleteMany({}),
    District.deleteMany({}),
    Province.deleteMany({}),
    User.deleteMany({})
  ]);

  const provinces = await Province.insertMany(provinceData.map(([name, code]) => ({ name, code })));
  const provinceMap = Object.fromEntries(provinces.map(p => [p.code, p._id]));
  const districts = await District.insertMany(districtData.map(([name, code, p]) => ({
    name,
    code,
    province: provinceMap[p]
  })));

  const substationRows = districts.map((district, index) => ({
    name: `${district.name} Grid Substation 01`,
    code: `GS${String(index + 1).padStart(3, '0')}`,
    district: district._id,
    location: {
      type: 'Point',
      coordinates: [79.8 + random() * 2, 6.0 + random() * 3.5]
    }
  }));
  substationRows.push(
    { name: 'Colombo Grid Substation 02', code: 'GS026', district: districts[0]._id, location: { type: 'Point', coordinates: [79.86, 6.93] } },
    { name: 'Gampaha Grid Substation 02', code: 'GS027', district: districts[1]._id, location: { type: 'Point', coordinates: [80.01, 7.09] } }
  );
  const substations = await Substation.insertMany(substationRows);

  const substationsByDistrict = new Map();
  for (const substation of substations) {
    const key = substation.district.toString();
    if (!substationsByDistrict.has(key)) substationsByDistrict.set(key, []);
    substationsByDistrict.get(key).push(substation);
  }

  const installations = [];
  for (let i = 1; i <= INSTALLATION_COUNT; i++) {
    const district = districts[(i - 1) % districts.length];
    const options = substationsByDistrict.get(district._id.toString());
    const substation = options[(i - 1) % options.length];
    const capacityKw = Math.round((2.5 + random() * 12.5) * 10) / 10;
    const row = {
      code: `INST-${String(i).padStart(5, '0')}`,
      name: `Solar Installation ${String(i).padStart(3, '0')}`,
      capacityKw,
      latitude: Math.round((5.95 + random() * 3.8) * 10000) / 10000,
      longitude: Math.round((79.7 + random() * 2.1) * 10000) / 10000,
      substation: substation._id,
      status: 'active'
    };
    if (i % 2 === 0) {
      row.meterId = `SLSEA-MTR-${String(i).padStart(5, '0')}`;
    } else {
      row.inverterId = `SLSEA-INV-${String(i).padStart(5, '0')}`;
    }
    installations.push(row);
  }
  const insertedInstallations = await SolarInstallation.insertMany(installations);

  const start = new Date(end.getTime() - (READINGS_PER_INSTALLATION - 1) * INTERVAL_MS);
  let readingCount = 0;
  console.log(`Inserting ${INSTALLATION_COUNT * READINGS_PER_INSTALLATION} readings...`);

  for (const installation of insertedInstallations) {
    const docs = [];
    let cumulative = Math.round((800 + random() * 4000) * 100) / 100;
    for (let n = 0; n < READINGS_PER_INSTALLATION; n++) {
      const timestamp = new Date(start.getTime() + n * INTERVAL_MS);
      const powerKw = solarPowerKw(installation.capacityKw, timestamp, random);
      cumulative = Math.round((cumulative + powerKw * 0.25) * 100) / 100;
      docs.push({
        installation: installation._id,
        timestamp,
        powerKw,
        cumulativeEnergyKwh: cumulative,
        voltage: Math.round((225 + random() * 15) * 10) / 10,
        frequencyHz: Math.round((49.85 + random() * 0.3) * 100) / 100
      });
    }
    await GenerationReading.insertMany(docs);
    readingCount += docs.length;
  }

  const hashes = new Map();
  const passwordHash = (password) => {
    if (!hashes.has(password)) hashes.set(password, bcrypt.hashSync(password, 10));
    return hashes.get(password);
  };
  const users = [
    {
      name: 'SLSEA National Analyst',
      email: 'admin@example.test',
      passwordHash: passwordHash('Admin@12345'),
      role: 'national-analyst',
      scope: 'national',
      scopes: ['analyst-read']
    },
    {
      name: 'Western Province Analyst',
      email: 'analyst.western@example.test',
      passwordHash: passwordHash('Analyst@12345'),
      role: 'province-analyst',
      scope: 'province',
      province: provinceMap.WP,
      scopes: ['analyst-read']
    }
  ];
  for (const district of districts) {
    users.push({
      name: `${district.name} District Analyst`,
      email: `analyst.${district.code.toLowerCase()}@example.test`,
      passwordHash: passwordHash('District@12345'),
      role: 'district-analyst',
      scope: 'district',
      district: district._id,
      scopes: ['analyst-read']
    });
  }
  for (const installation of insertedInstallations) {
    users.push({
      name: `Device ${installation.code}`,
      email: `device${installation.code.slice(-5)}@devices.example.test`,
      passwordHash: passwordHash('Device@12345'),
      role: 'device',
      scope: 'installation',
      installation: installation._id,
      scopes: ['installation-write']
    });
  }
  await User.insertMany(users);

  console.log('\nSeed completed successfully.\n');
  console.log(`Provinces: ${provinces.length}`);
  console.log(`Districts: ${districts.length}`);
  console.log(`Substations: ${substations.length}`);
  console.log(`Installations: ${insertedInstallations.length}`);
  console.log(`Readings: ${readingCount}`);
  console.log(`Users: ${users.length}`);
  console.log(`Interval: 15 minutes`);
  console.log(`Window: ${start.toISOString()} → ${end.toISOString()}`);
  console.log('\nDemo login: admin@example.test / Admin@12345');
  console.log('Province analyst: analyst.western@example.test / Analyst@12345');
  console.log('District analyst example: analyst.cmb@example.test / District@12345');
  console.log('Device example: device00001@devices.example.test / Device@12345');
  console.log(`Example installation id: ${insertedInstallations[0]._id}`);
}

if (require.main === module) main()
  .catch((err) => {
    console.error('Seed failed:', err.name, err.code || '', err.name === 'Error' ? err.message : 'Check database access and data constraints');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

module.exports = { main, solarPowerKw, mulberry32 };
