/**
 * Turning whatever came out of the camera into something a profile can carry.
 *
 * A phone photo is 3–8 MB and 4000px wide. That has to become a few dozen KB,
 * because a profile photo here is a `data:` URL living in a text column (see
 * `Player.photo`): in local mode the whole app state is one localStorage key
 * with a ~5 MB ceiling for everything, and in cloud mode every profile row is
 * fetched on every load, so one careless upload is paid for by everyone in the
 * club on every launch.
 */

/**
 * Longest edge of the stored image.
 *
 * It has two jobs at once: a 32px avatar, and a full-bleed hero behind the home
 * screen greeting. The hero is what sets this — 400 CSS px at 3× is 1200 device
 * px, and going that wide would defeat the point, so 720 is the compromise where
 * the hero is soft only on the sharpest phones and the avatar is perfect
 * everywhere.
 */
const MAX_EDGE = 720

/** JPEG quality. Below about 0.7 the compression starts showing on skin. */
const QUALITY = 0.8

/** Refuse anything obviously not an image before decoding it. */
const MAX_INPUT_BYTES = 24 * 1024 * 1024

export class PhotoError extends Error {}

/**
 * Read a picked file, shrink it, and return a JPEG data URL.
 *
 * Square-cropped from the centre, because every place it's shown is either a
 * circle or a wide band, and cropping here means the awkward decision is made
 * once rather than by four different CSS rules.
 */
export async function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError('That file is not an image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new PhotoError('That image is too large to use.')
  }

  const bitmap = await loadBitmap(file)
  try {
    const edge = Math.min(bitmap.width, bitmap.height, MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = edge
    canvas.height = edge
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new PhotoError('This browser will not let the app resize images.')

    // The centre square of the source, scaled into the whole canvas.
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      edge,
      edge,
    )
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    if ('close' in bitmap) bitmap.close()
  }
}

/**
 * `createImageBitmap` handles EXIF rotation for us where it exists, which
 * matters — without it every portrait photo taken on a phone arrives sideways.
 * The `<img>` path is the fallback for browsers that lack it.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through — some browsers reject the options bag rather than ignore it.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new PhotoError("That image couldn't be read."))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
