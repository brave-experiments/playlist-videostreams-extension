import { Base64 } from 'js-base64'
import * as React from 'react'
import styles from './popup.module.css'

type Item = { id: string, name: string, codec: string }

async function getList (): Promise<Item[]> {
  return await chrome.runtime.sendMessage({
    type: 'getAllItems'
  }) as Item[]
}

export default function List(props: {}) {
  const [items, setItems] = React.useState<Item[]>([])
  const [item, setItem] = React.useState<Item>()
  const videoElementRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    getList().then(backgroundItems => setItems(backgroundItems))
  }, [])

  const mediaSource = React.useRef<MediaSource>(new MediaSource())
  const mediaSourceUrl = React.useMemo(() => {
    return URL.createObjectURL(mediaSource.current)
  }, [mediaSource])

  React.useEffect(() => {
    // Reconstruct MediaSource
    if (!item) {
      return
    }
    mediaSource.current.addEventListener('sourceopen', async () => {
      console.log('source open', item.codec)
      videoElementRef.current?.play()
      const buffer = mediaSource.current.addSourceBuffer(item.codec)
      console.log('buffer', buffer)
      let nextIndex: number | undefined = 0
      while (nextIndex !== undefined) {
        // TODO(petemill): only add data to the buffer when the video seek time
        // requires it, otherwise we quickly get an error on the player
        // (CHUNK_DEMUXER_ERROR_APPEND_FAILED)
        // and I think it's due to adding too much data to the buffer.
        await new Promise(resolve => window.setTimeout(resolve, 1000))
        const data = await chrome.runtime.sendMessage({
          type: 'getDataForItem',
          itemId: item.id,
          startIndex: nextIndex
        }) as {
          nextIndex: number | undefined,
          value: {
            data: string
          }
        }
        console.log('data', data)
        if (buffer.updating) {
          console.log('waiting for buffer...')
          await new Promise(resolve => {
            buffer.addEventListener('update', () => {
              console.log('...buffer update event')
              resolve
            })
          })
        } else {
          console.log('buffer not updating')
        }
        if (videoElementRef.current?.error){
          console.log('could not append video, player had error:', videoElementRef.current.error)
          return
        }
        nextIndex = data.nextIndex
        buffer.appendBuffer(Base64.toUint8Array(data.value.data))
      }

    })

  }, [item])

  if (item) {
    return (
      <video
        className={styles.player}
        controls
        src={mediaSourceUrl}
        ref={videoElementRef}
      />
    )
  }

  if (!items?.length) {
    return (<h2>There are no items!</h2>)
  }
  return (<>
    {items.map(item => (
      <div onClick={() => setItem(item)} className={styles.listItem}>{item.name}</div>
    ))}
  </>)
}
