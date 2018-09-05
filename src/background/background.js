// init
(
    async function(){
        let all_bookmarks, flattened_bookmarks;
        reloadData();

        async function reloadData(){
            console.time('app ready');
            console.time('get bookmarks');
            all_bookmarks = await getBookmarkTree();
            console.timeEnd('get bookmarks');

            console.time('flatten bookmarks');
            flattened_bookmarks = transformBookmark(all_bookmarks);
            console.timeEnd('flatten bookmarks');
            console.timeEnd('app ready');
        }


        // reload itself every minute
        setInterval(
            reloadData,
            60000
        )

        chrome.runtime.onMessage.addListener(
            async function(request, sender, sendResponse) {
                switch(request.message){
                    case 'GET_BOOKMARKS':
                    default:
                        if(request.forceReload === true){
                            await reloadData();
                        }
                        sendResponse(flattened_bookmarks);
                        break;
                }
            }
        );

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
