async function onUpdateBookmark(keyword) {
    console.log('keyword:', keyword)
}


async function getTree(){
    return new Promise(resolve => {
        chrome.bookmarks.getTree(resolve)
    })
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
