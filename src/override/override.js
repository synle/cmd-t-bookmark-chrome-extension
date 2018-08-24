// init
(
    async function(){
        const all_bookmarks = await getTree();
        const flattened_bookmarks = transformBookmark(all_bookmarks);

        // hook up the search
        document.querySelector('#txt-search').addEventListener(
            'input',
            (e) => onUpdateBookmark(e.target.value.trim())
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
                        populateBookmarks(matches);
                    },
                    500
                )
            }
        })()


        function populateBookmarks(matches){
            let dom = '';
            if(matches.length < 3){
                dom = '<div class="no-match">No Matches</div>';
            } else {
                matches.forEach(({url, title, breadcrumb}, idx) => {
                    if(breadcrumb){
                        dom += `<div class="match">
                            <span>${idx}. </span>
                            <strong>[${breadcrumb}]</strong>
                            <a href="${url}">${title}</a>
                        </div>`;
                    }
                    else {
                        dom += `<div class="match">
                            <span>${idx}. </span>
                            <a href="${url}">${title}</a>
                        </div>`;
                    }
                })
            }

            document.querySelector('#bookmarks-container')
                .innerHTML = dom;
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


        async function getTree(){
            return new Promise(resolve => {
                chrome.bookmarks.getTree(resolve)
            })
        }

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

                            if(parentId === 0){
                                break;
                            }
                        }

                        if(node.ancestorLabels.length > 0){
                            node.breadcrumb = node.ancestorLabels.join(' > ');
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
