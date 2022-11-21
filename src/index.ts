import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { delivery } from './delivery'

const app = new Hono()

app.use('*', (c, next) => {
    const origin = c.env['ENVIRONMENT'] === 'dev' ? 'http://localhost:3000' : 'https://aivy.run'
    return cors({
        origin,
        credentials: true,
    })(c, next)
})
app.use('*', logger())
app.notFound((c) => {
    return c.text('404 Not Found', 404)
})
app.onError((err, c) => {
    console.error(`${err}`)
    return c.text('Internal server error', 500)
})

app.route('/imagedelivery/delivery', delivery)

export default app
