import { spawn } from 'child_process'
import dotenv from 'dotenv'
import fs from 'fs/promises'
if (process.env['ENVIRONMENT'] === 'dev') dotenv.config({ path: './.env.local' })
dotenv.config()

const TMP_FILE_NAME = '.wrangler.toml'
let str = await fs.readFile('./wrangler.toml', 'utf-8')

/** @param {string} [flag] @returns {RegExp} */
const re = (flag) => new RegExp('\\$\\{(.+)\\}', flag)
const matches = str.match(re('g'))
if (matches)
    for (const match of matches) {
        const key = match.match(re())?.[1]
        if (!key) continue
        const env = process.env[key]
        if (!env) continue
        str = str.replace(match, env)
    }

await fs.writeFile(TMP_FILE_NAME, str)

const ps = spawn('wrangler', ['--config', TMP_FILE_NAME, ...process.argv.slice(2)], {
    stdio: 'inherit',
})

process.on('SIGINT', () => {
    ps.kill()
    fs.rm(TMP_FILE_NAME)
    process.exit()
})
