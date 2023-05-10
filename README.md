This extension is a proof of concept for Brave Playlist. It shows the possibility of intercepting MediaSource and SourceBuffer data, specifically via SourceBuffer.appendBuffer. It achieves this by sending those chunks to a DB and then deserializing and re-constructing the SourceBuffer and MediaSource object on-demand in order to play the video at a later time.

In order to save a video on any Tab to the "playlist", add #brave-save to the Url in the Location Bar.

## Building and using
```
npm install
npm run build
```
Then add the extension to your browser via brave://extensions

## Developing
```
Same as above, but these steps are useful:
- `npm run build -- --watch`
- https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid
