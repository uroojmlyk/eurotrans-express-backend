// scripts/createAdmin.js
/* One-time script to create the initial admin account.
   Usage:
     node scripts/createAdmin.js --email admin@example.com --password "StrongPass123" --setup-secret <ADMIN_SETUP_SECRET>
   Or run without args for interactive prompts.
*/
require('dotenv').config();

const path = require('path');
const readline = require('readline');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

const parseArgs = (argv) => {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        out[key] = val;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
};

const ask = (rl, question) =>
  new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const run = async () => {
  const args = parseArgs(process.argv);

  const setupSecretEnv = process.env.ADMIN_SETUP_SECRET;

  let email = typeof args.email === 'string' ? args.email : '';
  let password = typeof args.password === 'string' ? args.password : '';
  let setupSecret =
    typeof args['setup-secret'] === 'string' ? args['setup-secret'] : '';

  // Interactive fallback
  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      if (!email) email = await ask(rl, 'Admin email: ');
      if (!password) password = await ask(rl, 'Admin password: ');
      if (setupSecretEnv && !setupSecret) {
        setupSecret = await ask(rl, 'Setup secret (ADMIN_SETUP_SECRET): ');
      }
    } finally {
      rl.close();
    }
  }

  email = email.trim().toLowerCase();

  // Validations
  if (!isValidEmail(email)) {
    console.error('❌ Invalid email format');
    process.exit(1);
  }
  if (typeof password !== 'string' || password.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }
  if (setupSecretEnv && setupSecret !== setupSecretEnv) {
    console.error('❌ Setup secret does not match ADMIN_SETUP_SECRET');
    process.exit(1);
  }

  // Connect to DB
  await connectDB();

  try {
    const existing = await Admin.findOne({ email });
    if (existing) {
      console.error(`❌ Admin already exists for ${email}. Aborting.`);
      process.exit(1);
    }

    const anyAdmin = await Admin.countDocuments({});
    if (anyAdmin > 0) {
      console.error(
        `❌ An admin already exists (${anyAdmin}). This script only creates the initial admin.`
      );
      process.exit(1);
    }

    const passwordHash = await Admin.hashPassword(password);
    const created = await Admin.create({
      email,
      passwordHash,
      name: 'Administrator',
      role: 'admin',
    });

    console.log('✅ Admin created successfully.');
    console.log(`   Email: ${created.email}`);
    console.log(`   ID:    ${created._id.toString()}`);
    console.log('   (Password was not logged for security.)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});