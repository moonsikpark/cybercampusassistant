// Copyright 2021 Moonsik Park All rights reserved.

const defaultValues = { 
  "intro": true,
  "multi": true,
  "lastplayed" : true,
  "speed": "1.0",
  "seek": "10"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ settings: defaultValues, savedTime: {} });
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostEquals: 'e-cyber.catholic.ac.kr' },
      })],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});

/*
TODO: contentScript can access chrome.storage API by itself.
Remove unnecessary inter-process message communication and replace with helper function inside contentScript.
*/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method == "readSettings") {
    chrome.storage.sync.get("settings", settings => {
      chrome.storage.sync.get("savedTime", savedTime => {
        sendResponse({settings : settings.settings, savedTime : savedTime.savedTime});
      });
    });
    return true; // https://bugs.chromium.org/p/chromium/issues/detail?id=343007
  }
});

/*
TODO: contentScript can access chrome.storage API by itself.
Remove unnecessary inter-process message communication and replace with helper function inside contentScript.
*/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method == "saveTime") {
    chrome.storage.sync.get("savedTime", result => {
      result.savedTime[request.data.id] = request.data.time;
      chrome.storage.sync.set(result);
    });
  }
});
