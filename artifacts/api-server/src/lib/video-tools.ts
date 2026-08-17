import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type VideoPlatform = "youtube" | "facebook";

export type VideoMetadata = {
  url: string;
  platform: VideoPlatform;
  title: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  filename: string;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.watch",
  "www.fb.watch",
]);

function hostMatches(hostname: string, hosts: Set<string>): boolean {
  return hosts.has(hostname) || [...hosts].some((host) => hostname.endsWith(`.${host}`));
}

export function validateSourceUrl(rawUrl: string): {
  url: string;
  platform: VideoPlatform;
} {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid YouTube or Facebook video link.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only web video links are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const platform = hostMatches(hostname, YOUTUBE_HOSTS)
    ? "youtube"
    : hostMatches(hostname, FACEBOOK_HOSTS)
      ? "facebook"
      : null;

  if (!platform) {
    throw new Error("Only YouTube and Facebook links are supported.");
  }

  return { url: parsed.toString(), platform };
}

async function runYtDlp(args: string[], maxBuffer = 4 * 1024 * 1024) {
  return execFile("yt-dlp", args, {
    maxBuffer,
    timeout: 10 * 60 * 1000,
  });
}

function safeFilename(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);

  return normalized || "clipforge-video";
}

export async function inspectSource(rawUrl: string): Promise<VideoMetadata> {
  const source = validateSourceUrl(rawUrl);
  const metadataResult = await runYtDlp([
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    source.url,
  ]);
  const metadata = JSON.parse(metadataResult.stdout) as {
    title?: string;
    duration?: number;
    thumbnail?: string;
    webpage_url?: string;
  };

  let previewUrl: string | null = null;
  try {
    const previewResult = await runYtDlp([
      "--get-url",
      "--no-playlist",
      "--no-warnings",
      "-f",
      "best[ext=mp4]/best",
      source.url,
    ]);
    previewUrl = previewResult.stdout.trim().split(/\r?\n/).at(-1) || null;
  } catch {
    previewUrl = null;
  }

  const title = safeFilename(metadata.title ?? "Untitled video");
  return {
    url: metadata.webpage_url ?? source.url,
    platform: source.platform,
    title: metadata.title ?? "Untitled video",
    durationSeconds:
      typeof metadata.duration === "number" && Number.isFinite(metadata.duration)
        ? Math.max(0, metadata.duration)
        : 0,
    thumbnailUrl: metadata.thumbnail ?? null,
    previewUrl,
    filename: `${title}.mp4`,
  };
}

async function downloadSource(url: string, workDir: string): Promise<string> {
  const outputTemplate = join(workDir, "source.%(ext)s");
  await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "-f",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    outputTemplate,
    url,
  ]);

  const sourcePath = join(workDir, "source.mp4");
  await readFile(sourcePath);
  return sourcePath;
}

export async function createClip(
  rawUrl: string,
  startSeconds: number,
  endSeconds: number,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const source = validateSourceUrl(rawUrl);
  const workDir = await mkdtemp(join(tmpdir(), "clipforge-"));
  const sourcePath = await downloadSource(source.url, workDir);
  const clipPath = join(workDir, "clip.mp4");
  const duration = endSeconds - startSeconds;

  try {
    await execFile(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(startSeconds),
        "-i",
        sourcePath,
        "-t",
        String(duration),
        "-map",
        "0:v:0?",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        clipPath,
      ],
      { maxBuffer: 2 * 1024 * 1024, timeout: 10 * 60 * 1000 },
    );
    await readFile(clipPath);
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }

  return {
    path: clipPath,
    cleanup: () => rm(workDir, { recursive: true, force: true }),
  };
}

export async function downloadFullVideo(rawUrl: string): Promise<{
  path: string;
  filename: string;
  cleanup: () => Promise<void>;
}> {
  const source = validateSourceUrl(rawUrl);
  const workDir = await mkdtemp(join(tmpdir(), "clipforge-"));
  try {
    const sourcePath = await downloadSource(source.url, workDir);
    const metadata = await inspectSource(source.url);

    return {
      path: sourcePath,
      filename: basename(metadata.filename),
      cleanup: () => rm(workDir, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}