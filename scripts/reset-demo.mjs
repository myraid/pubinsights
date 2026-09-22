#!/usr/bin/env node
/**
 * Deletes demo projects from the demo account so a recording starts clean.
 *
 *   npm run reset:demo -- --dry-run "Meal Prep Demo"
 *   npm run reset:demo -- "Meal Prep Demo" "Meal Prep Playbook"
 *
 * Destructive and irreversible. Project names must be passed explicitly — there is
 * deliberately no "delete everything" mode — and only projects owned by DEMO_EMAIL
 * are ever touched.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createPrivateKey } from 'node:crypto'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const names = args.filter((a) => a !== '--dry-run')

if (names.length === 0) {
  console.error('usage: reset-demo.mjs [--dry-run] "<project name>" ["<project name>" ...]')
  process.exit(1)
}

function parsePrivateKey(raw) {
  if (!raw) return undefined
  const pem = raw.replace(/\\n/g, '\n')
  try {
    return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' })
  } catch {
    return pem
  }
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  })
const db = getFirestore(app)

const email = process.env.DEMO_EMAIL
if (!email) {
  console.error('DEMO_EMAIL is not set — refusing to run without a scoped account.')
  process.exit(1)
}

const users = await db.collection('users').where('email', '==', email).get()
if (users.empty) {
  console.error(`No user document for ${email}`)
  process.exit(1)
}
const uid = users.docs[0].id
console.log(`demo account: ${email} (${uid})`)
console.log(dryRun ? 'DRY RUN — nothing will be deleted\n' : 'DELETING\n')

let deleted = 0
for (const name of names) {
  const snap = await db
    .collection('projects')
    .where('userId', '==', uid)
    .where('name', '==', name)
    .get()

  if (snap.empty) {
    console.log(`  "${name}" — not found`)
    continue
  }

  for (const doc of snap.docs) {
    // Count what hangs off the project so the dry run reports real scope.
    const manuscripts = await doc.ref.collection('manuscripts').get()
    const detail = `${manuscripts.size} manuscript(s)`
    if (dryRun) {
      console.log(`  "${name}" — would delete ${doc.id} (${detail})`)
    } else {
      // recursiveDelete removes manuscripts/chapters/sections beneath the project.
      await db.recursiveDelete(doc.ref)
      console.log(`  "${name}" — deleted ${doc.id} (${detail})`)
      deleted += 1
    }
  }
}

console.log(dryRun ? '\ndry run complete' : `\ndeleted ${deleted} project(s)`)
process.exit(0)
