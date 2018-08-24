async function onUpdateBookmark(keyword) {
    console.log('keyword:', keyword)
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


// init
(
    async function(){
        const all_bookmarks = await getTree();

        document.querySelector('#txt-search').addEventListener(
            'input',
            (e) => onUpdateBookmark(e.target.value.trim())
        )
    }
)()
