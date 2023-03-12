// open a connection to the database
const request = indexedDB.open("SavedItems", 1);

// handle errors
request.onerror = function(event) {
  console.error("Database error:", event.target.error);
};

// create the object stores
request.onupgradeneeded = function(event) {
  const db = event.target.result;
  const itemsStore = db.createObjectStore("items", { keyPath: "id" });
  const dataStore = db.createObjectStore("data", { keyPath: "id" });
  dataStore.createIndex("itemId", "itemId", { unique: false });
};

// add a new item to the "items" object store
function addItem(id, name) {
  const db = request.result;
  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");
  store.add({ id, name });
  tx.oncomplete = function() {
    console.log("Item added to the database");
  };
  tx.onerror = function(event) {
    console.error("Transaction error:", event.target.error);
  };
}

// add a new data entry to the "data" object store
async function addData(id, itemId, index, blobUrl) {
  return new Promise(async (resolve) => {
    const blobResponse = await fetch(blobUrl)
    const buffer = await blobResponse.arrayBuffer()
    const data = new Uint8Array(buffer)
    const db = request.result;
    const tx = db.transaction("data", "readwrite");
    const store = tx.objectStore("data");
    store.add({ id, itemId, index, data });
    tx.oncomplete = function() {
      console.log("Data added to the database");
      resolve()
    };
    tx.onerror = function(event) {
      console.error("Transaction error:", event.target.error);
      resolve()
    };
  })
}

// retrieve all items from the "items" object store
function getAllItems(callback) {
  const db = request.result;
  const tx = db.transaction("items", "readonly");
  const store = tx.objectStore("items");
  const getRequest = store.getAll();
  getRequest.onsuccess = function(event) {
    const items = getRequest.result;
    callback(items);
  };
  tx.onerror = function(event) {
    console.error("Transaction error:", tx.error);
  };
}

// retrieve all data entries for a given item id from the "data" object store
function getDataForItem(itemId, startIndex = 0, callback) {
  const db = request.result;
  const tx = db.transaction("data", "readonly");
  const store = tx.objectStore("data");
  const index = store.index("itemId");
  const cursorRequest = index.openCursor(IDBKeyRange.only(itemId))

  let i = 0;
  let hasProcessedStartIndex = false
  let value = undefined

  cursorRequest.onsuccess = function(event) {
    const cursor = cursorRequest.result
    if (!hasProcessedStartIndex) {
      hasProcessedStartIndex = true
      if (!cursor) {
        // data, nextIndex
        callback({value: undefined, nextIndex: undefined})
        return
      }
      if (i < startIndex) {
        // Must be first item, but we want a later item, so advance
        const advanceTo = startIndex - i
        i = startIndex
        cursor.advance(advanceTo)
        return
      }
    }
    // either data or next item was not found
    if (!cursor) {
      callback({value, nextIndex: undefined})
      return
    }
    // If we've already defined data, we're at the next item,
    // so we can give that index
    if (value) {
      callback({value, nextIndex: i})
      return
    }
    // We should be at the data item we want to get
    const dataRaw = cursor.value.data
    const data = new Uint8Array(dataRaw)
    value = {
      ...cursor.value,
      data
    }
    // Find if has next
    i++
    cursor.continue()
    return
  };
  tx.onerror = function(event) {
    console.error("Transaction error:", event.target.error);
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('got message', message)
  switch (message.type) {
    case "addItem":
      addItem(message.id, message.name);
      sendResponse()
      break
    case "addData":
      addData(message.id, message.itemId, message.index, message.blobUrl).then(() => sendResponse())
      return true
    case "getAllItems":
      getAllItems(items => {
        sendResponse(items);
      });
      return true; // need to return true to indicate asynchronous response
    case "getDataForItem":
      getDataForItem(message.itemId, message.startIndex, (data, nextIndex) => {
        sendResponse(data);
      });
      return true; // need to return true to indicate asynchronous response
    default:
      console.warn("Unknown message type:", message.type);
  }
});