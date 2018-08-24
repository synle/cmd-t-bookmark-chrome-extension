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
                        console.log('keyword: ', keyword);

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
                matches.forEach(({url, title}) => {
                    dom += `<div class="match"><a href="${url}">${title}</a></div>`;
                })
            }

            document.querySelector('#bookmarks-container')
                .innerHTML = dom;
        }

        function searchBookmarks(keyword, flattened_bookmarks){
            if(keyword.length === 0){
                return [];
            }

            return flattened_bookmarks.filter(
                bookmark => fuzzyMatchBookmark(bookmark, keyword)
            )
        }

        function fuzzyMatchBookmark({id, title, url}, keyword){
            return title.indexOf(keyword) >= 0;
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
                        }

                        transformBookmark(node.children, mapNodesByUrl, mapNodesById);
                    }
                })

            return Object.values(mapNodesByUrl);
        }
    }
)()
