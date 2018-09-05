// init
(
    async function(){
        const all_bookmarks = await getBookmarkTree();
        let flattened_bookmarks = transformBookmark(all_bookmarks);
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
                            onUpdateBookmark(current_keyword, () => {
                                // move on to the first node
                                const firstElem = document.querySelector(`.match a`);
                                firstElem && firstElem.focus();
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

        document.addEventListener('click', function(e){
            const target = e.target;
            if(target.classList.contains('match')){
                const href = target.querySelector('a').href;
                window.open(href, '_blank');
                e.preventDefault();
            }
        }, true)

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
                .filter(({url}) => url.indexOf(`script:(`) !== 0)
                .map(bookmark_object => {
                    bookmark_object.clean_url = (bookmark_object.url || '').replace('https://', '')
                        .replace('http://', '')
                        .replace('www.', '');

                    return bookmark_object;
                })
                .sort((a, b) => {
                    if(a.clean_url < b.clean_url){
                        return -1;
                    } else if (a.clean_url > b.clean_url){
                        return 1;
                    } else if(a.title < b.title){
                        return -1;
                    } else if (a.title > b.title){
                        return 1;
                    }
                    return 0;
                })
        }
    }
)()
