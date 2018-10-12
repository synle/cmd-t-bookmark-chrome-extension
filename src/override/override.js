// init
(
  async function(){
  let flattened_bookmarks = [], deferredLoaded = new Deferred();
  let current_keyword = '', current_matches = [];
  const mySettings = await window.CommonUtil.getSettings();

  console.time('app ready');

  // listen to background page to update myself...
  // chrome.runtime.onMessage.addListener
  chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    if(sender.tab){
      // ignore background request sent from tab, only accept background
      return;
    }
    console.debug('Total bookmarks in message:', request && request.length);
    flattened_bookmarks = request || [];
    deferredLoaded.resolve();
    sendResponse('Child Tab Received')
  })

  sendGetBookmarkRequestToBackgroundPage();
  await deferredLoaded.promise;
  console.timeEnd('app ready');


  // hook up the search
  const txtSearchElem = document.querySelector('#txt-search');
  txtSearchElem.value = '';
  txtSearchElem.addEventListener(
    'input',
    (e) => onUpdateBookmark(e.target.value.trim())
  )

  // navigate results by keyboard
  document.addEventListener('keydown',
    async (e) => {
      let bookmark_id;
      const {key, ctrlKey} = e;
      if(ctrlKey === true){
        return;
      }

      let domMatches = [...document.querySelectorAll(`.match a`)];
      if(domMatches.length === 0){
        return;
      }

      let currentFocusedElem = document.querySelector(':focus');
      let newIdxToFocus = domMatches.findIndex(match => match === currentFocusedElem);

      // get the parent match row
      const matchResultElem = _getClosestItem(currentFocusedElem, 'match');

      switch(key){
        case 'r': // rename
          // make sure we have selected something
          bookmark_id = currentFocusedElem.dataset.bookmark_id;
          if(bookmark_id){
            const foundTargetMatch = current_matches.find(targetBookmark => targetBookmark.id === bookmark_id);

            if(foundTargetMatch){
            const newBookmarkName = (prompt(
              `New name for: \n${foundTargetMatch.url}`,
              foundTargetMatch.title
            ) || '').trim();

            if(newBookmarkName.length > 0){
              foundTargetMatch.title = newBookmarkName;
              sendUpdateBookmark(foundTargetMatch);

              // update the dom itself...
              matchResultElem.innerHTML = _getBookmarkDom(foundTargetMatch);

              // refocus on the dom...
              matchResultElem.querySelector('a').focus();
            }
            }
          }
          break;
        case 'Delete':
          bookmark_id = currentFocusedElem.dataset.bookmark_id;
          if(bookmark_id && confirm('Do you want to delete this bookmark?')){
            // remove the node
            matchResultElem.remove();

            // trigger the api to delete it from chrome
            sendDeleteBookmark(bookmark_id);

            // focus on the previous element
            newIdxToFocus--;
            newIdxToFocus = Math.max(0, newIdxToFocus);
            [...document.querySelectorAll(`.match a`)][newIdxToFocus].focus();


            // remove the removed
            current_matches = current_matches.filter(targetBookmark => targetBookmark.id !== bookmark_id);
          }
          break;

        case 'ArrowUp':
        case 'ArrowDown':
          // navigate with keyboard
          newIdxToFocus = getFocusIndexForNavigation(
            newIdxToFocus,
            key === 'ArrowDown' ? 1 : -1,
            domMatches.length
          );
          domMatches[newIdxToFocus].focus();
          e.preventDefault();
          break;
      }
    }
  )

  // click to open bookmark
  document.addEventListener('click', function(e){
    const target = _getClosestItem(e.target, 'match');

    if(target){
      const href = (target.querySelector('a') || parentTarget.querySelector('a')).href;

      // set the loading screen...
      document.querySelector('#app').innerHTML = `<h1 class="p3 text-center">Loading...</h1>`;

      // depends on settings, open new tab or redirect
      if(mySettings.openLinkInNewTab === true){
        window.open(href, '_blank');
      } else {
        location.href = href;
      }


      e.preventDefault();
    }
  })

  // clean up
  const onUpdateBookmark = (function(){
    // debounce
    let timer;

    return function(keyword, cb){
    current_keyword = keyword;

    // clear previous debounced
    timer && clearTimeout(timer);
    timer = setTimeout(
      function(){
      current_matches = searchBookmarks(current_keyword, flattened_bookmarks);

      populateBookmarks(current_keyword, current_matches);
      cb && cb();
      },
      500
    )
    }
  })()


  function populateBookmarks(keyword, matches){
    let dom = '';
    if(keyword.length === 0){
      dom = '';
    } else if( keyword === '?'){
      dom = `<div class="result-row p0">
          <div class="pb2">Use the following shortcut key to perform operation on selected bookmarks</div>
          <div class="pt1 pl1"><strong>r</strong> to rename a bookmark</div>
          <div class="pt1 pl1"><strong>DELETE</strong> to delete a bookmark</div>
        </div>`;
    }
    else if(keyword.length <= 2){
      dom = `<div class="result-row p0">Enter more than 2 characters to search</div>`;
    }
    else if(matches.length === 0){
      dom = `
        <div class="result-row no-match p0">
          <span>No Matches.</span>
          <a href="https://google.com/search?q=${keyword}" class="match-label fallback-match">Try Searching on Google</a>
        </div>
      `;
    } else {
      dom = matches.reduce(
        (acc, current_bookmark) => acc + `<div class="result-row match p0">${_getBookmarkDom(current_bookmark)}</div>`,
        ''
      )
    }

    document.querySelector('#bookmarks-container')
    .innerHTML = dom;
  }

  function _getBookmarkDom({id, url, title, breadcrumb, clean_url}, keyword = current_keyword){
    keyword = keyword || current_keyword;

    const highlightedTitle = getHighlightedTitle(title, keyword);
    const highlightedUrl = getHighlightedUrl(clean_url, keyword);

    let treeLabels = '';
    if(mySettings.showTreeLabels === true){
      treeLabels = `<span class="match-breadcrumb pr1">${breadcrumb}</span>`;
    }

    return `
      ${treeLabels}
      <span class="match-url">${highlightedUrl}</span>
      <a href="${url}" data-bookmark_id="${id}" class="match-label">${highlightedTitle}</a>
    `;
  }

  function getHighlightedString(title, keyword){
    return title.replace(new RegExp(keyword, 'gi'), function(matchedKeyword){
    return `<span class="highlight">${matchedKeyword}</span>`;
    });
  }


  function getHighlightedTitle(title, keyword){
    return getHighlightedString(title, keyword);
  }


  function getHighlightedUrl(title, keyword){
    return getHighlightedString(title, keyword);
  }

  function searchBookmarks(keyword, flattened_bookmarks){
    if(keyword.length < 2){
    return [];
    }

    return flattened_bookmarks.filter(
    bookmark => fuzzyMatchBookmark(bookmark, keyword)
    )
  }

  function fuzzyMatchBookmark({title, url}, keyword){
    return title.toLowerCase().indexOf(keyword) >= 0
    || url.toLowerCase().indexOf(keyword) >= 0;
  }


  /**
   * @return {Tree} get the list of bookmark trees from Chrome...
   */
  async function getBookmarkTree(){
    return new Promise(resolve => {
    chrome.bookmarks.getTree(resolve)
    })
  }

  function getFocusIndexForNavigation(newIdxToFocus, delta, matchesMaxLength){
    newIdxToFocus += delta;
    newIdxToFocus = Math.max(0, newIdxToFocus);
    newIdxToFocus = Math.min(newIdxToFocus, matchesMaxLength - 1);
    return newIdxToFocus;
  }


  function sendGetBookmarkRequestToBackgroundPage(forceReload = false){
    _sendMessageToBackground({message: "GET_BOOKMARKS", forceReload}, function(response) {});
  }

  function sendDeleteBookmark(to_delete_bookmark_id = -1){
    _sendMessageToBackground({message: "DELETE_BOOKMARK", to_delete_bookmark_id}, function(response) {});
  }

  function sendUpdateBookmark(to_update_bookmark){
    _sendMessageToBackground({message: "UPDATE_BOOKMARK", to_update_bookmark}, function(response) {});
  }


  function _sendMessageToBackground(message, cb){
    setTimeout(
      () => chrome.runtime.sendMessage(message, cb),
      200
    )
  }

  function _getClosestItem(target, cssClassToMatch){
    while(target){
    if(target.classList.contains(cssClassToMatch)){
      return target;
    }
    target = target.parentElement;
    }

    return null;
  }
})()
