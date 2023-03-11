/* This runs after a web page loads */

// TODO: attach a class instance of the below functionality to every video instance, and then just save them all or choose
// the longest one.

(function (){
console.log('2loading')

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

/** @type {HTMLVideoElement[]} */
const allVideoElements = []

const mediaSourceObjectUrlLookup = new WeakMap()

window.allBuffers = []

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

const oldCreateObjectUrl = URL.createObjectURL
URL.createObjectURL = function (obj) {
  const url = oldCreateObjectUrl(obj)
  console.log('create object url', obj, url)
  mediaSourceObjectUrlLookup.set(obj, url)
  return url
}

function getNextGapInCache () {
  const duration = Math.ceil(mainSource.duration)
  let timeCacheStatus = Array(duration).fill(false)
  for (const sourceBuffer of testMediaSource.sourceBuffers) {
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
    console.log('aNewMediaSoffurces', this._braveSourceId, this)
    this.sourceBuffers.addEventListener('addsourcebuffer', (p, e) => {
      console.log('add source buffer', this._braveSourceId, p, e)
    })
    this.sourceBuffers.addEventListener('removesourcebuffer', (p, e) => {
      console.log('remove source buffer', this._braveSourceId, p, e)
    })
    this.activeSourceBuffers.addEventListener('addsourcebuffer', (p, e) => {
      console.log('active add source buffer', this._braveSourceId, p, e)
    })
    this.activeSourceBuffers.addEventListener('removesourcebuffer', (p, e) => {
      console.log('active remove source buffer', this._braveSourceId, p, e)
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
    console.log('direct add source buffer', this._braveSourceId, buffer._braveBufferId, this, type, buffer)
    window.allBuffers.push(buffer)
    // mirror media source so we can see what data we have
    // window.setTimeout(() => {
      console.log('adding test buffer')
      const testBuffer = testMediaSource.addSourceBuffer(type)
      console.log('added test buffer', testBuffer)
      testBuffer._braveBufferId = buffer._braveBufferId
      testBuffer._braveTest = true
    // }, 1)

    return buffer
  }

}

class PlaylistSourceBuffer extends SourceBuffer {
  constructor(...args) {
    super(...args)
    console.log('ctor source buffer', ...args)
  }
  abort() {
    console.log('abort sourcebuffer')
    super.abort()
  }
  changeType(type) {
    console.log('change type', this, type)
    super.changeType(type)
  }
  appendWindowStart(...args) {
    console.log('append window start', ...args)
    return super.appendWindowStart(...args)
  }
  appendWindowEnd(...args) {
    console.log('append window End', ...args)
    return super.appendWindowEnd(...args)
  }
  onUpdateComplete() {
    console.log('on update complete')
    this.onUpdateEnd()
    if (!this._pendingData) {
      console.error('append buffer no data!')
    }
    consumeBuffer(this, this._pendingData)
    if (this._braveSourceBufferType.includes('video')) {
      setTimeout(() => {
        seekToNextRangeOrCompleteDebounced()
      }, 100)
    }
  }
  onUpdateAbort() {
    console.log('on update abort')
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
    console.log('append buffer', this._braveSourceId, this._braveBufferId, data)
    const testBuffer = Array.from(testMediaSource.sourceBuffers).find(b => b._braveBufferId === this._braveBufferId)
    if (!testBuffer) {
      console.error("testBuffer not found!")
    } else {
      testBuffer.appendBuffer(data.slice(0))
    }
    this._pendingData = data.slice(0)
    super.appendBuffer(data)
    this.addEventListener('abort', this.onUpdateAbort)
    this.addEventListener('update', this.onUpdateComplete)
  }
  remove(...args) {
    console.log('remove buffer', this._braveSourceId, this._braveBufferId, ...args)
    return super.remove(...args)
  }
  appendBufferAsync(...args) {
    console.log('append bufferAsync', this._braveSourceId, this._braveBufferId, ...args)
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
      console.log('found main source and video element')
      // doSaving()
  }
  console.log('found video element', videoElement)
  setUpTestView()
})

function setUpTestView () {
  document.body.appendChild(testPlayer)
}

// function doSaving() {
//   const videoLength = mainSource.duration
//   console.log('video length', videoLength)
//   // console.log('segment count', mainBuffer.videoTracks.length)
//   mainBuffer.addEventListener('update', (s, e) => {
//     console.log('doSaving buffer update', s, e)
//     // getNextGap()
//   })
//   // getNextGap()
// }

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
  console.log('consumeBuffer', buffer.updating, buffer._braveBufferId, bufferCacheItem)
  cache.buffers.push(bufferCacheItem)
}

function seekToNextRangeOrComplete() {
  const firstGapInTime = getNextGapInCache()
  if (firstGapInTime === -1) {
    console.log('seekToNextRangeOrComplete COMPLETE')
    onComplete()
  } else {
    console.log('seekToNextRangeOrComplete seeking to ' + firstGapInTime)
    if (mainVideoElement)
      mainVideoElement.currentTime = firstGapInTime
  }
}

const seekToNextRangeOrCompleteDebounced = debounce(seekToNextRangeOrComplete, 200)

// function getNextGap() {
//   let lastEnd = 0
//   const segmentCount = mainBuffer.videoTracks.length
//   console.log(`getNextGap: segment count ${segmentCount}, ${mainBuffer.buffered.length}`)
//   // TODO: check gaps in what we've cached, not the sourcebuffer, since it will call remove
//   for (let i = 0; i < segmentCount; i++) {
//     const start = mainBuffer.buffered.start(i)
//     console.log(`getNextGap: checking ${i}: ${lastEnd} - ${start}`)
//     if (start !== lastEnd) {
//       console.log('getNextGap: have gap between ' + lastEnd + ' and ' + start + '. Seeking...')
//       mainVideoElement.currentTime = lastEnd
//       return
//     }
//     lastEnd = mainBuffer.buffered.end(i)
//   }
//   if (lastEnd === mainSource.duration) {
//     onComplete()
//   } else {
//     console.log(`getNextGap: seeking to ${lastEnd}`)
//     mainVideoElement.currentTime = lastEnd
//   }
// }

function onComplete() {
  console.log('video completed!')
}

})()