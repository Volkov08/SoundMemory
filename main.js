const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
var fileNames = null;

async function loadFileNames() {
    indexFile = "sounds/index.json";
    try {
        const response = await fetch(indexFile);
        if (!response.ok) {
            throw new Error("file load failed");
        }
        const data = await response.json();
        fileNames = data;

        startGame();
    } catch (error) {
        console.error(error);
    }
}

const gameArea = document.getElementById("gameArea");
const audioContext = new AudioContext();
audioContext.suspend();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

const volumeSlider = document.getElementById("volume");
volumeSlider.oninput = function () {
    gameSettings.volume = this.value / 100;
    gainNode.gain.value = gameSettings.volume;
};
const endTurnButton = document.getElementById("endTurn");
endTurnButton.onclick = () => {
    if (cardA != null && cardB != null) endTurn();
    //only end when two cards were uncovered
};

var cards = [];
var audioCollection = [];
var audioLookup = []; //assigns card to audio

//var tracks = [];
var pauseTimeouts = [];
var fadeIntervals = [];
var playedInTurn = [];
var cardA = null,
    cardB = null;
var playing = false;
var endTurnOnStop = false;

var blockInput = true;

var solvedPairs = [];
var scores = [0, 0];
var turn = 0;

var gameSettings = {
    cards: 16, //even, at most fileNames.length * 2
    players: 2,
    duration: 5,
    volume: 1,
    maxPlays: 3,
};

//
//
// ---------------------
// setup
// ---------------------
//
//

resetVars = () => {
    cards = [];
    audioCollection = [];
    audioLookup = []; //assigns card to audio

    //tracks = [];
    pauseTimeouts = [];
    fadeIntervals = [];
    playedInTurn = [];
    cardA = null;
    cardB = null;
    playing = false;
    endTurnOnStop = false;

    blockInput = true;

    solvedPairs = [];
    scores = [0, 0];
    turn = 0;
};

function startGame() {
    gameSettings.cards = Math.min(gameSettings.cards, fileNames.length * 2);
    alignCards();

    //shuffle fileNames (Fisher-Yates)
    for (let i = 0; i < fileNames.length; i++) {
        let j = randInt(fileNames.length);
        let temp = fileNames[i];
        fileNames[i] = fileNames[j];
        fileNames[j] = temp;
    }

    console.log(fileNames);

    for (let i = 0; i < gameSettings.cards / 2; i++) {
        let audio = new Audio(`sounds/${fileNames[i]}`);
        let track = audioContext.createMediaElementSource(audio);
        track.connect(gainNode);
        audioCollection.push(audio);
        //tracks.push(track);
    }
    for (let i = 0; i < gameSettings.cards; i++) {
        let card = createCard(i);

        cards.push(card);
        gameArea.appendChild(card);

        audioLookup.push(i % (gameSettings.cards / 2));
    }

    //shuffle cards
    for (let i = 0; i < gameSettings.cards; i++) {
        let j = randInt(gameSettings.cards - i) + i;
        let temp = audioLookup[i];
        audioLookup[i] = audioLookup[j];
        audioLookup[j] = temp;
    }

    volumeSlider.oninput();
    endTurnButton.disabled = true;
    blockInput = false;

    cards.forEach((card, i) => {
        card.innerText = "abcdefghijklmnopqrstuvwxyz"[audioLookup[i]];
    });
}

function createCard(i) {
    let card = document.createElement("button");
    card.classList.add("card");
    card.onclick = function () {
        clickHandler(i);
    };
    card.innerText = "?";
    return card;
}

//
//
// ---------------------
//  game logic
// ---------------------
//
//

function endTurn() {
    pauseAll();
    endTurnOnStop = false;

    cards.forEach((card, i) => {
        card.classList.remove("uncovered");
        if (!solvedPairs[i]) card.innerText = "?";
    });
    playedInTurn = [];
    cardA = null;
    cardB = null;
    endTurnButton.disabled = true;
    turn++;
    turn %= gameSettings.players;

    console.log(
        `Turn finished, current player:${turn}, score: ${scores[0]}|${scores[1]}`
    );
}

function matchFound() {
    cards[cardA].classList.add("found");
    cards[cardB].classList.add("found");

    scores[turn]++;
    totalScore = scores[0] + scores[1];
    cards[cardA].innerText = totalScore;
    cards[cardB].innerText = totalScore;

    solvedPairs[cardA] = true;
    solvedPairs[cardB] = true;

    playedInTurn = [];
    cardA = null;
    cardB = null;
    endTurnButton.disabled = true;

    document.getElementById("p1Score").style.flexGrow = scores[0];
    document.getElementById("scoreSpacer").style.flexGrow =
        gameSettings.cards / 2 - scores[0] - scores[1];
    document.getElementById("p2Score").style.flexGrow = scores[1];

    //endTurnOnStop = true;
}

function clickHandler(i) {
    if (blockInput) return false;

    if (audioContext.state === "suspended") audioContext.resume();

    let j = audioLookup[i];

    if (!audioCollection[j].HAVE_ENOUGH_DATA) return false;

    if (pauseTimeouts[i] != null) return false;

    if (!uncoverCard(i)) return false;

    playCard(i);

    pauseTimeouts[i] = setTimeout(() => {
        pauseCard(i);
    }, gameSettings.duration * 1000);
    return true;
}

//
//
// ---------------------
//  card utilities
// ---------------------
//
//

function pauseAll() {
    console.log(pauseTimeouts);
    pauseTimeouts.forEach((k, i) => {
        if (k != null) {
            clearTimeout(k);
            pauseCard(i, true);
            console.log(i);
        }
    });
    console.log(pauseTimeouts);
}

function uncoverCard(i) {
    let card = cards[i];

    if (solvedPairs[i]) return false; //dont allow solved pairs to be uncovered again
    //dont allow new cards to be uncovered, but old ones can be played
    if (!playedInTurn[i] && cardA != null && cardB != null) return false;

    if (playedInTurn[i] == undefined) {
        console.log("uncovered", i);

        playedInTurn[i] = 1;
        if (cardA == null) cardA = i;
        else if (cardA != i) cardB = i;

        card.classList.add("uncovered");
    } else if (playedInTurn[i] < gameSettings.maxPlays) {
        playedInTurn[i]++;
    } else {
        return false;
    }
    card.innerText = `${playedInTurn[i]}/${gameSettings.maxPlays}`;
    console.log(cardA, cardB);
    if (cardA != null && cardB != null) {
        if (audioLookup[cardA] == audioLookup[cardB]) matchFound();
        else if (
            Math.min(playedInTurn[cardA], playedInTurn[cardB]) ==
            gameSettings.maxPlays
        ) {
            endTurnOnStop = true;
        } else {
            endTurnButton.disabled = false;
        }
    }
    return true;
}

function playCard(i) {
    pauseAll();

    let card = cards[i];

    let j = audioLookup[i];

    console.log(`playing ${i}, audio ${j}`);

    audioCollection[j].pause();
    audioCollection[j].currentTime = 0; // rewind to start

    stopFade(j);
    audioCollection[j].volume = 1;

    audioCollection[j].play();
    card.classList.add("playing");

    playing = true;
}

function pauseCard(i, force = false) {
    let card = cards[i];

    console.log("stopped", i);

    let j = audioLookup[i];
    pauseTimeouts[i] = null;

    if (isSafari) {
        //fade is janky on safari
        audioCollection[j].pause();
    } else {
        fadeOutAudio(j);
    }
    card.classList.remove("playing");

    playing = false;

    //only end turn if playback finished, not if stopped by starting new playback
    if (endTurnOnStop && !force) endTurn();
}

function fadeOutAudio(j) {
    stopFade(j);
    fadeIntervals[j] = setInterval(() => {
        if (audioCollection[j].volume > 0.1) {
            audioCollection[j].volume -= 0.1;
        } else {
            stopFade(j);
        }
    }, 30);
}
function stopFade(j) {
    clearInterval(fadeIntervals[j]);
    fadeIntervals[j] = null;
}

//
//
// ---------------------
//  alignment logic
// ---------------------
//
//

function alignCards() {
    let gAHeight = gameArea.clientHeight;
    let gAWidth = gameArea.clientWidth;

    let compStyle = getComputedStyle(gameArea);

    paddig = parseInt(compStyle.padding);
    margin = parseInt(compStyle.getPropertyValue("--card-margin"));

    availWidth = gAWidth - 2 * paddig;
    availHeight = gAHeight - 2 * paddig;

    let ratio = availHeight / availWidth;
    let { x, y } = closestIntegerRatio(ratio, gameSettings.cards);
    let size = Math.floor(
        Math.min(availWidth / x, availHeight / y) - 2 * margin
    );

    console.log(`aligning cards to ${x}x${y} grid, size: ${size}`);

    if (y > x) gameArea.style.justifyContent = "center";
    else gameArea.style.justifyContent = "left";
    gameArea.style.setProperty("--card-size", `${size}px`);
}

const closestIntegerRatio = (r, n) => {
    let a = 0;
    let b = 0;
    let flip = false;
    if (r > 1) {
        r = 1 / r;
        flip = true;
    }
    while (a * b < n) {
        a++;
        b = Math.floor(a * r);
    }
    if (flip) return { x: b, y: a };
    return { x: a, y: b };
};

const randInt = (n) => Math.floor(Math.random() * n);

//
//
// ---------------------
//  game settings
// ---------------------
//
//

const settingsScreen = document.getElementById("settings");

const toggleSettings = () => {
    if (settingsScreen.classList.contains("hidden")) {
        settingsScreen.classList.remove("hidden");
    } else {
        settingsScreen.classList.add("hidden");
    }
};

const buttons = document.getElementsByClassName("settingsButton");
for (let button of buttons) {
    button.onclick = toggleSettings;
}
//
//
// ---------------------
//  start game
// ---------------------
//
//

window.onresize = alignCards;
loadFileNames();
