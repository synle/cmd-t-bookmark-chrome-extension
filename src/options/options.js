(function() {
  async function _init() {
    const mySettings = await window.CommonUtil.getSettings();
    _onAfterInit(mySettings);
  }

  function _onAfterInit(mySettings) {
    // set up the select / form inputs
    const openBehaviorSelectEl = document.querySelector("#openBehaviorSelect");
    openBehaviorSelectEl.innerHTML = generateSelectOption(
      [
        ["false", "Replace Current Tab with Selected Link"],
        ["true", "Open Selected Link in new Tab"]
      ],
      mySettings.openLinkInNewTab
    );

    const checkboxShowTreeLabelsEl = document.querySelector(
      "#checkboxShowTreeLabels"
    );
    checkboxShowTreeLabels.checked = mySettings.showTreeLabels;

    const themeSelectEl = document.querySelector("#themeSelect");
    themeSelectEl.innerHTML = generateSelectOption(
      [
        ["dark-theme", "Dark Theme"],
        ["bright-theme", "Bright Theme"]
      ],
      mySettings.theme
    );

    const checkboxShowUniqueOnlyEl = document.querySelector(
      "#checkboxShowUniqueOnly"
    );
    checkboxShowUniqueOnly.checked = mySettings.showUniqueOnly;

    const checkboxShowResultFromHistEl = document.querySelector(
      "#checkboxShowResultFromHist"
    );
    checkboxShowResultFromHist.checked = mySettings.showResultFromHistory;

    // set up the on submit handler
    // set up the form hook...
    const settingForm = document.forms[0];
    settingForm.onsubmit = () => {
      const newValue = {
        openLinkInNewTab: openBehaviorSelectEl.value === "true",
        showTreeLabels: checkboxShowTreeLabels.checked,
        theme: themeSelectEl.value,
        showUniqueOnly: checkboxShowUniqueOnlyEl.checked,
        showResultFromHistory: checkboxShowResultFromHistEl.checked
      };

      window.CommonUtil.saveSettings(newValue).then(() => {
        formStatus.innerHTML = `<i>Settings Saved Successfully</i>`;
      });

      return false;
    };
  }

  function generateSelectOption(allOptions, selectedValue) {
    return allOptions
      .reduce((acc, [optionValue, optionLabel]) => {
        if (selectedValue === optionValue) {
          return acc.concat(
            `<option value="${optionValue}" selected>${optionLabel}</option>`
          );
        } else {
          return acc.concat(
            `<option value="${optionValue}">${optionLabel}</option>`
          );
        }
      }, [])
      .join("");
  }

  // init bootstrap
  _init();
})();
