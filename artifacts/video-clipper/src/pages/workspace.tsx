import { useCallback, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MoveHorizontal,
  Play,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  X,
  Youtube,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { z } from 'zod';
import {
  getDownloadVideoQueryKey,
  useCreateVideoClip,
  useDownloadVideo,
  useInspectVideo,
  type VideoError,
  type VideoInfo,
} from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const inspectSchema = z.object({
  url: z.string().trim().min(8, 'Paste a YouTube or Facebook URL to continue.'),
});

type InspectValues = z.infer<typeof inspectSchema>;
type DownloadState = 'idle' | 'loading' | 'success' | 'error';

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  const centis = Math.floor((safeSeconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function formatShortTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  const apiError = error as { response?: VideoError; message?: string } | VideoError | undefined;
  if (apiError && 'response' in apiError && apiError.response?.error) return apiError.response.error;
  if (apiError && 'error' in apiError && apiError.error) return apiError.error;
  if (apiError && 'message' in apiError && apiError.message) return apiError.message;
  return fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3" data-testid="link-home">
      <span className="relative flex size-9 items-center justify-center rounded-[11px] bg-primary text-primary-foreground shadow-[3px_3px_0_hsl(var(--foreground))] transition-transform duration-200 group-hover:-translate-y-0.5">
        <Scissors className="size-[18px]" strokeWidth={2.2} />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent ring-2 ring-background" />
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-0.04em]">clipforge</span>
    </Link>
  );
}

function PlatformMark({ platform }: { platform: VideoInfo['platform'] }) {
  return platform === 'youtube' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffe6e0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#b63220]">
      <Youtube className="size-3" strokeWidth={2.5} /> YouTube
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4e9ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#3e4b9d]">
      <span className="flex size-3 items-center justify-center rounded-[3px] bg-[#3e4b9d] text-[8px] font-extrabold text-white">f</span>
      Facebook
    </span>
  );
}

function WorkspaceHeader() {
  return (
    <header className="border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Logo />
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="hidden items-center gap-2 sm:flex">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/.2)]" />
            permitted sources only
          </span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <button className="flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground" data-testid="button-help" type="button">
            <CircleHelp className="size-4" />
            <span className="hidden sm:inline">How it works</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function IntroBlock() {
  return (
    <div className="mb-9 max-w-2xl animate-rise">
      <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        <span className="inline-block h-px w-8 bg-primary" />
        precision video tools
      </div>
      <h1 className="font-display text-[clamp(2.8rem,6vw,5.7rem)] font-bold leading-[.92] tracking-[-0.075em] text-foreground">
        Cut exactly
        <br />
        what you mean.
      </h1>
      <p className="mt-6 max-w-lg text-[15px] leading-7 text-muted-foreground sm:text-base">
        Bring a permitted YouTube or Facebook source. Set the moment by hand, then leave with a clean clip or the complete original.
      </p>
    </div>
  );
}

function UrlForm({
  form,
  isPending,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<InspectValues>>;
  isPending: boolean;
  onSubmit: (values: InspectValues) => void;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="animate-rise animate-rise-delay-1">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <div className="relative flex flex-col gap-2 rounded-2xl border border-foreground/15 bg-card p-2 shadow-[var(--shadow-md)] transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/.12),var(--shadow-md)] sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                  <Link2 className="size-5 shrink-0 text-primary" strokeWidth={2.1} />
                  <FormControl>
                    <input
                      {...field}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/70"
                      placeholder="Paste a YouTube or Facebook URL"
                      data-testid="input-source-url"
                      autoComplete="url"
                      aria-label="Video URL"
                    />
                  </FormControl>
                  {field.value ? (
                    <button type="button" onClick={() => form.reset()} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-clear-url" aria-label="Clear URL">
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-[3px_3px_0_hsl(var(--foreground))] transition-all hover:-translate-y-0.5 hover:shadow-[4px_5px_0_hsl(var(--foreground))] active:translate-y-0 active:shadow-[1px_2px_0_hsl(var(--foreground))] disabled:pointer-events-none disabled:opacity-65 sm:min-w-[132px]"
                  data-testid="button-inspect-video"
                >
                  {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Target className="size-4" />}
                  {isPending ? 'Inspecting' : 'Inspect source'}
                </button>
              </div>
              <FormMessage className="px-2 pt-1 text-xs font-semibold text-primary" />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

function PermissionNote() {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent/50 bg-accent/15 px-4 py-3.5 text-xs leading-5 text-foreground/75 animate-rise animate-rise-delay-2" data-testid="note-permission">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#697200]" />
      <p>
        <strong className="font-bold text-foreground">Use footage you have permission to download.</strong>{' '}
        ClipForge only prepares public sources you’re authorized to use. No accounts, no hidden copies.
      </p>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="clipforge-grid relative flex min-h-[285px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[1.1rem] border border-border bg-muted/40 px-7 text-center sm:min-h-[360px]">
      <div className="absolute left-8 top-8 h-16 w-16 rounded-full border border-primary/20" />
      <div className="absolute bottom-10 right-9 h-24 w-24 rounded-full border border-foreground/10" />
      <div className="relative mb-5 flex size-16 items-center justify-center rounded-[22px] border border-primary/35 bg-card text-primary shadow-[5px_5px_0_hsl(var(--primary)/.13)]">
        <Film className="size-7" strokeWidth={1.6} />
      </div>
      <p className="font-display text-lg font-bold tracking-[-0.03em]">Your source will land here</p>
      <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Inspect a link to reveal its preview, duration, and exact cut controls.</p>
      <span className="absolute bottom-4 font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground/65">awaiting source</span>
    </div>
  );
}

function PreviewCard({ video }: { video: VideoInfo }) {
  return (
    <div className="relative overflow-hidden rounded-[1.1rem] border border-foreground/10 bg-secondary shadow-[var(--shadow-md)]">
      <div className="relative aspect-video overflow-hidden bg-[#292d49]">
        {video.previewUrl ? (
          <video className="size-full object-cover" controls poster={video.thumbnailUrl ?? undefined} src={video.previewUrl} data-testid="video-preview" />
        ) : video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="size-full object-cover opacity-80" data-testid="img-video-thumbnail" />
        ) : (
          <div className="clipforge-grid flex size-full items-center justify-center bg-secondary">
            <Film className="size-11 text-primary/65" strokeWidth={1.25} />
          </div>
        )}
        {!video.previewUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[4px_4px_0_hsl(var(--foreground)/.6)]">
              <Play className="ml-1 size-5 fill-current" />
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3"><PlatformMark platform={video.platform} /></div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-secondary/90 px-2 py-1 font-mono text-[10px] text-primary-foreground backdrop-blur-sm">
          <Clock3 className="size-3" /> {formatShortTime(video.durationSeconds)}
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 px-4 py-4 text-primary-foreground sm:px-5">
        <p className="line-clamp-2 font-display text-base font-bold leading-tight" data-testid="text-video-title">{video.title}</p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-primary-foreground/55">
          <span className="truncate">{video.filename}</span>
          <ExternalLink className="size-3 shrink-0" />
        </div>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-border bg-card">
      <div className="skeleton aspect-video" />
      <div className="space-y-2 p-5">
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-3 w-2/5 rounded" />
      </div>
    </div>
  );
}

function TimeInput({ label, value, onChange, max, testId }: { label: string; value: number; onChange: (value: number) => void; max: number; testId: string }) {
  return (
    <label className="flex flex-1 flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-lg border border-border bg-background px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Clock3 className="mr-2 size-3.5 text-primary" />
        <input
          type="number"
          min={0}
          max={max}
          step={0.1}
          value={value.toFixed(1)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full bg-transparent py-2.5 font-mono text-sm font-medium outline-none"
          data-testid={testId}
          aria-label={label}
        />
        <span className="font-mono text-[10px] text-muted-foreground">sec</span>
      </div>
    </label>
  );
}

function TrimControls({
  video,
  start,
  end,
  setStart,
  setEnd,
  title,
  setTitle,
  onClip,
  onFullDownload,
  clipPending,
  fullState,
  fullError,
}: {
  video: VideoInfo;
  start: number;
  end: number;
  setStart: (value: number) => void;
  setEnd: (value: number) => void;
  title: string;
  setTitle: (value: string) => void;
  onClip: () => void;
  onFullDownload: () => void;
  clipPending: boolean;
  fullState: DownloadState;
  fullError: string | null;
}) {
  const duration = video.durationSeconds;
  const startPercent = duration ? (start / duration) * 100 : 0;
  const endPercent = duration ? (end / duration) * 100 : 100;
  const clipLength = Math.max(0, end - start);
  const invalid = end <= start || start < 0 || end > duration;

  const updateStart = (value: number) => setStart(Math.min(Math.max(0, Number.isFinite(value) ? value : 0), Math.max(0, end - 0.1)));
  const updateEnd = (value: number) => setEnd(Math.max(Math.min(duration, Number.isFinite(value) ? value : duration), Math.min(duration, start + 0.1)));

  return (
    <section className="rounded-[1.1rem] border border-border bg-card p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="panel-trim-controls">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-primary">02 / set the cut</p>
          <h2 className="font-display text-xl font-bold tracking-[-.04em]">Find the exact moment</h2>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full bg-accent/25 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-[#697200] sm:flex">
          <MoveHorizontal className="size-3.5" /> drag or type
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-2 flex items-end justify-between">
          <span className="font-mono text-xs text-muted-foreground">source timeline</span>
          <span className="font-mono text-xs font-medium" data-testid="text-duration">{formatTime(duration)}</span>
        </div>
        <div className="range-shell relative h-12">
          <div className="timeline-track absolute left-0 right-0 top-[15px] h-4 rounded-md opacity-80" />
          <div className="absolute top-[15px] h-4 rounded-md bg-primary/20" style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }} />
          <div className="absolute top-[11px] z-10 h-6 w-0.5 bg-primary" style={{ left: `${startPercent}%` }} />
          <div className="absolute top-[11px] z-10 h-6 w-0.5 bg-primary" style={{ left: `${endPercent}%` }} />
          <input type="range" min={0} max={duration} step={0.1} value={start} onChange={(event) => updateStart(Number(event.target.value))} aria-label="Clip start time" data-testid="slider-start-time" />
          <input type="range" min={0} max={duration} step={0.1} value={end} onChange={(event) => updateEnd(Number(event.target.value))} aria-label="Clip end time" data-testid="slider-end-time" />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>00:00</span>
          <span>{formatShortTime(duration / 2)}</span>
          <span>{formatShortTime(duration)}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <TimeInput label="Start" value={start} onChange={updateStart} max={Math.max(0, end - 0.1)} testId="input-start-seconds" />
        <TimeInput label="End" value={end} onChange={updateEnd} max={duration} testId="input-end-seconds" />
        <div className="hidden flex-1 flex-col gap-2 sm:flex">
          <span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Clip length</span>
          <div className="rounded-lg border border-accent/40 bg-accent/15 px-3 py-2.5 font-mono text-sm font-medium text-[#697200]" data-testid="text-clip-length">{formatTime(clipLength)}</div>
        </div>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">File name <span className="font-normal normal-case tracking-normal">(optional)</span></span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Give this clip a name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid="input-clip-title" />
      </label>

      {invalid ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-destructive" data-testid="status-invalid-range">
          <AlertCircle className="size-4" /> End time must be after the start time.
        </div>
      ) : null}
      {fullError ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive" data-testid="status-download-error">
          <span className="flex items-center gap-2"><AlertCircle className="size-4" /> {fullError}</span>
          <button type="button" onClick={onFullDownload} className="underline underline-offset-2" data-testid="button-retry-download">Retry</button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          disabled={clipPending || invalid}
          onClick={onClip}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-[3px_3px_0_hsl(var(--foreground))] transition-all hover:-translate-y-0.5 hover:shadow-[4px_5px_0_hsl(var(--foreground))] active:translate-y-0 disabled:pointer-events-none disabled:opacity-55"
          data-testid="button-create-clip"
        >
          {clipPending ? <LoaderCircle className="size-4 animate-spin" /> : <Scissors className="size-4" />}
          {clipPending ? 'Forging your clip' : 'Create & download clip'}
        </button>
        <button
          type="button"
          disabled={fullState === 'loading'}
          onClick={onFullDownload}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-background px-4 text-sm font-bold text-foreground transition-colors hover:border-foreground/45 hover:bg-muted disabled:pointer-events-none disabled:opacity-55"
          data-testid="button-download-full"
        >
          {fullState === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : fullState === 'success' ? <Check className="size-4 text-[#697200]" /> : <ArrowDownToLine className="size-4" />}
          <span className="hidden sm:inline">{fullState === 'success' ? 'Downloaded' : 'Full source'}</span>
          <span className="sm:hidden">{fullState === 'success' ? 'Done' : 'Full'}</span>
        </button>
      </div>
      <p className="mt-3 text-center text-[10px] text-muted-foreground">MP4 output · your source remains untouched</p>
    </section>
  );
}

function EditorAside({ video }: { video: VideoInfo }) {
  return (
    <aside className="hidden space-y-4 xl:block">
      <div className="rounded-[1.1rem] border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">A clean handoff</p>
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/30 text-[#697200]"><Target className="size-3.5" /></span>
            <div><p className="text-xs font-bold">Mark the moment</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Type exact seconds or drag the handles.</p></div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Scissors className="size-3.5" /></span>
            <div><p className="text-xs font-bold">Forge the clip</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Only the selected window is processed.</p></div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><Download className="size-3.5" /></span>
            <div><p className="text-xs font-bold">Take it with you</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">A ready-to-use MP4 lands in your downloads.</p></div>
          </div>
        </div>
      </div>
      <div className="rounded-[1.1rem] border border-foreground/10 bg-secondary p-5 text-primary-foreground">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[.18em] text-primary-foreground/55">loaded source</span>
          <span className="size-2 rounded-full bg-accent" />
        </div>
        <p className="mt-3 line-clamp-2 font-display text-sm font-bold" data-testid="text-aside-source">{video.title}</p>
        <p className="mt-3 font-mono text-[10px] text-primary-foreground/55">{video.filename}</p>
      </div>
    </aside>
  );
}

export default function Workspace() {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [clipTitle, setClipTitle] = useState('');
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipSuccess, setClipSuccess] = useState(false);
  const [fullState, setFullState] = useState<DownloadState>('idle');
  const [fullError, setFullError] = useState<string | null>(null);

  const form = useForm<InspectValues>({
    resolver: zodResolver(inspectSchema),
    defaultValues: { url: '' },
  });
  const inspectMutation = useInspectVideo();
  const clipMutation = useCreateVideoClip();
  const downloadParams = useMemo(() => ({ url: video?.url ?? '' }), [video?.url]);
  const downloadQuery = useDownloadVideo(downloadParams, {
    query: {
      enabled: false,
      queryKey: getDownloadVideoQueryKey(downloadParams),
    },
  });

  const inspectSource = useCallback((values: InspectValues) => {
    setInspectError(null);
    setClipError(null);
    setClipSuccess(false);
    setFullState('idle');
    inspectMutation.mutate({ data: { url: values.url } }, {
      onSuccess: (result) => {
        setVideo(result);
        setStart(0);
        setEnd(result.durationSeconds);
        setClipTitle('');
      },
      onError: (error) => setInspectError(getErrorMessage(error, 'We could not inspect that source. Check the link and try again.')),
    });
  }, [inspectMutation]);

  const createClip = useCallback(() => {
    if (!video || end <= start) return;
    setClipError(null);
    setClipSuccess(false);
    clipMutation.mutate({
      data: {
        url: video.url,
        startSeconds: Number(start.toFixed(2)),
        endSeconds: Number(end.toFixed(2)),
        title: clipTitle.trim() || null,
      },
    }, {
      onSuccess: (blob) => {
        saveBlob(blob, clipTitle.trim() ? `${clipTitle.trim()}.mp4` : `clipforge-${video.filename}`);
        setClipSuccess(true);
      },
      onError: (error) => setClipError(getErrorMessage(error, 'The clip could not be created. Please try again.')),
    });
  }, [clipMutation, clipTitle, end, start, video]);

  const downloadFull = useCallback(async () => {
    if (!video) return;
    setFullError(null);
    setFullState('loading');
    try {
      const result = await downloadQuery.refetch();
      if (!result.data) throw new Error('No video file was returned.');
      saveBlob(result.data, video.filename || 'source-video.mp4');
      setFullState('success');
    } catch (error) {
      setFullState('error');
      setFullError(getErrorMessage(error, 'The source could not be downloaded. Please try again.'));
    }
  }, [downloadQuery, video]);

  const resetSource = () => {
    setVideo(null);
    setInspectError(null);
    setClipError(null);
    setClipSuccess(false);
    setFullState('idle');
    form.reset();
  };

  return (
    <div className="clipforge-noise min-h-[100dvh] bg-background">
      <WorkspaceHeader />
      <main className="mx-auto max-w-[1360px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-16">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] lg:gap-14 xl:grid-cols-[minmax(0,1.05fr)_minmax(480px,600px)] xl:gap-20">
          <div className="min-w-0">
            {!video ? <IntroBlock /> : (
              <div className="mb-9 animate-rise">
                <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary"><span className="inline-block h-px w-8 bg-primary" /> source ready</div>
                <h1 className="max-w-xl font-display text-[clamp(2.2rem,5vw,4.6rem)] font-bold leading-[.95] tracking-[-.07em]">Shape the<br /><span className="text-primary">good part.</span></h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Your source is loaded. Set the in and out points with confidence.</p>
              </div>
            )}
            <UrlForm form={form} isPending={inspectMutation.isPending} onSubmit={inspectSource} />
            {inspectError ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive animate-rise" role="alert" data-testid="status-inspect-error">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div><p className="font-bold">That source needs another look.</p><p className="mt-1 text-xs leading-5">{inspectError}</p></div>
              </div>
            ) : null}
            <PermissionNote />

            <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1fr)_208px]">
              {inspectMutation.isPending ? <PreviewSkeleton /> : video ? <PreviewCard video={video} /> : <EmptyPreview />}
              {video ? <EditorAside video={video} /> : (
                <div className="hidden flex-col justify-end gap-3 pb-1 text-right xl:flex">
                  <p className="font-display text-sm font-bold leading-5">No sign-in.<br />No guesswork.</p>
                  <p className="text-[11px] leading-4 text-muted-foreground">A focused workspace for one source at a time.</p>
                </div>
              )}
            </div>
            {clipError ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive animate-rise" data-testid="status-clip-error">
                <AlertCircle className="size-4 shrink-0" /> {clipError}
              </div>
            ) : null}
            {clipSuccess ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/50 bg-accent/20 px-4 py-3 text-xs font-bold text-[#697200] animate-rise" data-testid="status-clip-success">
                <span className="flex items-center gap-2"><Check className="size-4" /> Your clip is ready in your downloads.</span>
                <button type="button" onClick={() => setClipSuccess(false)} className="rounded-full p-1 hover:bg-accent/30" data-testid="button-dismiss-success" aria-label="Dismiss success message"><X className="size-3.5" /></button>
              </div>
            ) : null}
          </div>

          <div className="lg:pt-[2px]">
            {video ? (
              <div className="animate-rise animate-rise-delay-2">
                <TrimControls video={video} start={start} end={end} setStart={setStart} setEnd={setEnd} title={clipTitle} setTitle={setClipTitle} onClip={createClip} onFullDownload={downloadFull} clipPending={clipMutation.isPending} fullState={fullState} fullError={fullError} />
                <button type="button" onClick={resetSource} className="mx-auto mt-5 flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground" data-testid="button-inspect-another">
                  <RotateCcw className="size-3.5" /> Inspect another source
                </button>
              </div>
            ) : (
              <div className="clipforge-grid hidden min-h-[470px] rounded-[1.1rem] border border-border bg-card/45 p-7 lg:block animate-rise animate-rise-delay-2">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">01 / start with a source</span>
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="relative py-14">
                    <div className="absolute left-5 top-1/2 h-px w-[calc(100%-2.5rem)] -translate-y-1/2 bg-foreground/10" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-background text-primary"><Upload className="size-5" /></div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-accent/50 bg-accent/20 text-[#697200]"><Target className="size-5" /></div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary-foreground"><Download className="size-5" /></div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-5">
                    <p className="font-display text-lg font-bold tracking-[-.03em]">Small tools for exact work.</p>
                    <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">No timeline bloat. No distracting dashboard. Just your source, your marks, and your export.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="mx-auto flex max-w-[1360px] items-center justify-between border-t border-border px-5 py-6 text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground sm:px-8 lg:px-12">
        <span>clipforge / creator utility</span>
        <span className="flex items-center gap-2"><LockKeyhole className="size-3" /> permission-first processing</span>
      </footer>
    </div>
  );
}