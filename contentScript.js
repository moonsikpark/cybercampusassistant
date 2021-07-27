// Copyright 2021 Moonsik Park All rights reserved.

/*
TODO: contentScript can access chrome.storage API by itself.
Replace message communication and use chrome.storage API.
*/
const readSettings = () => {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ method: "readSettings" }, response => {
            resolve(response);
        })
    })
}

// TODO: extract and encapsulate repeated DOM manipulating logic.

if (document.location.host.startsWith("e-cyber")) {
    // Code runs in the top context.

    // Replace "callback" function of the main page (top) context with 
    // a custom script that ignores isForce argument which closes the 
    // window by force.
    const runningScript = `
    const callback = (isKjkey, isForce) => {
        if(isKjkey && !isForce) {
                document.location.href="/ilos/st/course/online_list_form.acl?WEEK_NO=1";
        }
    }
    `;
    readSettings().then(settings => {
        if (settings.multi) {
            const script = document.createElement('script');
            script.textContent = runningScript;
            (document.head || document.documentElement).appendChild(script);
            // Does not remove the element because the script has to be persistent in the top context.
        }
    })

    
} else if (document.location.host.startsWith("cms")) {
    // Code runs in iframe of "cms.catholic.ac.kr" context. Context is limited to the player only. 

    /*
    HACK: Because content scripts of Chrome extensions can't access any of the
    parent's variables, we have no option but to run the script by creating
    a corresponding script element.

    If inter-context communication between the parent (whether it's an iframe or the top)
    is required, we can achieve this by creating a "pipe" element,
    assign an attribute from the parent, and retrieving it from
    the content script using the available DOM API.

    This hack will not be able to survive the manifest v3 because the upgraded manifest
    will enforce CORS on all scripts that extension injects.

    Refer: https://developer.chrome.com/docs/extensions/mv3/intro/
    */
    const runningScript = (settings, savedTime) => `
    const settings = ${settings};
    const savedTime = ${savedTime};
    
    const playerLoaded = () => {
        return new Promise(resolve => {
            let interval = setInterval(() => {
                if (typeof uniPlayerConfig._contentPlayingInfoData.storyList === typeof undefined ||
                    typeof uniPlayer === typeof undefined) {
                    return;
                }
                clearInterval(interval);
                resolve();
            }, 50)
        })
    }
    
    const removeIntro = setting => {
        if (setting) {
            if (uniPlayerConfig._contentPlayingInfoData.storyList[0].storyId === "intro-story") {
                uniPlayerConfig._contentPlayingInfoData.storyList.splice(0, 1);
                uniPlayerConfig._contentPlayingInfoData.currStoryPlayingInfo = uniPlayerConfig._contentPlayingInfoData.storyList[0];
            }
        }
    }
    
    const changeSeek = setting => {
        VCPlayControllerMedia.MOVING_TIME = parseFloat(setting);
    }
    
    const changeSpeed = setting => {
        uniPlayer.setPlaybackRate(parseFloat(setting));
        if (!(typeof contentPlayer === typeof undefined)) {
            contentPlayer.changePlaybackRate(parseFloat(setting));
        }
    }
    
    const playStarted = () => {
        return new Promise(resolve => {
            let interval = setInterval(() => {
                if (uniPlayerConfig.getMediaChannelConfig() === null) {
                    return;
                }
                clearInterval(interval);
                resolve();
            }, 500)
        })
    }

    const changeToSavedTime = mediaId => {
        if (typeof savedTime === "object" && mediaId in savedTime) {
            const timeToChange = savedTime[mediaId];
            bcPlayController.getPlayController().changeCurrTimeManually(timeToChange, VCPlayControllerEvent.SEEK_END);
        }
    }


    playerLoaded().then(() => {
        removeIntro(settings.intro);
        changeSeek(settings.seek);
        changeSpeed(settings.speed);
    })

    if (settings.lastplayed) {
        playStarted().then(() => {
            changeToSavedTime(uniPlayerConfig._contentPlayingInfoData.contentId)
        })
    }
    `;

    readSettings().then(settings => {
        console.log(settings);
        const script = document.createElement('script');
        script.textContent = runningScript(JSON.stringify(settings.settings), JSON.stringify(settings.savedTime));
        (document.head || document.documentElement).appendChild(script);
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // To apply change requested by the user live, 
        // we inject the script that triggers the function to the iframe context.
        if (request.method == "applyChange") {
            let scriptContent;
            switch (request.data.target) {
                case "speed":
                    scriptContent = `changeSpeed(${request.data.value});`;
                    break;
                case "seek":
                    scriptContent = `changeSeek(${request.data.value});`;
                    break;
                default:
                    return;
            }
            const script = document.createElement('script');
            script.textContent = scriptContent;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        }
    });

    readSettings().then(settings => {
        if (settings.settings.lastplayed) {
            /*
            To retrieve the user's current play time, we should
            1. be sure that the user is indeed playing the lecture (playStarted promise).
            2. get the play time by injecting a script and store it somewhere on the document.
            3. get values with DOM API from content script context.

            Because it's hard to access chrome.storage API from the iframe context,
            we set a function that runs every 3 seconds that checks the time.
            */
            setInterval(() => {
                const div = document.createElement('div');
                div.setAttribute("id", "gateway");
                (document.head || document.documentElement).appendChild(div);
    
                const script = document.createElement('script');
                script.textContent = `
                var id = uniPlayerConfig._contentPlayingInfoData.contentId;
                document.getElementById("gateway").setAttribute("data-id", id);
                var endTime = uniPlayerConfig._contentPlayingInfoData.contentDuration;
                var time = bcPlayController._vcPlayController._currTime;
                if (parseFloat(endTime) - parseFloat(time) < 10) {
                    time = 0;
                }
                document.getElementById("gateway").setAttribute("data-time", time);
                `;
                (document.head || document.documentElement).appendChild(script);
                const mediaId = document.getElementById("gateway").getAttribute("data-id");
                const time = document.getElementById("gateway").getAttribute("data-time");
                if (mediaId !== null && time !== null) {
                    chrome.runtime.sendMessage({ 
                        method: "saveTime",
                        data: {
                            "id" : mediaId,
                            "time" :  time
                        }
                    });
                }
                // Check all stale elements are removed because this is a peroidic function.
                div.remove();
                script.remove();
            }, 3000);
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.method == "getMediaUrl") {
            // TODO: Check whether this function works before player initialization
            // is done or before the user plays the lecture.
            const div = document.createElement('div');
            div.setAttribute("id", "gateway");
            (document.head || document.documentElement).appendChild(div);
            const script = document.createElement('script');
            script.textContent = `
            const mediaUrl = uniPlayerConfig._contentPlayingInfoData.storyList[0].currentMainMedia.desktopMediaUri;
            document.getElementById("gateway").setAttribute("data-mediaurl", mediaUrl);
            const title = uniPlayerConfig._contentMetadata.authorName + " - " + uniPlayerConfig._contentMetadata.title;
            document.getElementById("gateway").setAttribute("data-title", title);
            `;
            (document.head || document.documentElement).appendChild(script);

            const mediaUrl = document.getElementById("gateway").getAttribute("data-mediaurl");
            const title = document.getElementById("gateway").getAttribute("data-title");
            sendResponse({ mediaUrl: mediaUrl, title: title });
            div.remove();
            script.remove();
        }
    });
}
