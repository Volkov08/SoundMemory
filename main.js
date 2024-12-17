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

        filesLoaded();
    } catch (error) {
        console.error(error);
    }
}

const cardsArea = document.getElementById("cardsArea");
const gameArea = document.getElementById("gameArea");
const audioContext = new AudioContext();
audioContext.suspend();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

const endTurnButton = document.getElementById("endTurn");
endTurnButton.onclick = () => {
    if ((cardA != null && cardB != null) || allFound()) endTurn();
    //only end when two cards were uncovered
};
const lowerBar = document.getElementById("lowerBar");
const startButton = document.getElementById("startNewGame");

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
var turnAmount = 0;

var gameSettings = {
    cards: 12, //even, at most fileNames.length * 2
    players: 2,
    duration: 5,
    volume: 1,
    maxPlays: 0,
};

//
//
// ---------------------
//  settings logic
// ---------------------
//
//

const sliderUpdate = (s) => {
    s.style.setProperty("--sliderValue", (s.value - s.min) / (s.max - s.min));
};

var newGameSettings = { ...gameSettings };

const validDuration = [0.5, 1, 3, 5];

const openSettingsButton = document.getElementById("openSettings");
const closeSettingsButton = document.getElementById("closeSettings");
const settingsScreen = document.getElementById("settings");

openSettingsButton.disabled = true;
closeSettingsButton.disabled = true;

const closeSettings = () => {
    settingsScreen.classList.add("hidden");
};
const openSettings = () => {
    settingsScreen.classList.remove("hidden");
};

openSettingsButton.onclick = openSettings;
closeSettingsButton.onclick = closeSettings;
startButton.onclick = startGame;

const volumeSlider = document.getElementById("volume");
const setSinglePlayerBut = document.getElementById("setSingleplayer");
const setSoundDurationBut = document.getElementById("setSoundDuration");
const setMaxPlaysBut = document.getElementById("setMaxPlays");
const setPairsSlider = document.getElementById("setPairs");

volumeSlider.oninput = function () {
    sliderUpdate(this);
    gameSettings.volume = this.value / 100;
    gainNode.gain.value = gameSettings.volume;
};

setPairsSlider.oninput = function () {
    sliderUpdate(this);
    newGameSettings.cards = this.value * 2;
    document.getElementById("setPairsValue").innerText = this.value;
};

const setSinglePlayerButText = () => {
    setSinglePlayerBut.innerText =
        newGameSettings.players == 1 ? "Singleplayer" : "Multiplayer";
};
setSinglePlayerBut.onclick = function () {
    if (newGameSettings.players == 1) newGameSettings.players = 2;
    else newGameSettings.players = 1;
    setSinglePlayerButText();
};
const setSoundDurationButText = () => {
    setSoundDurationBut.innerText = `${newGameSettings.duration}s`;
};
setSoundDurationBut.onclick = function () {
    newGameSettings.duration =
        validDuration[
            (validDuration.indexOf(newGameSettings.duration) + 1) %
                validDuration.length
        ];
    setSoundDurationButText();
};
const setMaxPlaysButText = () => {
    if (newGameSettings.maxPlays == 0) setMaxPlaysBut.innerText = "Unlimited";
    else setMaxPlaysBut.innerText = `${newGameSettings.maxPlays}`;
};
setMaxPlaysBut.onclick = function () {
    newGameSettings.maxPlays = (newGameSettings.maxPlays + 1) % 4;
    setMaxPlaysButText();
};

setMaxPlaysButText();
setSoundDurationButText();
setSinglePlayerButText();
setPairsSlider.value = gameSettings.cards / 2;

volumeSlider.oninput();
setPairsSlider.oninput();

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
    turnAmount = 0;

    lowerBar.classList.remove("turn2");
    lowerBar.classList.add("turn1");

    document.body.classList.toggle("singleplayer", gameSettings.players == 1);

    cardsArea.innerHTML = "";

    gameFinishedScreen.classList.add("hidden");
};

function filesLoaded() {
    console.log("files loaded");

    gameSettings.cards = Math.min(gameSettings.cards, fileNames.length * 2);
    setPairsSlider.max = fileNames.length;
    setPairsSlider.oninput();
}

function startGame() {
    gameSettings = { ...newGameSettings };
    audioCollection.forEach((audio) => {
        audio.pause();
    });
    resetVars();
    writeScore();

    closeSettings();

    openSettingsButton.disabled = false;
    closeSettingsButton.disabled = false;
    closeSettingsButton.style.display = "block";
    lowerBar.style.display = "flex";

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
        cardsArea.appendChild(card);

        audioLookup.push(i % (gameSettings.cards / 2));
    }

    //shuffle cards
    for (let i = 0; i < gameSettings.cards; i++) {
        let j = randInt(gameSettings.cards - i) + i;
        let temp = audioLookup[i];
        audioLookup[i] = audioLookup[j];
        audioLookup[j] = temp;
    }

    endTurnButton.disabled = true;
    blockInput = false;
    /* Debug Hints
    cards.forEach((card, i) => {
        card.innerText =
            "abcdefghijklmnopqrstuvwxyz+-.*#/&ß%йцукенгшщзхфывапролджэячсмитьбю"[
                audioLookup[i]
            ];
    });
    */
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

    if (allFound()) {
        finishGame();
        return;
    }
    if (gameSettings.players == 2) {
        turn++;
        turn %= 2;
        lowerBar.classList.toggle("turn1");
        lowerBar.classList.toggle("turn2");
    }
    turnAmount++;
    writeScore();

    console.log(
        `Turn finished, current player:${turn}, score: ${scores[0]}|${scores[1]}`
    );
}

function writeScore() {
    document.getElementById("p1Score").style.flexGrow = scores[0];
    document.getElementById("scoreSpacer").style.flexGrow =
        gameSettings.cards / 2 - scores[0] - scores[1];
    document.getElementById("p2Score").style.flexGrow = scores[1];

    document.getElementById("p1ScoreValue").innerText = scores[0];
    document.getElementById("p2ScoreValue").innerText = scores[1];
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

    writeScore();

    if (allFound()) {
        endTurnButton.disabled = false;
        endTurnOnStop = true;
    }
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
//  game end
// ---------------------
//
//
const allFound = () => {
    return scores[0] + scores[1] == gameSettings.cards / 2;
};

const gameFinishedScreen = document.getElementById("gameFinished");

function finishGame() {
    lowerBar.classList.remove("turn1");
    lowerBar.classList.remove("turn2");

    gameFinishedScreen.classList.remove("hidden");
}

//
//
// ---------------------
//  card utilities
// ---------------------
//
//

function pauseAll() {
    pauseTimeouts.forEach((k, i) => {
        if (k != null) {
            pauseCard(i, true);
            clearTimeout(k);
        }
    });
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
    } else if (
        !gameSettings.maxPlays ||
        playedInTurn[i] < gameSettings.maxPlays
    ) {
        playedInTurn[i]++;
    } else {
        return false;
    }
    if (gameSettings.maxPlays)
        card.innerText = `${playedInTurn[i]}/${gameSettings.maxPlays}`;
    else card.innerText = "!";

    console.log("selected:", cardA, cardB);
    if (cardA != null && cardB != null) {
        if (audioLookup[cardA] == audioLookup[cardB]) matchFound();
        else {
            endTurnButton.disabled = false;
            if (
                gameSettings.maxPlays &&
                Math.min(playedInTurn[cardA], playedInTurn[cardB]) ==
                    gameSettings.maxPlays
            ) {
                endTurnOnStop = true;
            }
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
    }, 20);
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
    let compStyle = getComputedStyle(cardsArea);

    let gAHeight =
        getComputedStyle(gameArea).getPropertyValue("--max-height") *
        window.innerHeight;
    let gAWidth = gameArea.clientWidth;

    paddig = parseInt(compStyle.padding);
    margin = parseInt(compStyle.getPropertyValue("--card-margin"));

    availWidth = gAWidth - 2 * paddig;
    availHeight = gAHeight - 2 * paddig;

    let ratio = availHeight / availWidth;
    let { x, y } = closestIntegerRatio(ratio, gameSettings.cards);
    let size = Math.floor(
        Math.min(availWidth / x, availHeight / y) - 2 * margin
    );
    console.log(ratio, availWidth / x, availHeight / y, margin);

    console.log(`aligning cards to ${x}x${y} grid, size: ${size}`);

    if (y > x) cardsArea.style.justifyContent = "center";
    else cardsArea.style.justifyContent = "left";
    cardsArea.style.setProperty("--card-size", `${size}px`);
}

const closestIntegerRatio = (r, n) => {
    let a = 1;
    let b = r;
    let flip = false;
    if (r > 1) {
        r = 1 / r;
        flip = true;
    }
    while (a * b < n) {
        a++;
        b = Math.floor(a * r);
        console.log(a, b);
    }
    if (flip) return { x: b, y: a };
    return { x: a, y: b };
};

const randInt = (n) => Math.floor(Math.random() * n);

//
//
// ---------------------
//  colors
// ---------------------
//
//

const HSL = (h, s, l) => {
    return `hsl(${h}, ${s}%, ${l}%)`;
};

const rerollColors = () => {
    let h = randInt(360);
    document.documentElement.style.setProperty("--acc-color1", HSL(h, 50, 60));
    document.documentElement.style.setProperty(
        "--acc-color2",
        HSL((h + 120) % 360, 50, 60)
    );
};
document.getElementById("colorReroll").onclick = rerollColors;

//
//
// ---------------------
//  start game
// ---------------------
//
//

window.onresize = alignCards;
loadFileNames();

//document.body.classList.add("singleplayer");
