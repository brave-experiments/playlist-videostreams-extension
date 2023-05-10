import { Base64 } from 'js-base64'
import * as React from 'react'
import styles from './popup.module.css'

type Item = { id: string, name: string}

async function getList (): Promise<Item[]> {
  return await chrome.runtime.sendMessage({
    type: 'getAllItems'
  }) as Item[]
}

export default function List(props: {}) {
  const [items, setItems] = React.useState<Item[]>([])
  const [itemId, setItemId] = React.useState<string>()

  React.useEffect(() => {
    getList().then(backgroundItems => setItems(backgroundItems))
  }, [])

  const mediaSource = React.useRef<MediaSource>(new MediaSource())
  const mediaSourceUrl = React.useMemo(() => {
    return URL.createObjectURL(mediaSource.current)
  }, [mediaSource])

  React.useEffect(() => {
    // Reconstruct MediaSource
    if (!itemId) {
      return
    }
    mediaSource.current.addEventListener('sourceopen', async () => {
      console.log('source open')
      const buffer = mediaSource.current.addSourceBuffer('video/mp4; codecs="av01.0.05M.08"')
      let nextIndex: number | undefined = 0
      while (nextIndex !== undefined) {
        const data = await chrome.runtime.sendMessage({
          type: 'getDataForItem',
          itemId,
          startIndex: nextIndex
        }) as {
          nextIndex: number | undefined,
          value: {
            data: string
          }
        }
        if (buffer.updating) {
          await new Promise(resolve => {
            buffer.addEventListener('update', () => {
              console.log('buffer update event')
              resolve
            })
          })
        }
        nextIndex = data.nextIndex
        buffer.appendBuffer(Base64.toUint8Array(data.value.data))
      }

    })

  }, [itemId])

  if (itemId) {
    return (
      <video
        className={styles.player}
        controls
        src={mediaSourceUrl}
      />
    )
  }

  if (!items?.length) {
    return (<h2>There are no items!</h2>)
  }
  return (<>
    {items.map(item => (
      <div onClick={() => setItemId(item.id)} className={styles.listItem}>{item.name}</div>
    ))}
  </>)
}
