/* ==========================================================================
   1. ESTADO GLOBAL E CONFIGURAÇÕES
   ========================================================================== */
const LEVEL_PRESETS = {
    padrao: { pairs: 4, silhouette: true, confirmation: 'auto', soundLimit: 'unlimited', timer: 'off' },
    intermediario: { pairs: 6, silhouette: true, confirmation: 'manual', soundLimit: '3', timer: 'off' },
    avancado: { pairs: 8, silhouette: false, confirmation: 'manual', soundLimit: '2', timer: '10' }
};

let config = { ...LEVEL_PRESETS.intermediario, confirmation: 'auto', soundLimit: 'unlimited' };

const gameState = {
    cards: [],
    firstCard: null,
    secondCard: null,
    lockBoard: false,
    matchesFound: 0,
    soundCounts: {},
    audioCache: {},
    timerInterval: null,
    currentAudio: null
};

/* ==========================================================================
   2. INICIALIZAÇÃO E NAVEGAÇÃO ENTRE TELAS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupConfigControls();
    setupGameControls();
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
}

function setupNavigation() {
    document.getElementById('btn-start')?.addEventListener('click', startGame);
    document.getElementById('btn-gallery')?.addEventListener('click', openGallery);

    document.getElementById('btn-gallery-back')?.addEventListener('click', () => {
        stopCurrentAudio();
        showScreen('main-menu');
    });

    document.getElementById('btn-guide')?.addEventListener('click', () => {
        document.getElementById('modal-guide')?.classList.add('active');
    });

    document.getElementById('close-guide')?.addEventListener('click', () => {
        document.getElementById('modal-guide')?.classList.remove('active');
    });

    document.getElementById('btn-config')?.addEventListener('click', () => {
        document.getElementById('modal-config')?.classList.add('active');
    });

    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
        const victoryModal = document.getElementById('victory-modal');
        if (victoryModal) victoryModal.style.display = 'none';
        stopCurrentAudio();
        showScreen('main-menu');
    });
}

function setupConfigControls() {
    document.getElementById('save-and-start')?.addEventListener('click', () => {
        updateConfigFromInputs();
        document.getElementById('modal-config')?.classList.remove('active');
        startGame();
    });

    document.getElementById('save-and-exit')?.addEventListener('click', () => {
        updateConfigFromInputs();
        document.getElementById('modal-config')?.classList.remove('active');
    });

    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyLevelPreset(e.target.dataset.level);
        });
    });

    document.querySelectorAll('.config-options select').forEach(select => {
        select.addEventListener('change', () => {
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-level="personalizado"]')?.classList.add('active');
            updateConfigFromInputs();
        });
    });
}

function setupGameControls() {
    document.getElementById('btn-restart-game')?.addEventListener('click', () => {
        confirmAction("Reiniciar partida?", startGame);
    });

    document.getElementById('btn-menu-game')?.addEventListener('click', () => {
        confirmAction("Voltar ao menu principal?", () => {
            cleanupManualActions();
            stopCurrentAudio();
            showScreen('main-menu');
        });
    });
}

function applyLevelPreset(level) {
    if (!LEVEL_PRESETS[level]) return;
    config = { ...LEVEL_PRESETS[level] };
    updateInputsFromConfig();
}

function updateConfigFromInputs() {
    config.pairs = parseInt(document.getElementById('cfg-pairs').value, 10);
    config.silhouette = document.getElementById('cfg-silhouette').value === 'true';
    config.confirmation = document.getElementById('cfg-confirmation').value;
    config.soundLimit = document.getElementById('cfg-sound-limit').value;
    config.timer = document.getElementById('cfg-timer').value;
}

function updateInputsFromConfig() {
    document.getElementById('cfg-pairs').value = config.pairs;
    document.getElementById('cfg-silhouette').value = config.silhouette.toString();
    document.getElementById('cfg-confirmation').value = config.confirmation;
    document.getElementById('cfg-sound-limit').value = config.soundLimit;
    document.getElementById('cfg-timer').value = config.timer;
}

function confirmAction(text, callback) {
    const modal = document.getElementById('modal-confirm');
    document.getElementById('confirm-text').innerText = text;
    modal.classList.add('active');

    document.getElementById('confirm-yes').onclick = () => {
        modal.classList.remove('active');
        callback();
    };
    document.getElementById('confirm-no').onclick = () => {
        modal.classList.remove('active');
    };
}

/* ==========================================================================
   3. CONTROLE DE ÁUDIO
   ========================================================================== */
function preloadAudios() {
    animaisDB.forEach(animal => {
        if (!gameState.audioCache[animal.id]) {
            const audio = new Audio(animal.sound);
            audio.load();
            gameState.audioCache[animal.id] = audio;
        }
    });
}

function stopCurrentAudio() {
    if (gameState.currentAudio) {
        gameState.currentAudio.pause();
        gameState.currentAudio.currentTime = 0;
        gameState.currentAudio = null;
    }
}

function playSound(animalId, isRepeat = false) {
    if (isRepeat && config.soundLimit !== 'unlimited') {
        gameState.soundCounts[animalId] = (gameState.soundCounts[animalId] || 0) + 1;
        if (gameState.soundCounts[animalId] > parseInt(config.soundLimit, 10)) return;
    }

    stopCurrentAudio();

    const audio = gameState.audioCache[animalId];
    if (audio) {
        audio.currentTime = 0;
        audio.play()
            .then(() => { gameState.currentAudio = audio; })
            .catch(() => console.log("Áudio indisponível."));
    }
}

function playSystemSound(soundName) {
    stopCurrentAudio();

    const audio = new Audio(`assets/sounds/${soundName}.mp3`);
    audio.play()
        .then(() => { gameState.currentAudio = audio; })
        .catch(() => console.log(`Áudio do sistema (${soundName}) indisponível.`));
}

/* ==========================================================================
   4. TABULEIRO E MECÂNICA DO JOGO
   ========================================================================== */
function startGame() {
    updateConfigFromInputs();
    cleanupManualActions();
    stopCurrentAudio();
    document.getElementById('modal-config')?.classList.remove('active');
    showScreen('game-screen');

    gameState.matchesFound = 0;
    gameState.soundCounts = {};
    resetTurnState();

    preloadAudios();
    buildBoard();
    updateScoreBoard();
}

function buildBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    document.getElementById('collection-area').innerHTML = '';

    const shuffledAnimals = [...animaisDB]
        .sort(() => 0.5 - Math.random())
        .slice(0, config.pairs);

    const cardPairs = [...shuffledAnimals, ...shuffledAnimals]
        .sort(() => 0.5 - Math.random())
        .map((animal, index) => ({
            uniqueId: index,
            id: animal.id,
            nome: animal.nome,
            img: animal.img
        }));

    gameState.cards = cardPairs;

    cardPairs.forEach(cardData => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.uniqueId = cardData.uniqueId;
        card.dataset.id = cardData.id;
        card.innerHTML = `<img src="${cardData.img}" alt="${cardData.nome}">`;

        card.addEventListener('click', () => handleCardClick(card, cardData));
        board.appendChild(card);
    });
}

function handleCardClick(card, cardData) {
    const isAlreadyOpen = card.classList.contains('flipped') ||
                          card.classList.contains('collected') ||
                          card.classList.contains('selected-second');

    if (isAlreadyOpen) {
        playSound(cardData.id, true);
        return;
    }

    if (gameState.lockBoard) return;

    if (!gameState.firstCard) {
        gameState.firstCard = { card, cardData };
        card.classList.add('flipped');
        playSound(cardData.id, false);
        return;
    }

    if (gameState.firstCard.card === card) {
        playSound(cardData.id, true);
        return;
    }

    gameState.secondCard = { card, cardData };
    gameState.lockBoard = true;
    card.classList.add('selected-second');
    card.classList.add(config.silhouette ? 'show-silhouette' : 'flipped');

    playSound(cardData.id, false);

    if (config.confirmation === 'auto') {
        setTimeout(evaluateMatch, 1500);
    } else {
        showManualConfirmation();
    }
}

/* ==========================================================================
   5. CONFIRMAÇÃO MANUAL, AVALIAÇÃO E PONTUAÇÃO
   ========================================================================== */
function showManualConfirmation() {
    const actionBar = document.getElementById('manual-action-bar');
    actionBar.classList.add('active');

    const btnOk = document.getElementById('btn-global-ok');
    const btnNo = document.getElementById('btn-global-no');

    const newBtnOk = btnOk.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnOk.replaceWith(newBtnOk);
    btnNo.replaceWith(newBtnNo);

    newBtnOk.addEventListener('click', () => {
        cleanupManualActions();
        evaluateMatch();
    });

    newBtnNo.addEventListener('click', () => {
        cleanupManualActions();
        resetSecondCardSelection();
    });

    if (config.timer !== 'off') {
        const timeMs = parseInt(config.timer, 10) * 1000;
        gameState.timerInterval = setTimeout(() => {
            cleanupManualActions();
            resetSecondCardSelection();
        }, timeMs);
    }
}

function cleanupManualActions() {
    if (gameState.timerInterval) {
        clearTimeout(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    document.getElementById('manual-action-bar')?.classList.remove('active');
}

function resetSecondCardSelection() {
    if (!gameState.secondCard) return;
    gameState.secondCard.card.classList.remove('selected-second', 'show-silhouette', 'flipped');
    gameState.secondCard = null;
    gameState.lockBoard = false;
}

function evaluateMatch() {
    gameState.lockBoard = true;
    const c1 = gameState.firstCard;
    const c2 = gameState.secondCard;
    const isMatch = c1.cardData.id === c2.cardData.id;

    c2.card.classList.remove('show-silhouette');
    c2.card.classList.add('flipped');

    if (isMatch) {
        setTimeout(() => {
            c1.card.classList.add('collected');
            c2.card.classList.add('collected');
            c1.card.style.visibility = 'hidden';
            c2.card.style.visibility = 'hidden';

            addToCollection(c1.cardData);
            playSystemSound('acerto');

            gameState.matchesFound++;
            updateScoreBoard();
            resetTurnState();

            if (gameState.matchesFound === config.pairs) {
                setTimeout(showVictoryModal, 500);
            }
        }, 1000);
    } else {
        setTimeout(() => {
            c1.card.classList.remove('flipped');
            c2.card.classList.remove('selected-second', 'show-silhouette', 'flipped');
            resetTurnState();
        }, 2000);
    }

    gameState.soundCounts = {};
}

function resetTurnState() {
    gameState.firstCard = null;
    gameState.secondCard = null;
    gameState.lockBoard = false;
}

function updateScoreBoard() {
    document.getElementById('score-counter').innerText = `Pares: ${gameState.matchesFound} / ${config.pairs}`;
}

function addToCollection(cardData) {
    const collection = document.getElementById('collection-area');
    const item = document.createElement('div');
    item.classList.add('collected-item');
    item.innerHTML = `<img src="${cardData.img}" alt="${cardData.nome}">`;
    collection.appendChild(item);
}

function showVictoryModal() {
    playSystemSound('vitoria');
    const modal = document.getElementById('victory-modal');
    if (modal) modal.style.display = 'flex';
}

/* ==========================================================================
   6. GALERIA DE ANIMAIS
   ========================================================================== */
function openGallery() {
    preloadAudios();
    showScreen('gallery-screen');
    buildGallery();
}

function buildGallery() {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';

    animaisDB.forEach(animal => {
        const card = document.createElement('div');
        card.classList.add('gallery-card');
        card.innerHTML = `
            <img src="${animal.img}" alt="${animal.nome}">
            <span>${animal.nome}</span>
        `;
        card.addEventListener('click', () => playSound(animal.id, false));
        grid.appendChild(card);
    });
}