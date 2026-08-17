import { Router, type IRouter } from "express";
import {
  CreateVideoClipBody,
  DownloadVideoQueryParams,
  InspectVideoBody,
  InspectVideoResponse,
} from "@workspace/api-zod";
import {
  createClip,
  downloadFullVideo,
  inspectSource,
  validateSourceUrl,
} from "../lib/video-tools";

const router: IRouter = Router();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The video could not be processed.";
}

function sendError(
  res: Parameters<Parameters<IRouter["post"]>[1]>[1],
  status: 400 | 502,
  error: unknown,
  code: string,
): void {
  res.status(status).json({ error: errorMessage(error), code });
}

router.post("/video/inspect", async (req, res): Promise<void> => {
  const parsed = InspectVideoBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Enter a valid YouTube or Facebook video link.", "invalid_input");
    return;
  }

  try {
    const data = InspectVideoResponse.parse(await inspectSource(parsed.data.url));
    res.json(data);
  } catch (error) {
    req.log.warn({ error: errorMessage(error) }, "Video inspection failed");
    sendError(res, 502, error, "inspection_failed");
  }
});

router.post("/video/clip", async (req, res): Promise<void> => {
  const parsed = CreateVideoClipBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Choose a valid start and end time.", "invalid_input");
    return;
  }

  if (parsed.data.endSeconds <= parsed.data.startSeconds) {
    sendError(res, 400, "End time must be after start time.", "invalid_range");
    return;
  }

  try {
    validateSourceUrl(parsed.data.url);
    const result = await createClip(
      parsed.data.url,
      parsed.data.startSeconds,
      parsed.data.endSeconds,
    );
    res.download(result.path, `${parsed.data.title || "clipforge-clip"}.mp4`, (error) => {
      void result.cleanup();
      if (error && !res.headersSent) {
        sendError(res, 502, error, "clip_download_failed");
      }
    });
  } catch (error) {
    req.log.warn({ error: errorMessage(error) }, "Clip creation failed");
    sendError(res, 502, error, "clip_failed");
  }
});

router.get("/video/download", async (req, res): Promise<void> => {
  const parsed = DownloadVideoQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "Enter a valid YouTube or Facebook video link.", "invalid_input");
    return;
  }

  try {
    const result = await downloadFullVideo(parsed.data.url);
    res.download(result.path, result.filename, (error) => {
      void result.cleanup();
      if (error && !res.headersSent) {
        sendError(res, 502, error, "full_download_failed");
      }
    });
  } catch (error) {
    req.log.warn({ error: errorMessage(error) }, "Full video download failed");
    sendError(res, 502, error, "full_download_failed");
  }
});

export default router;