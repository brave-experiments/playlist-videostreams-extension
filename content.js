/* This runs after a web page loads */

// TODO: attach a class instance of the below functionality to every video instance, and then just save them all or choose
// the longest one.

(function (){
console.debug('media source content script')

let sourceId = 0
let bufferId = 100

/**
 * @type {MediaSource}
 */
let mainSource
/**
 * @type {HTMLVideoElement}
 */
let mainVideoElement
/**
 * @type {SourceBuffer}
 */
let mainBuffer

/** @type {{start: number, end: number}[]} */
const timesSeen = []

/** @type {HTMLVideoElement[]} */
const allVideoElements = []

const mediaSourceObjectUrlLookup = new WeakMap()

// window.allBuffers = []

/**
 * @typedef {Object} BufferStorageItem
 * @property {number} bufferId
 * @property {string} mimeType
 * @property {{start: Number, end: Number, buffer: Uint8Array}[]} buffers
 */

/**
 * @type {Map<SourceBuffer, BufferStorageItem>}
 */
const bufferStorage = new Map()
const oldWindowMediaSource = window.MediaSource
const showTest = false
if (showTest) {
  const testMediaSource = new oldWindowMediaSource()
  window.testMediaSource = testMediaSource
  window.testMediaSource._braveIsTest = true
  const video = document.createElement('video')
  video.className = 'brave'
  video.src = URL.createObjectURL(testMediaSource)
  video.controls = true
  video.style.position = 'fixed'
  video.style.top = '0'
  video.style.left = '0'
  video.style.right = '25vw'
  video.style.bottom = '25vh'
  window.testPlayer = video
}

const oldCreateObjectUrl = URL.createObjectURL
URL.createObjectURL = function (obj) {
  const url = oldCreateObjectUrl(obj)
  console.debug('create object url', obj, url)
  mediaSourceObjectUrlLookup.set(obj, url)
  return url
}

const timeCacheStatus = []
window.timeCacheStatus = timeCacheStatus

function getNextGapInCache () {
  const duration = Math.ceil(mainSource.duration)
  const diff = duration - timeCacheStatus.length
  if (diff) {
    timeCacheStatus.length = duration
    timeCacheStatus.fill(false, duration - diff)
  }
  for (const sourceBuffer of mainSource.sourceBuffers) {
    const timeItems = sourceBuffer.buffered.length
    for (let i = 0; i < sourceBuffer.buffered.length; i++) {
      timeCacheStatus.fill(true, Math.floor(sourceBuffer.buffered.start(i)), Math.ceil(sourceBuffer.buffered.end(i)))
    }
  }
  return timeCacheStatus.indexOf(false)
}

function debounce (fn, bufferInterval, ...args) {
  let timeout;
  return (...args2) => {
      clearTimeout(timeout);
      let a = args || [];
      if (args2 && args2.constructor === Array) {
          a = a.concat(args2);
      }
      timeout = setTimeout(fn.apply.bind(fn, this, a), bufferInterval);
  };
};


// const oldCreateElement = document.createElement
// document.createElement = function(...params) {
//   const element = oldCreateElement.call(document, params)
//   const tagName = params[0]
//   if (tagName === 'video' || tagName === 'audio') {
//     allVideoElements.push(element)
//   }
//   return element
// }


class NewMediaSource extends MediaSource {
  constructor(...args) {
    super(...args)
    this._braveSourceId = ++sourceId
    mainSource = this
    // TODO: if already loaded, iterate through video players and check if this is
    // the source for it
    console.debug('aNewMediaSoffurces', this._braveSourceId, this)
    this.sourceBuffers.addEventListener('addsourcebuffer', (p, e) => {
      console.debug('add source buffer', this._braveSourceId, p, e)
    })
    this.sourceBuffers.addEventListener('removesourcebuffer', (p, e) => {
      console.debug('remove source buffer', this._braveSourceId, p, e)
    })
    this.activeSourceBuffers.addEventListener('addsourcebuffer', (p, e) => {
      console.debug('active add source buffer', this._braveSourceId, p, e)
    })
    this.activeSourceBuffers.addEventListener('removesourcebuffer', (p, e) => {
      console.debug('active remove source buffer', this._braveSourceId, p, e)
    })
  }

  addSourceBuffer(type) {
    const buffer = super.addSourceBuffer(type)
    buffer.__proto__ = PlaylistSourceBuffer.prototype
    buffer._braveSourceId = this._braveSourceId
    buffer._braveBufferId = ++bufferId
    buffer._braveSourceBufferType = type
    if (type.includes('video')) {
      mainBuffer = buffer
    }
    console.debug('direct add source buffer', this._braveSourceId, buffer._braveBufferId, this, type, buffer)
    // window.allBuffers.push(buffer)
    // mirror media source so we can see what data we have
    console.debug('adding test buffer')
    if (showTest) {
      const testBuffer = testMediaSource.addSourceBuffer(type)
      console.debug('added test buffer', testBuffer)
      testBuffer._braveBufferId = buffer._braveBufferId
      testBuffer._braveTest = true
    }

    return buffer
  }

}

class PlaylistSourceBuffer extends SourceBuffer {
  constructor(...args) {
    super(...args)
    console.debug('ctor source buffer', ...args)
  }
  abort() {
    console.debug('abort sourcebuffer')
    super.abort()
  }
  changeType(type) {
    console.debug('change type', this, type)
    super.changeType(type)
  }
  appendWindowStart(...args) {
    console.debug('append window start', ...args)
    return super.appendWindowStart(...args)
  }
  appendWindowEnd(...args) {
    console.debug('append window End', ...args)
    return super.appendWindowEnd(...args)
  }
  onUpdateComplete() {
    console.debug('on update complete')
    this.onUpdateEnd()
    if (!this._pendingData) {
      console.error('append buffer no data!')
    }
    consumeBuffer(this, this._pendingData)
    // TODO: call seekToNextRangeOrCompleteDebounced when consumeBuffer hasn't been called in ~10ms - ~20ms. Avoid aborts
    if (this._braveSourceBufferType.includes('video')) {
      setTimeout(() => {
        seekToNextRangeOrCompleteDebounced()
      }, 1)
    }
  }
  onUpdateAbort() {
    console.debug('on update abort')
    this.onUpdateEnd()
  }
  onUpdateEnd() {
    this.removeEventListener('abort', this.onUpdateAbort)
    this.removeEventListener('update', this.onUpdateComplete)
  }

  /**
   *
   * @param {Uint8Array} data
   * @returns
   */
  appendBuffer(data) {
    if (this._braveTest) {
      return super.appendBuffer(data)
    }
    console.debug('append buffer', this._braveSourceId, this._braveBufferId, data)
    if (showTest) {
      const testBuffer = Array.from(testMediaSource.sourceBuffers).find(b => b._braveBufferId === this._braveBufferId)
      if (!testBuffer) {
        console.error("testBuffer not found!")
      } else {
        testBuffer.appendBuffer(data.slice(0))
      }
    }
    this._pendingData = data.slice(0)
    super.appendBuffer(data)
    this.addEventListener('abort', this.onUpdateAbort)
    this.addEventListener('update', this.onUpdateComplete)
  }
  remove(...args) {
    console.debug('remove buffer', this._braveSourceId, this._braveBufferId, ...args)
    return super.remove(...args)
  }
  appendBufferAsync(...args) {
    console.debug('append bufferAsync', this._braveSourceId, this._braveBufferId, ...args)
    return super.appendBufferAsync(...args)
  }
}

window.SourceBuffer = PlaylistSourceBuffer
window.MediaSource = NewMediaSource

window.addEventListener('DOMContentLoaded', () => {
  let videoElement = document.querySelector('video:not(.brave)')
  const url = mediaSourceObjectUrlLookup.get(mainSource)
  if (videoElement && mainSource && url && videoElement.src === url) {
      mainVideoElement = videoElement
      console.debug('found main source and video element')
      // doSaving()
  }
  console.debug('found video element', videoElement)
  setUpTestView()
})

function setUpTestView () {
  if (showTest) {
    document.body.appendChild(testPlayer)
  }
}

// function doSaving() {
//   const videoLength = mainSource.duration
//   console.debug('video length', videoLength)
//   // console.debug('segment count', mainBuffer.videoTracks.length)
//   mainBuffer.addEventListener('update', (s, e) => {
//     console.debug('doSaving buffer update', s, e)
//     // getNextGap()
//   })
//   // getNextGap()
// }

let totalCacheSize = 0

/**
 *
 * @param {SourceBuffer} buffer
 * @param {Uint8Array} data
 */
function consumeBuffer(buffer, data) {
  // We already have this buffer in storage?
  /**
   * @type {BufferStorageItem}
   */
  let cache = bufferStorage.get(buffer)
  if (!cache) {
    cache = {
      bufferId: buffer._braveBufferId,
      buffers: [],
      mimeType: buffer._braveSourceBufferType
    }
    bufferStorage.set(buffer, cache)
  }
  const bufferCacheItem = {
    data
  }
  // TODO: save data
  // TODO: it would still be useful to know which portion of the video corresponds to
  console.log('consumeBuffer', totalCacheSize += data.length)
  cache.buffers.push(bufferCacheItem)
}

function seekToNextRangeOrComplete() {
  const firstGapInTime = getNextGapInCache()
  if (firstGapInTime === -1) {
    console.log('seekToNextRangeOrComplete COMPLETE')
    onComplete()
  } else {
    console.log('seekToNextRangeOrComplete seeking to ' + firstGapInTime)
    if (!mainVideoElement){
      mainVideoElement = document.querySelector('video')
    }
    if (mainVideoElement)
      mainVideoElement.currentTime = firstGapInTime
  }
}

const seekToNextRangeOrCompleteDebounced = debounce(seekToNextRangeOrComplete, 1000)

// function getNextGap() {
//   let lastEnd = 0
//   const segmentCount = mainBuffer.videoTracks.length
//   console.debug(`getNextGap: segment count ${segmentCount}, ${mainBuffer.buffered.length}`)
//   // TODO: check gaps in what we've cached, not the sourcebuffer, since it will call remove
//   for (let i = 0; i < segmentCount; i++) {
//     const start = mainBuffer.buffered.start(i)
//     console.debug(`getNextGap: checking ${i}: ${lastEnd} - ${start}`)
//     if (start !== lastEnd) {
//       console.debug('getNextGap: have gap between ' + lastEnd + ' and ' + start + '. Seeking...')
//       mainVideoElement.currentTime = lastEnd
//       return
//     }
//     lastEnd = mainBuffer.buffered.end(i)
//   }
//   if (lastEnd === mainSource.duration) {
//     onComplete()
//   } else {
//     console.debug(`getNextGap: seeking to ${lastEnd}`)
//     mainVideoElement.currentTime = lastEnd
//   }
// }

function onComplete() {
  console.debug('video completed!')
}

})()