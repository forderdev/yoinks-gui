import {buildChoices, type DownloadChoice, type VideoInfo} from '../../src/lib/ytdlp.js'

export type AudioOption = {id: string; label: string; formatId?: string; bitrate?: number}
export type VideoOption = {id: string; label: string}

/**
 * Options come from yt-dlp's actual metadata, not made-up 720p/1080p choices.
 * "best" works as a fallback for websites that don't expose individual tracks.
 */
export function videoOptions(info: VideoInfo): VideoOption[] {
  const hasVideo = (info.formats ?? []).some(f => f.vcodec && f.vcodec !== 'none')
  if (!hasVideo && info.formats?.length) return []
  return buildChoices(info)
    .filter(choice => choice.kind === 'video')
    .map((choice, index) => ({id: String(index), label: choice.label}))
}

export function audioOptions(info: VideoInfo): AudioOption[] {
  const result: AudioOption[] = [{id: 'best', label: 'En iyi (otomatik)'}]
  const formats = (info.formats ?? [])
    .filter(f => f.format_id && f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
    .map(f => ({id: f.format_id, bitrate: Math.round(f.abr ?? f.tbr ?? 0)}))
    .filter(f => f.bitrate > 0 && /^[a-zA-Z0-9_.-]+$/.test(f.id))
    .sort((a, b) => b.bitrate - a.bitrate)
  const seen = new Set<number>()
  for (const format of formats) {
    if (seen.has(format.bitrate)) continue
    seen.add(format.bitrate)
    result.push({
      id: format.id,
      formatId: format.id,
      bitrate: format.bitrate,
      label: `${format.bitrate} kbps (kaynak)`,
    })
    if (result.length >= 8) break
  }
  return result
}

export function downloadChoice(
  info: VideoInfo,
  mode: 'video' | 'audio',
  videoId: string,
  audioId: string,
): DownloadChoice {
  const audio = audioOptions(info).find(option => option.id === audioId)
  if (!audio) throw new Error('Geçersiz ses kalitesi. Lütfen bağlantıyı yeniden analiz edin.')

  if (mode === 'audio') {
    const quality = audio.bitrate ? `${Math.min(320, Math.max(64, audio.bitrate))}K` : '0'
    return {
      kind: 'audio',
      label: `MP3 · ${audio.label}`,
      args: ['-f', audio.formatId ?? 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', quality],
    }
  }

  const original = buildChoices(info).filter(choice => choice.kind === 'video')[Number(videoId)]
  if (!original || !videoOptions(info).some(v => v.id === videoId)) {
    throw new Error('Geçersiz çözünürlük. Lütfen bağlantıyı yeniden analiz edin.')
  }

  const args = [...original.args]
  const selector = args.indexOf('-f') + 1
  if (audio.formatId && selector > 0 && selector < args.length) {
    // Keep the original fallback order for sites with muxed video/audio.
    args[selector] = args[selector]!.replace(/\+ba\b/g, `+${audio.formatId}`)
  }
  return {...original, args}
}
