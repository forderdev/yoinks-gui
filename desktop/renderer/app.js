/* This file runs in Electron's isolated renderer: no Node.js access. */
const $ = id => document.getElementById(id)
const api = window.yoinks
const state = {busy: false, analyzing: false, info: null, downloaded: false, cancelled: false, progress: false}
const number = value => Number.isFinite(value) ? value : 0
const bytes = value => {
  if (!value) return ''
  const i = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${['B','KB','MB','GB'][i]}`
}
const duration = sec => {
  const s = Math.round(sec || 0)
  return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}` : ''
}
function message(text, success = false) {
  $('message').textContent = text
  $('message').classList.toggle('success', success)
}
function setBusy(value) {
  state.busy = value
  $('analyze').disabled = value
  $('download').disabled = value
  $('choose-folder').disabled = value
  $('mode').disabled = value
  $('resolution').disabled = value
  $('audio-quality').disabled = value
}
function selectOptions(select, options) {
  select.replaceChildren()
  options.forEach(option => {
    const node = document.createElement('option')
    node.value = option.id
    node.textContent = option.label
    select.append(node)
  })
}
function updateMode() {
  const audioOnly = $('mode').value === 'audio'
  $('video-field').hidden = audioOnly
  $('download').textContent = audioOnly ? '♫ MP3 indir' : '↓ Videoyu indir'
}
function setProgress(percent) {
  const p = Math.min(100, Math.max(0, Math.round(percent)))
  $('progress-fill').style.width = `${p}%`
  $('percentage').textContent = `${p}%`
}
$('mode').addEventListener('change', updateMode)
$('url').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !state.busy) $('analyze').click()
})
$('analyze').addEventListener('click', async () => {
  if (state.busy) return
  const raw = $('url').value.trim()
  if (!/^https?:\/\//i.test(raw)) return message('http:// veya https:// ile başlayan bir bağlantı girin.')
  state.cancelled = false
  state.info = null
  $('details').hidden = true
  $('progress-panel').hidden = false
  $('cancel').hidden = false
  $('open-folder').hidden = true
  $('status-title').textContent = 'Bağlantı analiz ediliyor…'
  $('transfer').textContent = 'Video bilgileri alınıyor.'
  setProgress(0)
  message('')
  setBusy(true)
  try {
    const info = await api.analyze(raw)
    if (state.cancelled) return
    state.info = info
    $('title').textContent = info.title || 'Başlıksız içerik'
    $('meta').textContent = [info.uploader, duration(info.duration)].filter(Boolean).join(' · ')
    selectOptions($('resolution'), info.video)
    selectOptions($('audio-quality'), info.audio)
    if (!info.video.length) $('mode').value = 'audio'
    else $('mode').value = 'video'
    $('mode').querySelector('option[value="video"]').disabled = !info.video.length
    updateMode()
    $('details').hidden = false
    $('progress-panel').hidden = true
    message('Bağlantı bulundu. Kaliteyi seçip indir.', true)
  } catch (error) {
    if (!state.cancelled) message(error.message || String(error))
    $('progress-panel').hidden = true
  } finally { setBusy(false) }
})
$('choose-folder').addEventListener('click', async () => {
  try { $('folder').textContent = (await api.folder()).outDir }
  catch (error) { message(error.message) }
})
$('download').addEventListener('click', async () => {
  if (state.busy || !state.info) return
  state.cancelled = false
  state.downloaded = false
  state.progress = true
  message('')
  setBusy(true)
  $('progress-panel').hidden = false
  $('status-title').textContent = 'İndiriliyor…'
  $('transfer').textContent = 'İndirme hazırlanıyor…'
  $('cancel').hidden = false
  $('open-folder').hidden = true
  setProgress(0)
  try {
    const result = await api.download({
      mode: $('mode').value,
      videoId: $('resolution').value,
      audioId: $('audio-quality').value,
    })
    if (state.cancelled) return
    state.downloaded = true
    setProgress(100)
    $('status-title').textContent = 'İndirme tamamlandı!'
    $('transfer').textContent = result.filepath
    $('cancel').hidden = true
    $('open-folder').hidden = false
    message('Dosya başarıyla kaydedildi.', true)
  } catch (error) {
    if (!state.cancelled) {
      $('status-title').textContent = 'İndirme başarısız'
      message(error.message || String(error))
    }
  } finally { setBusy(false); state.progress = false }
})
$('cancel').addEventListener('click', async () => {
  state.cancelled = true
  await api.cancel()
  $('progress-panel').hidden = true
  message('İşlem iptal edildi.')
  setBusy(false)
})
$('open-folder').addEventListener('click', () => api.openFolder())
api.onStatus(status => {
  if (state.cancelled || !state.busy) return
  $('transfer').textContent = status
})
api.onProgress(p => {
  if (!state.busy || state.cancelled) return
  if (number(p.totalBytes) > 0) setProgress(number(p.downloadedBytes) / p.totalBytes * 100)
  const speed = p.speed ? ` · ${bytes(p.speed)}/sn` : ''
  const eta = p.eta ? ` · ${Math.ceil(p.eta)} sn kaldı` : ''
  $('transfer').textContent = `${bytes(p.downloadedBytes)} / ${bytes(p.totalBytes)}${speed}${eta}`
})
api.config().then(value => $('folder').textContent = value.outDir).catch(error => message(error.message))
