window.addEventListener('message-for-extension', async (e) => {
  console.log('got message content', e.detail, e)
  const response = await chrome.runtime.sendMessage(e.detail)
  if (e.detail.blobUrl) {
    URL.revokeObjectURL(e.detail.blobUrl)
  }
});