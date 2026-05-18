import 'dotenv/config'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { Pool, type PoolClient } from 'pg'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

type PropertyRow = {
  id: string
  title: string
  source: string
  source_url: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const absoluteUrl = (url: string, sourceUrl: string) => new URL(url, sourceUrl).toString()

const collectImageUrl = (rawUrl: string, sourceUrl: string, seen: Set<string>, images: string[]) => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return

  const candidate = trimmed.split(/\s+/)[0]
  const url = absoluteUrl(candidate, sourceUrl)
  if (!url.includes('app-api.paagees.com') || !url.toLowerCase().includes('.webp')) return
  if (seen.has(url)) return

  seen.add(url)
  images.push(url)
}

const fetchImages = async (sourceUrl: string) => {
  const { data } = await axios.get<string>(sourceUrl, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000
  })
  const $ = cheerio.load(data)
  const seen = new Set<string>()
  const images: string[] = []

  $('img, source').each((_, element) => {
    const attrs = ['src', 'data-src', 'data-lazy-src', 'data-original']

    for (const attr of attrs) {
      const value = $(element).attr(attr)
      if (value) collectImageUrl(value, sourceUrl, seen, images)
    }

    const srcset = $(element).attr('srcset') || $(element).attr('data-srcset')
    if (srcset) {
      for (const candidate of srcset.split(',')) {
        collectImageUrl(candidate, sourceUrl, seen, images)
      }
    }
  })

  for (const match of data.matchAll(/https?:\/\/[^"'\s)]+app-api\.paagees\.com[^"'\s)]+?\.webp/gi)) {
    collectImageUrl(match[0], sourceUrl, seen, images)
  }

  return images.slice(0, 10)
}

const isReachableImage = async (url: string) => {
  try {
    const response = await axios.head(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      validateStatus: () => true
    })

    const contentType = String(response.headers['content-type'] ?? '')
    return response.status >= 200 && response.status < 300 && contentType.startsWith('image/')
  } catch {
    return false
  }
}

const hasReachableStoredImage = async (client: PoolClient, propertyId: string) => {
  const existingImages = await client.query<{ url: string }>(
    `SELECT url
     FROM tenant_rs_crm.property_images
     WHERE property_id = $1
     ORDER BY position ASC NULLS LAST, created_at ASC
     LIMIT 3`,
    [propertyId]
  )

  for (const image of existingImages.rows) {
    if (await isReachableImage(image.url)) return true
  }

  return false
}

const archiveStaleCollaboration = async (
  client: PoolClient,
  property: PropertyRow,
  reason: string
) => {
  if (property.source !== 'colaboracion') return false

  await client.query(
    `UPDATE tenant_rs_crm.properties
     SET active = false,
         status = 'archived',
         updated_at = now()
     WHERE id = $1`,
    [property.id]
  )

  console.log(`WARN ${property.title}: ${reason}; colaboracion archivada`)
  return true
}

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })
  const client = await pool.connect()

  try {
    const positionColumn = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'tenant_rs_crm'
       AND table_name = 'property_images'
       AND column_name = 'position'
       LIMIT 1`
    )

    if (!positionColumn.rowCount) {
      await client.query('ALTER TABLE tenant_rs_crm.property_images ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0')
    }

    const { rows: properties } = await client.query<PropertyRow>(
      `SELECT id, title, source, source_url
       FROM tenant_rs_crm.properties
       WHERE source IN ('internal', 'colaboracion')
       AND source_url IS NOT NULL
       AND btrim(source_url) <> ''
       AND deleted_at IS NULL
       ORDER BY created_at DESC`
    )

    for (const property of properties) {
      try {
        const images = await fetchImages(property.source_url)

        if (!images.length) {
          const hasValidStoredImage = await hasReachableStoredImage(client, property.id)
          if (!hasValidStoredImage) {
            await archiveStaleCollaboration(client, property, 'sin imagenes validas')
          }

          console.log(`WARN ${property.title}: no se encontraron imagenes`)
          await sleep(1000)
          continue
        }

        for (const [position, url] of images.entries()) {
          const existingAtPosition = await client.query<{ id: string; url: string }>(
            `SELECT id, url
             FROM tenant_rs_crm.property_images
             WHERE property_id = $1 AND position = $2
             LIMIT 1`,
            [property.id, position]
          )

          if (existingAtPosition.rows[0]) {
            if (existingAtPosition.rows[0].url !== url) {
              await client.query(
                'UPDATE tenant_rs_crm.property_images SET url = $1 WHERE id = $2',
                [url, existingAtPosition.rows[0].id]
              )
            }
            continue
          }

          const existingUrl = await client.query<{ id: string }>(
            `SELECT id
             FROM tenant_rs_crm.property_images
             WHERE property_id = $1 AND url = $2
             LIMIT 1`,
            [property.id, url]
          )

          if (existingUrl.rows[0]) {
            await client.query(
              'UPDATE tenant_rs_crm.property_images SET position = $1 WHERE id = $2',
              [position, existingUrl.rows[0].id]
            )
            continue
          }

          await client.query(
            'INSERT INTO tenant_rs_crm.property_images (property_id, url, path, position) VALUES ($1, $2, NULL, $3)',
            [property.id, url, position]
          )
        }

        console.log(`OK ${property.title}: ${images.length} imagenes actualizadas`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido'
        const hasValidStoredImage = await hasReachableStoredImage(client, property.id)
        if (!hasValidStoredImage) {
          await archiveStaleCollaboration(client, property, `anuncio no disponible (${message})`)
        }
        console.log(`WARN ${property.title}: ${message}`)
      }

      await sleep(1000)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
