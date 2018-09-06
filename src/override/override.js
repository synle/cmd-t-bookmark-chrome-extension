// init
(
  async function(){
    let flattened_bookmarks = [], deferredLoaded = new Deferred();
    let current_keyword = '';

    console.time('app ready');

    // listen to background page to update myself...
    // chrome.runtime.onMessage.addListener
    chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
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
        const {key} = e;
        let matches = [...document.querySelectorAll(`.match a`)];
        if(matches.length === 0){
          return;
        }

        let currentFocusedElem = document.querySelector(':focus');
        let newIdxToFocus = matches.findIndex(match => match === currentFocusedElem);
        if(newIdxToFocus < 0){
            newIdxToFocus = 0;
        }

        switch(key){
          case 'Delete':
            const bookmark_id = currentFocusedElem.dataset.bookmark_id;
            if(bookmark_id && confirm('Do you want to delete this bookmark?')){
              // remove the node
              currentFocusedElem.parentElement.remove();

              // trigger the api to delete it from chrome
              sendDeleteBookmark(bookmark_id);

              // focus on the previous element
              newIdxToFocus--;
              newIdxToFocus = Math.max(0, newIdxToFocus);
              [...document.querySelectorAll(`.match a`)][newIdxToFocus].focus();
            }
            break;

          case 'ArrowUp':
          case 'ArrowDown':
            // navigate with keyboard
            newIdxToFocus = getFocusIndexForNavigation(
                newIdxToFocus,
                key === 'ArrowDown' ? 1 : -1,
                matches.length
            );
            matches[newIdxToFocus].focus();
            e.preventDefault();
            break;
        }
      }
    )

    // click to open bookmark
    document.addEventListener('click', function(e){
      const target = e.target;
      const parentTarget = target.parentElement || target;

      if(target.classList.contains('match') || parentTarget.classList.contains('match')){
        const href = (target.querySelector('a') || parentTarget.querySelector('a')).href;
        window.open(href, '_blank');
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
            const matches = searchBookmarks(current_keyword, flattened_bookmarks);
            populateBookmarks(current_keyword, matches);
            cb && cb();
          },
          500
        )
      }
    })()


    function populateBookmarks(keyword, matches){
      let dom = '';
      if(keyword.length <= 2){
        dom = '';// dont do anything for less than 2 chars..
      }
      else if(matches.length === 0){
        dom = '<div class="no-match">No Matches</div>';
      } else {
        matches.forEach(({id, url, title, breadcrumb, clean_url}, idx) => {
          const highlightedTitle = getHighlightedTitle(title, keyword);
          const highlightedUrl = getHighlightedUrl(clean_url, keyword);

          dom += `<div class="match">
            <span class="match-url">${highlightedUrl}</span>
            <a href="${url}" data-bookmark_id="${id}" class="match-label">${highlightedTitle}</a>
          </div>`;
        })
      }

      document.querySelector('#bookmarks-container')
        .innerHTML = dom;
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
      // send the message to the background asking for changes
      _sendMessageToBackground({message: "GET_BOOKMARKS", forceReload}, function(response) {});
    }

    function sendDeleteBookmark(to_delete_bookmark_id = -1){
      // send the message to the background asking for changes
      _sendMessageToBackground({message: "DELETE_BOOKMARK", to_delete_bookmark_id}, function(response) {});
    }


    function _sendMessageToBackground(message, cb){
        setTimeout(
            () => chrome.runtime.sendMessage(message, cb),
            200
        )
    }
})()
