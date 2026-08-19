import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import {
  CreateVideoClipBody,
  DownloadVideoQueryParams,
  InspectVideoBody,
  InspectVideoResponse,
} from '@workspace/api-zod'
import {
  createClip,
  downloadFullVideo,
  inspectSource,
  validateSourceUrl,
} from '../../../../../api-server/src/lib/video-tools'

export const runtime = 'nodejs'

type ActionContext = { params: Promise<{ action: string }> }

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The video could not be processed.'
}

function failure(error: unknown, code: string, status = 502) {
  return NextResponse.json({ error: message(error), code }, { status })
}

export async function POST(request: Request, context: ActionContext) {
  const { action } = await context.params
  if (action === 'inspect') {
    const parsed = InspectVideoBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return failure('Enter a valid YouTube or Facebook video link.', 'invalid_input', 400)
    try {
      return NextResponse.json(InspectVideoResponse.parse(await inspectSource(parsed.data.url)))
    } catch (error) {
      return failure(error, 'inspection_failed')
    }
  }

  if (action === 'clip') {
    const parsed = CreateVideoClipBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return failure('Choose a valid start and end time.', 'invalid_input', 400)
    if (parsed.data.endSeconds <= parsed.data.startSeconds) return failure('End time must be after start time.', 'invalid_range', 400)
    try {
      validateSourceUrl(parsed.data.url)
      const result = await createClip(parsed.data.url, parsed.data.startSeconds, parsed.data.endSeconds)
      try {
        const body = await readFile(result.path)
        return new NextResponse(body, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${(parsed.data.title || 'clipforge-clip').replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4"`,
          },
        })
      } finally {
        await result.cleanup()
      }
    } catch (error) {
      return failure(error, 'clip_failed')
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(request: Request, context: ActionContext) {
  const { action } = await context.params
  if (action !== 'download') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = DownloadVideoQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return failure('Enter a valid YouTube or Facebook video link.', 'invalid_input', 400)
  try {
    const result = await downloadFullVideo(parsed.data.url)
    try {
      const body = await readFile(result.path)
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${result.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        },
      })
    } finally {
      await result.cleanup()
    }
  } catch (error) {
    return failure(error, 'full_download_failed')
  }
}
