import * as React from 'react'
import { createRoot } from 'react-dom/client';
import styles from './popup.module.css'
import List from './list'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('#root not found!')
}

const root = createRoot(rootElement)
root.render(<>
  <h2>Playlist Items</h2>
  <List></List>
</>)

console.log('hello')
// document.addEventListener('DOMContentLoaded', () => {
//   const h1 = document.createElement('h1')
//   h1.innerText = 'hello!!!!!!'
//   h1.classList.add(styles.title)
//   document.body.appendChild(h1)
// })
