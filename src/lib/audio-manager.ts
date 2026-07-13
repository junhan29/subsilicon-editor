export type AudioChannelType = 'bgm' | 'bgs' | 'se' | 'voice'

export interface AudioChannelState {
  audio: HTMLAudioElement | null
  currentUrl: string | null
  volume: number
  isPlaying: boolean
  loop: boolean
  fadeTimer: number | null
  cleanup: (() => void) | null
}

export interface AudioOptions {
  loop?: boolean
  volume?: number
  fadeTime?: number
}

export interface AudioManagerConfig {
  bgmVolume?: number
  bgsVolume?: number
  seVolume?: number
  voiceVolume?: number
  globalVolume?: number
}

export class AudioManager {
  private channels: Record<AudioChannelType, AudioChannelState>
  private globalVolume: number
  private masterMute: boolean

  constructor(config: AudioManagerConfig = {}) {
    this.globalVolume = config.globalVolume ?? 1
    this.masterMute = false

    this.channels = {
      bgm: {
        audio: null,
        currentUrl: null,
        volume: config.bgmVolume ?? 0.3,
        isPlaying: false,
        loop: true,
        fadeTimer: null,
        cleanup: null,
      },
      bgs: {
        audio: null,
        currentUrl: null,
        volume: config.bgsVolume ?? 0.2,
        isPlaying: false,
        loop: true,
        fadeTimer: null,
        cleanup: null,
      },
      se: {
        audio: null,
        currentUrl: null,
        volume: config.seVolume ?? 0.5,
        isPlaying: false,
        loop: false,
        fadeTimer: null,
        cleanup: null,
      },
      voice: {
        audio: null,
        currentUrl: null,
        volume: config.voiceVolume ?? 0.8,
        isPlaying: false,
        loop: false,
        fadeTimer: null,
        cleanup: null,
      },
    }
  }

  play(channel: AudioChannelType, url: string, options: AudioOptions = {}): void {
    const ch = this.channels[channel]

    if (ch.currentUrl === url && ch.isPlaying) {
      this.setChannelVolume(channel, options.volume ?? ch.volume)
      return
    }

    if (ch.fadeTimer) {
      clearInterval(ch.fadeTimer)
      ch.fadeTimer = null
    }

    if (ch.audio) {
      ch.cleanup?.()
      ch.cleanup = null
      ch.audio.pause()
      ch.audio = null
    }

    const audio = new Audio(url)
    audio.loop = options.loop ?? (channel === 'bgm' || channel === 'bgs')

    const targetVolume = (options.volume ?? ch.volume) * this.globalVolume * (this.masterMute ? 0 : 1)
    audio.volume = channel === 'bgm' || channel === 'bgs' ? 0 : targetVolume

    // 显式保存监听器引用，便于清理
    const onEnded = () => {
      if (!audio.loop) {
        ch.isPlaying = false
        ch.audio = null
        ch.currentUrl = null
      }
    }
    const onError = () => {
      ch.isPlaying = false
      ch.audio = null
      ch.currentUrl = null
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    ch.cleanup = () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }

    audio.play().then(() => {
      ch.audio = audio
      ch.currentUrl = url
      ch.isPlaying = true

      if ((channel === 'bgm' || channel === 'bgs') && options.fadeTime) {
        this.fadeIn(channel, options.fadeTime, targetVolume)
      } else {
        audio.volume = targetVolume
      }
    }).catch(() => {
      ch.isPlaying = false
      ch.audio = null
    })
  }

  stop(channel: AudioChannelType, fadeTime?: number): void {
    const ch = this.channels[channel]
    if (!ch.audio || !ch.isPlaying) return

    if (ch.fadeTimer) {
      clearInterval(ch.fadeTimer)
      ch.fadeTimer = null
    }

    if (fadeTime && (channel === 'bgm' || channel === 'bgs')) {
      this.fadeOut(channel, fadeTime).then(() => {
        this.stopImmediately(channel)
      })
    } else {
      this.stopImmediately(channel)
    }
  }

  private stopImmediately(channel: AudioChannelType): void {
    const ch = this.channels[channel]
    if (ch.audio) {
      ch.cleanup?.()
      ch.cleanup = null
      ch.audio.pause()
      ch.audio = null
    }
    ch.currentUrl = null
    ch.isPlaying = false
  }

  fadeIn(channel: AudioChannelType, duration: number, targetVolume: number): void {
    const ch = this.channels[channel]
    if (!ch.audio || ch.fadeTimer) return

    const startVolume = ch.audio.volume
    const startTime = Date.now()

    ch.fadeTimer = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const eased = this.easeInOutQuad(progress)
      ch.audio!.volume = startVolume + (targetVolume - startVolume) * eased

      if (progress >= 1) {
        clearInterval(ch.fadeTimer!)
        ch.fadeTimer = null
        ch.audio!.volume = targetVolume
      }
    }, 16)
  }

  fadeOut(channel: AudioChannelType, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const ch = this.channels[channel]
      if (!ch.audio || ch.fadeTimer) {
        resolve()
        return
      }

      const startVolume = ch.audio.volume
      const startTime = Date.now()

      ch.fadeTimer = window.setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        const eased = this.easeInOutQuad(progress)
        ch.audio!.volume = startVolume * (1 - eased)

        if (progress >= 1) {
          clearInterval(ch.fadeTimer!)
          ch.fadeTimer = null
          resolve()
        }
      }, 16)
    })
  }

  setChannelVolume(channel: AudioChannelType, volume: number): void {
    const ch = this.channels[channel]
    const clamped = Math.max(0, Math.min(1, volume))
    ch.volume = clamped

    if (ch.audio) {
      ch.audio.volume = clamped * this.globalVolume * (this.masterMute ? 0 : 1)
    }
  }

  getChannelVolume(channel: AudioChannelType): number {
    return this.channels[channel].volume
  }

  setGlobalVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume))
    this.globalVolume = clamped

    for (const channel of Object.keys(this.channels) as AudioChannelType[]) {
      const ch = this.channels[channel]
      if (ch.audio) {
        ch.audio.volume = ch.volume * clamped * (this.masterMute ? 0 : 1)
      }
    }
  }

  getGlobalVolume(): number {
    return this.globalVolume
  }

  toggleMute(): boolean {
    this.masterMute = !this.masterMute

    for (const channel of Object.keys(this.channels) as AudioChannelType[]) {
      const ch = this.channels[channel]
      if (ch.audio) {
        ch.audio.volume = this.masterMute ? 0 : ch.volume * this.globalVolume
      }
    }

    return this.masterMute
  }

  isMuted(): boolean {
    return this.masterMute
  }

  isPlaying(channel: AudioChannelType): boolean {
    return this.channels[channel].isPlaying
  }

  getCurrentUrl(channel: AudioChannelType): string | null {
    return this.channels[channel].currentUrl
  }

  pauseAll(): void {
    for (const channel of Object.keys(this.channels) as AudioChannelType[]) {
      const ch = this.channels[channel]
      if (ch.audio && ch.isPlaying) {
        ch.audio.pause()
        ch.isPlaying = false
      }
    }
  }

  resumeAll(): void {
    for (const channel of Object.keys(this.channels) as AudioChannelType[]) {
      const ch = this.channels[channel]
      if (ch.audio && !ch.isPlaying) {
        ch.audio.play().then(() => {
          ch.isPlaying = true
        }).catch(() => {
          ch.isPlaying = false
        })
      }
    }
  }

  stopAll(fadeTime?: number): void {
    const channels = ['bgm', 'bgs', 'se', 'voice'] as const

    if (fadeTime) {
      const promises = channels.map((ch) => {
        if (ch === 'bgm' || ch === 'bgs') {
          return this.fadeOut(ch, fadeTime)
        }
        return Promise.resolve()
      })

      Promise.all(promises).then(() => {
        channels.forEach((ch) => this.stopImmediately(ch))
      })
    } else {
      channels.forEach((ch) => this.stopImmediately(ch))
    }
  }

  destroy(): void {
    this.stopAll()
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
}

export function createAudioManager(config?: AudioManagerConfig): AudioManager {
  return new AudioManager(config)
}