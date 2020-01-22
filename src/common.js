window.CommonUtil = (function() {
  const CommonUtil = {
    getSettings: () =>
      new Promise(resolve => {
        chrome.storage.sync.get(
          {
            openLinkInNewTab: false,
            showTreeLabels: false,
            theme: "dark-theme",
            showUniqueOnly: true,
            showResultFromHistory: false
          },
          resolve
        );
      }),
    saveSettings: newValue =>
      new Promise(resolve => {
        chrome.storage.sync.set(newValue, resolve);
      })
  };

  return CommonUtil;
})();

window.searchUrlFromHistory = function(keyword) {
  return new Promise(resolve => {
    chrome.history.search(
      {
        text: keyword,
        maxResults: 6
      },
      function callback(data) {
        const bookmarks_from_history = data.map(b => ({
          id: b.id,
          title: b.title || b.url,
          url: b.url,
          clean_url: b.url,
          result_type: "RESULT_HISTORY",
          breadcrumb: "History"
        }));

        resolve(bookmarks_from_history);
      }
    );
  });
};

// Polyfill
window.Deferred = function Deferred() {
  // update 062115 for typeof
  if (typeof Promise != "undefined" && Promise.defer) {
    //need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
    return Promise.defer();
  } else if (typeof PromiseUtils != "undefined" && PromiseUtils.defer) {
    //need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
    return PromiseUtils.defer();
  } else {
    /* A method to resolve the associated Promise with the value passed.
     * If the promise is already settled it does nothing.
     *
     * @param {anything} value : This value is used to resolve the promise
     * If the value is a Promise then the associated promise assumes the state
     * of Promise passed as value.
     */
    this.resolve = null;

    /* A method to reject the assocaited Promise with the value passed.
     * If the promise is already settled it does nothing.
     *
     * @param {anything} reason: The reason for the rejection of the Promise.
     * Generally its an Error object. If however a Promise is passed, then the Promise
     * itself will be the reason for rejection no matter the state of the Promise.
     */
    this.reject = null;

    /* A newly created Promise object.
     * Initially in pending state.
     */
    this.promise = new Promise(
      function(resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
      }.bind(this)
    );
    Object.freeze(this);
  }
};


window.openModal = function(modalSelector, modalContentHTML){
  const modal = document.querySelector(modalSelector);
  modal.querySelector('.modal-content-main').innerHTML = modalContentHTML;
  modal.style.display = "block";

  modal.querySelector('.close').onclick = () => modal.style.display = 'none';
}

window.closeModal = function(modalSelector){
  var modal = document.querySelector(modalSelector);
  modal.style.display = "none";
  modal.querySelector('.modal-content-main').innerText = '';
}