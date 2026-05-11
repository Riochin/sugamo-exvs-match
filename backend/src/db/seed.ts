import bcryptjs from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db } from './client.js'
import { players } from './schema.js'

interface SeedPlayer {
  name: string
  pin: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
}

const SEED_PLAYERS: SeedPlayer[] = [
  {
    name: "アクメ漱石",
    pin: "0000",
    team: "FIRST",
    title: "",
    mainUnit: "",
  },
  {
    name: "らりほー",
    pin: "0000",
    team: "FIRST",
    title: null,
    mainUnit: "",
  },
  {
    name: "トッテン",
    pin: "0000",
    team: "FIRST",
    title: null,
    mainUnit: "",
  },
  {
    name: "K",
    pin: "0000",
    team: "FIRST",
    title: null,
    mainUnit: "",
  },
  {
    name: "オーガスト",
    pin: "0000",
    team: "FIRST",
    title: null,
    mainUnit: "",
  },
  {
    name: "隠し子",
    pin: "0000",
    team: "FIRST",
    title: null,
    mainUnit: "",
  },
  {
    name: "やめとけ",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "",
  },
  {
    name: "しゆう",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "",
  },
  {
    name: "マルハット",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "ストライクルージュ",
  },
  {
    name: "かたはば",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "",
  },
  {
    name: "ぬま",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "",
  },
  {
    name: "らおぷー",
    pin: "0000",
    team: "SECOND",
    title: null,
    mainUnit: "",
  },
];

async function seed() {
  console.log('Seeding players...')

  for (const p of SEED_PLAYERS) {
    const pinHash = await bcryptjs.hash(p.pin, 10)
    await db.insert(players).values({
      id: randomUUID(),
      name: p.name,
      pinHash,
      team: p.team,
      title: p.title,
      mainUnit: p.mainUnit,
      createdAt: new Date(),
    }).onConflictDoNothing()
    console.log(`  - ${p.name} (${p.team})`)
  }

  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
