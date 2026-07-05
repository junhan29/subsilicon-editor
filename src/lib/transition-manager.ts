export type TransitionType =
  | 'fade'
  | 'slide'
  | 'dissolve'
  | 'shutter'
  | 'zoom'
  | 'blur'

export interface TransitionConfig {
  type: TransitionType
  duration: number
  direction?: 'left' | 'right' | 'up' | 'down'
}

export const TRANSITION_TYPES: Record<TransitionType, { label: string; description: string }> = {
  fade: {
    label: '淡入淡出',
    description: '场景渐变过渡',
  },
  slide: {
    label: '推移',
    description: '场景从侧面滑入',
  },
  dissolve: {
    label: '溶解',
    description: '像素化溶解效果',
  },
  shutter: {
    label: '百叶窗',
    description: '类似百叶窗开合',
  },
  zoom: {
    label: '缩放',
    description: '场景缩放过渡',
  },
  blur: {
    label: '模糊',
    description: '模糊过渡效果',
  },
}

export class TransitionManager {
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private isTransitioning = false
  private originalPosition: string | null = null
  private transitionQueue: Promise<void> = Promise.resolve()

  initialize(container: HTMLElement): void {
    this.container = container

    // 保存原始 position 用于还原
    this.originalPosition = container.style.position

    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1000;
      opacity: 0;
      transition: none;
    `
    container.style.position = 'relative'
    container.appendChild(this.overlay)
  }

  async transition(
    from: () => void,
    to: () => void,
    config: TransitionConfig
  ): Promise<void> {
    if (!this.overlay) {
      to()
      return
    }

    // 排队实现：所有 transition 串行执行
    const next = this.transitionQueue.then(async () => {
      this.isTransitioning = true
      from()
      this.overlay!.style.opacity = '1'

      await this.performTransition(to, config)

      this.overlay!.style.opacity = '0'
      this.isTransitioning = false
    })

    this.transitionQueue = next.catch(() => {})
    return next
  }

  private async performTransition(
    to: () => void,
    config: TransitionConfig
  ): Promise<void> {
    const { type, duration, direction = 'left' } = config

    switch (type) {
      case 'fade':
        await this.fadeTransition(to, duration)
        break
      case 'slide':
        await this.slideTransition(to, duration, direction)
        break
      case 'dissolve':
        await this.dissolveTransition(to, duration)
        break
      case 'shutter':
        await this.shutterTransition(to, duration)
        break
      case 'zoom':
        await this.zoomTransition(to, duration)
        break
      case 'blur':
        await this.blurTransition(to, duration)
        break
      default:
        to()
    }
  }

  private fadeTransition(to: () => void, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay) {
        to()
        resolve()
        return
      }

      this.overlay.style.transition = `opacity ${duration}ms ease-in-out`

      requestAnimationFrame(() => {
        this.overlay!.style.opacity = '0'
        to()

        setTimeout(() => {
          this.overlay!.style.transition = 'none'
          resolve()
        }, duration)
      })
    })
  }

  private slideTransition(
    to: () => void,
    duration: number,
    direction: 'left' | 'right' | 'up' | 'down'
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay || !this.container) {
        to()
        resolve()
        return
      }

      const getTransform = (progress: number, reverse = false) => {
        const sign = reverse ? -1 : 1
        const p = progress * 100

        switch (direction) {
          case 'left':
            return `translateX(${sign * p}%)`
          case 'right':
            return `translateX(${-sign * p}%)`
          case 'up':
            return `translateY(${sign * p}%)`
          case 'down':
            return `translateY(${-sign * p}%)`
        }
      }

      this.overlay.style.transition = `transform ${duration}ms ease-in-out`
      this.overlay.style.transform = getTransform(0, true)

      requestAnimationFrame(() => {
        this.overlay!.style.transform = getTransform(0, true)
        this.overlay!.style.opacity = '1'

        requestAnimationFrame(() => {
          this.overlay!.style.transform = getTransform(1, true)

          setTimeout(() => {
            to()
            this.overlay!.style.transform = 'translateX(100%)'

            requestAnimationFrame(() => {
              this.overlay!.style.transform = 'translateX(0)'
              this.overlay!.style.opacity = '0'
              this.overlay!.style.transition = 'none'

              setTimeout(resolve, 50)
            })
          }, duration)
        })
      })
    })
  }

  private dissolveTransition(to: () => void, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay || !this.container) {
        to()
        resolve()
        return
      }

      this.overlay.style.opacity = '1'
      to()

      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        const opacity = 1 - this.easeInOutQuad(progress)
        this.overlay!.style.opacity = String(opacity)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          this.overlay!.style.opacity = '0'
          resolve()
        }
      }

      requestAnimationFrame(animate)
    })
  }

  private shutterTransition(to: () => void, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay || !this.container) {
        to()
        resolve()
        return
      }

      const stripes = 10
      const stripeHeight = 100 / stripes

      this.overlay.innerHTML = ''
      this.overlay.style.opacity = '1'

      for (let i = 0; i < stripes; i++) {
        const stripe = document.createElement('div')
        stripe.style.cssText = `
          position: absolute;
          left: 0;
          width: 100%;
          height: ${stripeHeight}%;
          top: ${i * stripeHeight}%;
          background: black;
          transform: scaleY(0);
          transform-origin: center;
        `
        this.overlay.appendChild(stripe)
      }

      const allStripes = this.overlay.querySelectorAll('div')

      requestAnimationFrame(() => {
        allStripes.forEach((stripe, i) => {
          const delay = (i / stripes) * (duration * 0.3)
          setTimeout(() => {
            ;(stripe as HTMLElement).style.transition = `transform ${duration * 0.4}ms ease-in`
            ;(stripe as HTMLElement).style.transform = 'scaleY(1)'
          }, delay)
        })

        setTimeout(() => {
          to()

          setTimeout(() => {
            allStripes.forEach((stripe, i) => {
              const delay = (i / stripes) * (duration * 0.3)
              setTimeout(() => {
                ;(stripe as HTMLElement).style.transition = `transform ${duration * 0.4}ms ease-out`
                ;(stripe as HTMLElement).style.transform = 'scaleY(0)'
              }, delay + duration * 0.4)
            })

            setTimeout(() => {
              this.overlay!.style.opacity = '0'
              this.overlay!.innerHTML = ''
              resolve()
            }, duration * 0.8 + duration * 0.4)
          }, duration * 0.4)
        }, duration * 0.6)
      })
    })
  }

  private zoomTransition(to: () => void, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay || !this.container) {
        to()
        resolve()
        return
      }

      this.overlay.style.transition = `transform ${duration}ms ease-in-out`
      this.overlay.style.opacity = '1'

      requestAnimationFrame(() => {
        this.overlay!.style.transform = 'scale(2)'

        setTimeout(() => {
          to()
          this.overlay!.style.transform = 'scale(1)'

          setTimeout(() => {
            this.overlay!.style.transition = 'none'
            this.overlay!.style.opacity = '0'
            this.overlay!.style.transform = 'scale(2)'
            resolve()
          }, duration)
        }, duration * 0.5)
      })
    })
  }

  private blurTransition(to: () => void, duration: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay || !this.container) {
        to()
        resolve()
        return
      }

      this.overlay.style.opacity = '1'

      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        if (progress < 0.5) {
          const blurProgress = progress * 2
          this.overlay!.style.backdropFilter = `blur(${blurProgress * 20}px)`
        } else {
          const blurProgress = (progress - 0.5) * 2
          to()
          this.overlay!.style.backdropFilter = `blur(${(1 - blurProgress) * 20}px)`
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          this.overlay!.style.backdropFilter = 'blur(0)'
          this.overlay!.style.opacity = '0'
          resolve()
        }
      }

      requestAnimationFrame(animate)
    })
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  destroy(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
    }
    // 还原容器原始 position
    if (this.container) {
      this.container.style.position = this.originalPosition ?? ''
    }
    this.overlay = null
    this.container = null
    this.originalPosition = null
    this.isTransitioning = false
  }
}

export function createTransitionManager(): TransitionManager {
  return new TransitionManager()
}

export function getTransitionCSS(type: TransitionType, duration: number): string {
  switch (type) {
    case 'fade':
      return `transition: opacity ${duration}ms ease-in-out;`
    case 'slide':
      return `transition: transform ${duration}ms ease-in-out;`
    case 'zoom':
      return `transition: transform ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out;`
    default:
      return ''
  }
}
