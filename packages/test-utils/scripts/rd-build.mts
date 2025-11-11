import { build } from 'rolldown'
// Import TS config via tsx runtime
import cfg from '../rolldown.config.ts'

async function main() {
  await build(cfg as any)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

