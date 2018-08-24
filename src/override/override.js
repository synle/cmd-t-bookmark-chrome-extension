// init
(
    async function(){
        const all_bookmarks = await getTree();

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

                        const matches = searchBookmarks(keyword, all_bookmarks);
                    },
                    1000
                )
            }
        })()


        function populateBookmarks(matches){
            var dom;

            document.querySelector('#bookmarks-container')
                .innerHTML = dom;
        }

        function searchBookmarks(keyword, all_bookmarks){
            all_bookmarks.filter(
                bookmark => fuzzyMatchBookmark(bookmark)
            )
        }

        function fuzzyMatchBookmark(bookmark){
            // TODO: cheat here with mod 119 (prime number)
            return bookmark.id % 997 === 0;
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
