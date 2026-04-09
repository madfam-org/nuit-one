<script lang="ts">
  import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_AUDIO_FORMATS } from '@nuit-one/shared';
  import { Button } from '@nuit-one/ui';

  interface Props {
    onUploadComplete: (trackId: string) => void;
  }

  const { onUploadComplete }: Props = $props();

  let uploading = $state(false);
  let progress = $state(0);
  let errorMsg = $state('');
  let dragging = $state(false);

  const acceptFormats = SUPPORTED_AUDIO_FORMATS.map((f) => `.${f}`).join(',');

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function handleDragLeave() {
    dragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) uploadFile(file);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) uploadFile(file);
    input.value = '';
  }

  async function uploadFile(file: File) {
    errorMsg = '';

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      errorMsg = `File too large. Maximum ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB.`;
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_AUDIO_FORMATS.includes(ext as typeof SUPPORTED_AUDIO_FORMATS[number])) {
      errorMsg = `Unsupported format. Use: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`;
      return;
    }

    uploading = true;
    progress = 0;

    try {
      // 1. Get signed upload URL
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || `audio/${ext}`,
          size: file.size,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(data.message ?? `Upload failed (${res.status})`);
      }

      const { trackId, uploadUrl } = await res.json();

      // 2. Upload file to R2 via signed URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || `audio/${ext}`);
        xhr.send(file);
      });

      // 3. Confirm upload
      const confirmRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      });

      if (!confirmRes.ok) throw new Error('Failed to confirm upload');

      onUploadComplete(trackId);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      uploading = false;
      progress = 0;
    }
  }
</script>

<div
  class="upload-zone"
  class:dragging
  class:uploading
  role="region"
  aria-label="Audio file upload area"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#if uploading}
    <div class="upload-progress">
      <div class="progress-bar">
        <div class="progress-fill" style:width="{progress}%"></div>
      </div>
      <p class="progress-text">{progress}% uploading...</p>
    </div>
  {:else}
    <div class="upload-content">
      <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <p class="upload-text">Drop an audio file here or click to browse</p>
      <p class="upload-formats">{SUPPORTED_AUDIO_FORMATS.join(', ').toUpperCase()} — max {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB</p>
      <label>
        <Button variant="secondary" size="sm">
          Choose File
        </Button>
        <input
          type="file"
          accept={acceptFormats}
          onchange={handleFileInput}
          class="sr-only"
        />
      </label>
    </div>
  {/if}

  {#if errorMsg}
    <p class="error-msg">{errorMsg}</p>
  {/if}
</div>

<style>
  .upload-zone {
    border: 2px dashed rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 2.5rem;
    text-align: center;
    transition: all 250ms ease;
    background: rgba(255, 255, 255, 0.02);
  }

  .upload-zone.dragging {
    border-color: #00f5ff;
    background: rgba(0, 245, 255, 0.04);
    box-shadow: 0 0 30px rgba(0, 245, 255, 0.1);
  }

  .upload-zone.uploading {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .upload-icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: #606070;
  }

  .dragging .upload-icon {
    color: #00f5ff;
  }

  .upload-text {
    color: #a0a0b0;
    margin-bottom: 0.25rem;
  }

  .upload-formats {
    color: #606070;
    font-size: 0.75rem;
    margin-bottom: 1rem;
  }

  .upload-progress {
    padding: 1rem 0;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .progress-fill {
    height: 100%;
    background: #00f5ff;
    border-radius: 3px;
    transition: width 150ms ease;
    box-shadow: 0 0 10px rgba(0, 245, 255, 0.4);
  }

  .progress-text {
    color: #a0a0b0;
    font-size: 0.875rem;
  }

  .error-msg {
    color: #ff4466;
    font-size: 0.875rem;
    margin-top: 1rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  label {
    display: inline-block;
    cursor: pointer;
  }
</style>
