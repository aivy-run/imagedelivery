import { Context, Hono } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'

export const delivery = new Hono()

const cloneHeaders = (headers: Headers, c: Context<any, any, any>, omit?: string[]) => {
    for (const [k, v] of headers.entries())
        if (!omit?.map((v) => v.toLowerCase()).includes(k.toLowerCase())) c.header(k, v)
}

const getCache = () => caches.open('aivy:imagedelivery')

const CACHE_CONTROL = [
    {
        prefix: 'post.image',
        maxAge: 60 * 60 * 24 * 30,
    },
    {
        prefix: 'user.',
        maxAge: 60 * 60 * 4,
    },
]

const CLOUDFLARE_IMAGES_URL = 'cloudflare-images-url'

delivery.use('*', (c, next) => {
    c.set(CLOUDFLARE_IMAGES_URL, `https://imagedelivery.net/${c.env['ACCOUNT_HASH']}`)
    return next()
})

delivery.delete('/caches/:id/:variant', async (c) => {
    const { id, variant } = c.req.param()
    const imagedelivery = await getCache()
    const url = new URL(`${c.get(CLOUDFLARE_IMAGES_URL)}/${id}/${variant}`)
    const res = await imagedelivery.delete(url.toString())
    if (res) return c.body(`The cache for ${url} has been deleted.`)
    else return c.body('Cache not found', 404)
})

delivery.get('/:id/:variant', async (c) => {
    const { id, variant } = c.req.param()
    const imagedelivery = await getCache()
    const url = new URL(`${c.get(CLOUDFLARE_IMAGES_URL)}/${id}/${variant}`)

    const cacheControl = CACHE_CONTROL.find((v) => id.startsWith(v.prefix)) || {
        maxAge: 60 * 60 * 24 * 2,
    }

    const cached = await imagedelivery.match(url.toString())
    if (cached) {
        cloneHeaders(cached.headers, c)
        c.header('aivy-cache-status', 'HIT')
        return c.body(cached.body, cached.status as StatusCode)
    }

    const image = await fetch(url.toString())

    if (!image.ok)
        return c.body(
            image.body,
            image.status as StatusCode,
            Object.fromEntries(image.headers.entries()),
        )

    cloneHeaders(image.headers, c, ['Cache-Control'])
    c.header('aivy-cache-status', 'MISS')
    c.header('cache-control', `max-age=${cacheControl.maxAge}`)
    const res = c.body(image.body)
    const cache = res.clone()

    c.executionCtx.waitUntil(imagedelivery.put(url.toString(), cache))

    return res
})
