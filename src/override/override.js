// init
(
  async function(){
    let flattened_bookmarks;

    console.time('app ready');
    flattened_bookmarks = await transformBookmark();
    console.timeEnd('app ready');

    let current_keyword = '';


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

        switch(key){
          case 'Delete':
            const bookmark_id = currentFocusedElem.dataset.bookmark_id;
            if(bookmark_id && confirm('Do you want to delete this bookmark?')){
              // trigger the api to delete it from chrome
              await deleteBookmark(bookmark_id);

              // remove the node
              flattened_bookmarks = flattened_bookmarks.filter(({id}) => {
                return id !== bookmark_id;
              });

              // refresh the ui
              onUpdateBookmark(current_keyword, async () => {
                // move on to the first node
                const firstElem = document.querySelector(`.match a`);
                firstElem && firstElem.focus();

                // trigger the call to do full reload here
                // force reload
                transformBookmark(true);
              });
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            const isUp = key === 'ArrowUp';
            const isDown = key === 'ArrowDown';

            if(isUp || isDown){
              if(!currentFocusedElem){
                // focus on the first match
                currentFocusedElem = matches ? matches[0] : null;
              } else {
                const delta = isUp ? -1 : 1;
                let newTabIndex = currentFocusedElem.tabIndex + delta;

                // boundary
                newTabIndex = Math.min(matches.length + 1, newTabIndex);
                newTabIndex = Math.max(1, newTabIndex);

                // set the focus
                currentFocusedElem = matches[newTabIndex - 1];
              }


              // focus on it
              currentFocusedElem && currentFocusedElem.focus();

              // stop the scrolling
              e.preventDefault();
            }
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
            <a href="${url}" tabindex="${idx + 1}" data-bookmark_id="${id}" class="match-label">${highlightedTitle}</a>
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

    async function deleteBookmark(to_delete_bookmark_id){
      return new Promise( resolve => {
        chrome.bookmarks.remove(to_delete_bookmark_id, () => {
          console.debug('done - delete', to_delete_bookmark_id);
          resolve();
        })
      });
    }


    function transformBookmark(forceReload = false){
      return new Promise(resolve => {
        chrome.runtime.sendMessage({message: "GET_BOOKMARKS", forceReload}, function(response) {
          resolve(response);
        });
      });
    }
  }
)()
