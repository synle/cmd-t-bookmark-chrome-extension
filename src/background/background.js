// init
(async function() {
  let flattened_bookmarks;
  let root_bookmarks = [];

  async function reloadData() {
    console.log("reloadData", Date.now());
    const all_bookmarks = await getBookmarkTree();
    flattened_bookmarks = transformFlattenAllBookmarks(all_bookmarks);
    root_bookmarks = transformFlattenBookmarksBarOnly(flattened_bookmarks);
  }

  // debounce this guyh
  const reloadDataAndUpdateTabs = _debounce(function reloadDataAndUpdateTabs() {
    reloadData().then(updateAllNewTabPages);
  }, 200);

  function _debounce(cb, timeOut) {
    let timer;

    return function() {
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        cb();
      }, timeOut);
    };
  }

  // reload itself every minute
  setInterval(reloadDataAndUpdateTabs, 1000 * 60 * 10);

  // set up channel to listen from background
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    const senderTabId = sender.tab.id;

    switch (request.message) {
      case "GET_BOOKMARKS_BY_KEYWORD":
        if (request.forceReload === true) {
          // hard reload should trigger update all new pages...
          reloadData();
        } else {
          // this is not a hard reload
          // we should just update the sender with data
          updateNewPageWithMatchingData(senderTabId);
        }
        break;

      case "GET_INITIAL_BOOKMARKS":
        // this is not a hard reload
        // we should just update the sender with data
        updateNewPageWithInitialData(senderTabId);
        break;

      case "DELETE_BOOKMARK":
        deleteBookmark(request.to_delete_bookmark_id);
        break;

      case "UPDATE_BOOKMARK":
        updateBookmark(request.to_update_bookmark);
        break;
    }
  });

  // trigger update children when things change...
  chrome.bookmarks.onChanged.addListener(reloadDataAndUpdateTabs);
  chrome.bookmarks.onRemoved.addListener(reloadDataAndUpdateTabs);
  chrome.bookmarks.onCreated.addListener(reloadDataAndUpdateTabs);

  function updateAllNewTabPages() {
    // get all the new tab pages
    chrome.tabs.query({}, function(tabs) {
      const tabIds = tabs
        .filter(t => t.url === "chrome://newtab/")
        .map(t => t.id);

      // update all the child pages with new data...
      updateNewPageWithMatchingData(tabIds);
    });
  }
  window.updateAllNewTabPages = updateAllNewTabPages;

  function updateNewPageWithMatchingData(tabIds) {
    tabIds = [].concat(tabIds);

    console.log("updateNewPageWithMatchingData", tabIds);

    // update all the child pages with new data...
    tabIds.forEach(tabId => {
      // console.log('updateNewPageWithMatchingData > tab', tabId)
      chrome.tabs.sendMessage(
        tabId,
        {
          response: flattened_bookmarks,
          message: "RESP_GET_BOOKMARKS_BY_KEYWORD"
        },
        response => {}
      );
    });
  }

  function updateNewPageWithInitialData(tabIds) {
    tabIds = [].concat(tabIds);

    console.log("updateNewPageWithInitialData", tabIds);

    // update all the child pages with new data...
    tabIds.forEach(tabId => {
      // console.log('updateNewPageWithInitialData > tab', tabId)
      chrome.tabs.sendMessage(
        tabId,
        { response: root_bookmarks, message: "RESP_GET_INITIAL_BOOKMARKS" },
        response => {}
      );
    });
  }

  /**
   * @return {Tree} get the list of bookmark trees from Chrome...
   */
  async function getBookmarkTree() {
    return new Promise(resolve => {
      chrome.bookmarks.getTree(function(nodes) {
        resolve(nodes);
      });
    });
  }

  /**
   * @param  {[type]} nodes         [description]
   * @param  {[type]} mapNodesByUrl [description]
   * @param  {[type]} mapNodesById  [description]
   * @return {Array} flatten the list of bookmark tree nodes, and add ancestor
   */
  function transformFlattenAllBookmarks(nodes) {
    const mapNodesById = {};
    const queue = [].concat(nodes);
    const results = [];

    while (queue.length > 0) {
      const currentNodeList = [].concat(queue.shift());
      currentNodeList
        .filter(node => node && !!node.id)
        .forEach(node => {
          let { id, parentId, url } = node;

          // store it first
          mapNodesById[id] = node;
          node.ancestorIds = [];
          node.ancestorLabels = [];

          // traverse up and get all the name prefix
          while (parentId !== undefined && parentId !== 0) {
            const parentNode = mapNodesById[parentId];

            node.ancestorIds.unshift(parentNode.id);
            node.ancestorLabels.unshift(parentNode.title);

            parentId = mapNodesById[parentId].parentId;
          }

          // do breadcrumb
          if (node.ancestorLabels.length > 0) {
            node.breadcrumb = node.ancestorLabels.filter(n => !!n).join(" > ");
          }

          // this flag is used to populate the default flag...
          node.isDefaultBookmark = _isDefaultBookmark(node);

          // if there are children, then add them to the queue
          if (node.children && node.children.length > 0) {
            queue.push(node.children);
          }

          // append node
          results.push(node);
        });
    }

    return _normalizeBookmarks(results);
  }

  function transformFlattenBookmarksBarOnly(flatten_nodes) {
    const bookmark_only_results = flatten_nodes
      .filter(function(node) {
        // only take care of default bookmark of this desired depth level
        return node.ancestorIds.length <= 3 && node.isDefaultBookmark;
      })
      .sort(function(a, b) {
        if (a.breadcrumb > b.breadcrumb) {
          return 1;
        } else if (a.breadcrumb < b.breadcrumb) {
          return -1;
        }
        return 0;
      });
    return bookmark_only_results;
  }

  function _normalizeBookmarks(results) {
    return results
      .filter(({ url }) => !!url && url.indexOf(`script:(`) !== 0) // ignore book-marklet and no url nodes
      .map(bookmark_object => {
        bookmark_object.clean_url = (bookmark_object.url || "")
          .replace("https://", "")
          .replace("http://", "")
          .replace("www.", "");

        bookmark_object.result_type = "RESULT_BOOKMARK";

        return bookmark_object;
      })
      .sort((a, b) => {
        // sort by clean url, then by title
        if (a.clean_url < b.clean_url) {
          return -1;
        } else if (a.clean_url > b.clean_url) {
          return 1;
        } else if (a.title < b.title) {
          return -1;
        } else if (a.title > b.title) {
          return 1;
        }
        return 0;
      });
  }

  function _isDefaultBookmark(node) {
    const KEYWORD_BOOKMARKS_BARS = ["Bookmarks Bar"];

    return node.ancestorLabels.some(function(labelPart) {
      return KEYWORD_BOOKMARKS_BARS.indexOf(labelPart) >= 0;
    });
  }

  async function deleteBookmark(to_delete_bookmark_id) {
    console.time("Delete Bookmark: " + to_delete_bookmark_id);
    return new Promise(resolve => {
      chrome.bookmarks.remove(to_delete_bookmark_id, () => {
        console.timeEnd("Delete Bookmark: " + to_delete_bookmark_id);
        resolve();
      });
    });
  }

  async function updateBookmark(to_update_bookmark) {
    console.time("Update Bookmark: " + to_update_bookmark.id);
    return new Promise(resolve => {
      chrome.bookmarks.update(
        to_update_bookmark.id,
        {
          title: to_update_bookmark.title
        },
        () => {
          console.timeEnd("Update Bookmark: " + to_update_bookmark.id);
          resolve();
        }
      );
    });
  }

  // init app
  console.time("App ready");
  reloadDataAndUpdateTabs();
  console.timeEnd("App ready");
})();
