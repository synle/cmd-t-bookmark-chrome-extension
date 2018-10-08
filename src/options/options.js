(function(){
  async function _init(){
    const mySettings = await window.CommonUtil.getSettings();
    _onAfterInit(mySettings);
  }

  function _onAfterInit(mySettings){
    // set up the select / form inputs
    const openBehaviorOptions = [
      [false, 'Replace Current Tab with Selected Link'],
      [true, 'Open Selected Link in new Tab'],
    ].reduce((acc, [optionValue, optionLabel]) => {
      if(mySettings.openLinkInNewTab === optionValue){
        return acc.concat(`<option value="${optionValue}" selected>${optionLabel}</option>`)
      } else {
        return acc.concat(`<option value="${optionValue}">${optionLabel}</option>`)
      }
    }, []).join('');

    const openBehaviorSelectEl = document.querySelector('#openBehaviorSelect');
    openBehaviorSelectEl.innerHTML = openBehaviorOptions;


    // set up the on submit handler
    // set up the form hook...
    const settingForm = document.forms[0];
    settingForm.onsubmit = () => {
      const newValue = {
        openLinkInNewTab: openBehaviorSelectEl.value === 'true',
      };

      window.CommonUtil.saveSettings(newValue)
        .then(() => {
          formStatus.innerHTML = `<i>Settings Saved Successfully</i>`;
        })

      return false;
    }
  }

  // init bootstrap
  _init();
})();
