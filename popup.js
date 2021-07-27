// Copyright 2021 Moonsik Park All rights reserved.

const options = ['intro', 'multi', 'speed', 'seek'];
const defaultValue = { "speed": "1.0", "seek": "10" };

chrome.storage.sync.get("settings", result => {
  options.forEach(op => {
    const elem = document.getElementById(op);
    if (typeof result.settings[op] === "boolean") {
      elem.checked = result.settings[op];
    } else {
      elem.value = result.settings[op];
    }
    elem.dispatchEvent(new Event("change"));
  });
});

const changeSettingsValue = (key, value) => {
  chrome.storage.sync.get("settings", result => {
    result.settings[key] = value;
    chrome.storage.sync.set(result);
  });
}

const resetValue = e => {
  const target = e.target.getAttribute('data-target');
  if (target !== "lastplayed") {
    const elem = document.getElementById(target);
    elem.value = defaultValue[target];
    elem.dispatchEvent(new Event("change"));
  } else {
    chrome.storage.sync.set({ savedTime: {} });
  }
}

const sendApplyChangeMessage = (target, value) => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { method: "applyChange", data: { target: target, value: value } });
  });
}

Array.from(document.getElementsByClassName("reset")).forEach(el => {
  el.addEventListener("click", resetValue);
});

document.getElementById('intro').addEventListener("change", e => {
  changeSettingsValue("intro", e.target.checked);
});

document.getElementById('multi').addEventListener("change", e => {
  changeSettingsValue("multi", e.target.checked);
});

document.getElementById('lastplayed').addEventListener("change", e => {
  changeSettingsValue("lastplayed", e.target.checked);
});

document.getElementById('speed').addEventListener("change", e => {
  document.getElementById('speedValue').innerText = e.target.value;
  changeSettingsValue("speed", e.target.value);
  sendApplyChangeMessage('speed', e.target.value);
});

document.getElementById('seek').addEventListener("change", e => {
  document.getElementById('seekValue').innerText = e.target.value;
  changeSettingsValue("seek", e.target.value);
  sendApplyChangeMessage('seek', e.target.value);
});

const downloadFile = e => {
  const a = window.document.createElement('a');
  a.href = e.target.getAttribute("data-url");
  a.download = e.target.innerText;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  chrome.tabs.sendMessage(tabs[0].id, { method: "getMediaUrl" }, value => {
    const btn = document.createElement("button");
    btn.setAttribute("data-url", value.mediaUrl);
    btn.addEventListener("click", downloadFile);
    btn.innerText = value.title.substr(0, 15) + "...";
    document.getElementById("download").appendChild(btn);
  });
});
