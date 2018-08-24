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
                let currentFocusedElem = document.querySelector(':focus');
                const isTextBoxFocus = currentFocusedElem.id === 'txt-search';
                const isUp = key === 'ArrowUp';
                const isDown = key === 'ArrowDown';

                if(matches.length === 0){
                    return;
                }

                if(isUp || isDown){
                    if(isTextBoxFocus){
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
                    if(breadcrumb){
                        dom += `<div class="match">
                            <span>${idx}. </span>
                            <strong>[${breadcrumb}]</strong>
                            <a href="${url}" tabindex="${idx + 1}">${highlightedTitle}</a>
                        </div>`;
                    }
                    else {
                        dom += `<div class="match">
                            <span>${idx}. </span>
                            <a href="${url}" tabindex="${idx + 1}">${highlightedTitle}</a>
                        </div>`;
                    }
                })
            }

            document.querySelector('#bookmarks-container')
                .innerHTML = dom;
        }

        function getHighlightedTitle(title, keyword){
            return title.replace(new RegExp(keyword, 'gi'), function(matchedKeyword){
                return `<span class="highlight">${matchedKeyword}</span>`;
            });
        }

        function searchBookmarks(keyword, flattened_bookmarks){
            if(keyword.length < 2){
                return [];
            }

            return flattened_bookmarks.filter(
                bookmark => fuzzyMatchBookmark(bookmark, keyword)
            )
        }

        function fuzzyMatchBookmark({id, title, url}, keyword){
            return title.toLowerCase().indexOf(keyword) >= 0;
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

            return Object.values(mapNodesByUrl).sort((a,b) => {
                return a.breadcrumb > b.breadcrumb;
            });
        }
    }
)()
