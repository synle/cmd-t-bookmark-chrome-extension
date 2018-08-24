// init
(
    async function(){
        const all_bookmarks = await getBookmarkTree();
        const flattened_bookmarks = transformBookmark(all_bookmarks);

        // hook up the search
        const txtSearchElem = document.querySelector('#txt-search');
        txtSearchElem.value = '';
        txtSearchElem.addEventListener(
            'input',
            (e) => onUpdateBookmark(e.target.value.trim())
        )

        // navigate results by keyboard
        document.addEventListener('keydown',
            (e) => {
                const {key} = e;
                let matches = [...document.querySelectorAll(`.match a`)];
                if(matches.length === 0){
                    return;
                }

                let currentFocusedElem = document.querySelector(':focus');
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
            }
        )

        // clean up
        const onUpdateBookmark = (function(){
            // debounce
            let timer;

            return function(keyword){
                // clear previous debounced
                timer && clearTimeout(timer);
                timer = setTimeout(
                    function(){
                        const matches = searchBookmarks(keyword, flattened_bookmarks);
                        console.log('matches', matches.length)
                        populateBookmarks(keyword, matches);
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
                matches.forEach(({url, title, breadcrumb}, idx) => {
                    const highlightedTitle = getHighlightedTitle(title, keyword);
                    const highlightedUrl = getHighlightedUrl(url, keyword);

                    dom += `<div class="match">
                        <span class="match-url">${highlightedUrl}</span>
                        <a href="${url}" tabindex="${idx + 1}" class="match-label">${highlightedTitle}</a>
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
            title = title.replace('https://', '')
                        .replace('http://', '')
                        .replace('www.', '')

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


        /**
         * @param  {[type]} nodes         [description]
         * @param  {[type]} mapNodesByUrl [description]
         * @param  {[type]} mapNodesById  [description]
         * @return {Array} flatten the list of bookmark tree nodes, and add ancestor
         */
        function transformBookmark(nodes, mapNodesByUrl, mapNodesById){
            nodes = [].concat(nodes);
            mapNodesByUrl = mapNodesByUrl || {};
            mapNodesById = mapNodesById || {};

            nodes.filter(node => !!node)
                .forEach(node => {
                    let {id, parentId, url} = node;
                    if(id){
                        mapNodesById[id] = node;

                        if(url){
                            mapNodesByUrl[url] = node;
                        }

                        node.ancestorIds = [];
                        node.ancestorLabels = [];

                        // traverse up and get all the name prefix
                        while(parentId !== undefined && parentId !== 0){
                            const parentNode = mapNodesById[parentId];

                            node.ancestorIds.unshift(parentNode.id);
                            node.ancestorLabels.unshift(parentNode.title);

                            parentId = mapNodesById[parentId].parentId;
                        }

                        if(node.ancestorLabels.length > 0){
                            node.breadcrumb = node.ancestorLabels.filter(n => !!n).join(' > ');
                        }


                        transformBookmark(node.children, mapNodesByUrl, mapNodesById);
                    }
                })

            return Object.values(mapNodesByUrl)
                // ignore bookmarklet
                .filter(({url}) => url.indexOf(`script:(`) !== 0);
        }
    }
)()
