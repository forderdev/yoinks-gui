import assert from 'node:assert/strict'
import test from 'node:test'
import {audioOptions, downloadChoice, videoOptions} from './options.js'
import type {VideoInfo} from '../../src/lib/ytdlp.js'

const info: VideoInfo = {
  title: 'Test',
  formats: [
    {format_id: 'v1080', height: 1080, vcodec: 'avc1', acodec: 'none', ext: 'mp4'},
    {format_id: 'v720', height: 720, vcodec: 'avc1', acodec: 'none', ext: 'mp4'},
    {format_id: 'a128', vcodec: 'none', acodec: 'opus', abr: 128},
    {format_id: 'a64', vcodec: 'none', acodec: 'opus', abr: 64},
  ],
}

test('only genuine video resolutions are listed', () => {
  assert.deepEqual(videoOptions(info).map(option => option.label.split(' · ')[0]), ['1080p', '720p'])
})

test('audio options reflect actual streams and offer best', () => {
  assert.deepEqual(audioOptions(info).map(option => option.id), ['best', 'a128', 'a64'])
})

test('selected audio stream is used in video downloads', () => {
  const choice = downloadChoice(info, 'video', '0', 'a128')
  assert.equal(choice.kind, 'video')
  assert.match(choice.args[1]!, /\+a128/)
})

test('audio-only downloads convert to mp3 at the chosen quality', () => {
  const choice = downloadChoice(info, 'audio', '', 'a64')
  assert.deepEqual(choice.args, ['-f', 'a64', '-x', '--audio-format', 'mp3', '--audio-quality', '64K'])
})

test('invalid selections cannot become arbitrary yt-dlp arguments', () => {
  assert.throws(() => downloadChoice(info, 'video', '4', 'best'))
  assert.throws(() => downloadChoice(info, 'audio', '', '--exec'))
})
