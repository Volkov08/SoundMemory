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

var cards = [];
var audioCollection = [];
var audioLookup = []; //assigns card to audio

//var tracks = [];
var pauseTimeouts = [];
var playedInTurn = [];
var cardA = null,
    cardB = null;
playing = false;
endTurnOnStop = false;

var solvedPairs = [];
var scores = [0, 0];
var turn = 0;

var gameSettings = {
    cards: 40, //even, at most fileNames.length * 2
    players: 1,
    duration: 1,
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

function startGame() {
    gameSettings.cards = Math.min(gameSettings.cards, fileNames.length * 2);
    alignCards();
    console.log(fileNames);

    let selection = Array.from({ length: gameSettings.cards }, (_, i) => i);

    for (let i = 0; i < gameSettings.cards / 2; i++) {
        let audio = new Audio(`sounds/${fileNames[selection[i]]}`);
        let track = audioContext.createMediaElementSource(audio);
        track.connect(gainNode);
        audioCollection.push(audio);
        //tracks.push(track);
    }

    audioLookup = [];
    for (let i = 0; i < gameSettings.cards; i++) {
        let card = createCard(i);

        cards.push(card);
        gameArea.appendChild(card);

        audioLookup.push(i % (gameSettings.cards / 2));
    }

    //Fisher-Yates shuffle
    for (let i = 0; i < gameSettings.cards; i++) {
        let j = randInt(gameSettings.cards - i) + i;
        let temp = audioLookup[i];
        audioLookup[i] = audioLookup[j];
        audioLookup[j] = temp;
    }

    document.getElementById("endTurn").onclick = () => {
        if (cardA != null && cardB != null) endTurn();
        //only end when two cards were uncovered
    };

    volumeSlider.oninput();
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

    cards.forEach((card) => {
        card.classList.remove("uncovered");
        card.innerText = "?";
    });
    playedInTurn = [];
    cardA = null;
    cardB = null;
    turn++;
    turn %= gameSettings.players;

    console.log(
        `Turn finished, current player:${turn}, score: ${scores[0]}|${scores[1]}`
    );
}

function matchFound() {
    cards[cardA].classList.add("found");
    cards[cardB].classList.add("found");

    solvedPairs[cardA] = true;
    solvedPairs[cardB] = true;

    scores[turn]++;
    endTurnOnStop = true;
}

function clickHandler(i) {
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
        }
    }
    return true;
}

function playCard(i) {
    pauseAll();

    let card = cards[i];

    let j = audioLookup[i];

    console.log(`playing ${i}, audio ${j}`);

    audioCollection[j].play();
    card.classList.add("playing");

    playing = true;
}

function pauseCard(i, force = false) {
    let card = cards[i];

    console.log("stopped", i);

    let j = audioLookup[i];
    audioCollection[j].pause();
    audioCollection[j].currentTime = 0; // rewind to start
    pauseTimeouts[i] = null;
    card.classList.remove("playing");

    playing = false;

    //only end turn if playback finished, not if stopped by starting new playback
    if (endTurnOnStop && !force) endTurn();
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
//  start game
// ---------------------
//
//

window.onresize = alignCards;
loadFileNames();
