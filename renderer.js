const ipc = require('electron').ipcRenderer;

const FPS = 30;
const DURATION = 1000;

ipc.on('next', (event, message) => {
    try {
        next(message.image);
    }
    catch (exc) {
        console.log('Handling exception', exc);
    }
})

let images = [
    { element: document.getElementById("image11"), partner: document.getElementById("image12"), level: 90 },
    { element: document.getElementById("image21"), partner: document.getElementById("image22"), level: 80 },
    { element: document.getElementById("image31"), partner: document.getElementById("image32"), level: 70 },
    { element: document.getElementById("image41"), partner: document.getElementById("image42"), level: 60 },
    { element: document.getElementById("image12"), partner: document.getElementById("image11"), level: 90 },
    { element: document.getElementById("image22"), partner: document.getElementById("image21"), level: 80 },
    { element: document.getElementById("image32"), partner: document.getElementById("image31"), level: 70 },
    { element: document.getElementById("image42"), partner: document.getElementById("image41"), level: 60 }
]

let currentIndex = -1;

function next(image) {

    currentIndex = (++currentIndex) % 8;

    let { element, partner, level } = images[currentIndex];

    //console.log("Current index, element, partner, and level", currentIndex, element, partner, level);

    element.poster = image;
    element.src = image;
    fade(element, partner, level);
}

let fadeStart;

function fade(element1, element2, level) {
    fadeStart = new Date().getTime();
    
    //console.log("Fading");

    element1.style.zIndex = level;
    element2.style.zIndex = level-1;

    _fade(element1, element2);
}


function _fade(element1, element2) {

    if (element1.style.opacity >= 1) {
        //console.log("Fade done");
        element1.style.opacity = 1;
        element2.style.opacity = 0;
        element2.pause();
        return;
    }

    let time = new Date().getTime();
    let actualDuration = time - fadeStart;
    if (actualDuration != 0) {
        let pctDuration = (time - fadeStart) / DURATION;
        //console.log("Opacity on " + element1.id, pctDuration);
        element1.style.opacity = pctDuration;
    }

    setTimeout(() => { _fade(element1, element2) }, 1000 / FPS);
}
