let config = {
    pairs: 6,
    silhouette: true,
    confirmation: 'auto',
    soundLimit: 'unlimited',
    timer: 'off'
};

let gameState = {
    cards: [],
    firstCard: null,
    secondCard: null,
    lockBoard: false,
    matchesFound: 0,
    soundCounts: {},
    audioCache: {},
    timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
    setupUI();

    const btnBackMenu = document.getElementById('btn-back-menu');

    if (btnBackMenu) {
        btnBackMenu.addEventListener('click', () => {
            document.getElementById('victory-modal').style.display = 'none';
            location.reload(); // Retorna ao menu recarregando a página
        });
    }
});

function setupUI() {
    const btnStart = document.getElementById('btn-start');
    const btnGuide = document.getElementById('btn-guide');
    const btnConfig = document.getElementById('btn-config');
    const closeGuide = document.getElementById('close-guide');
    const saveAndStart = document.getElementById('save-and-start');
    const saveAndExit = document.getElementById('save-and-exit');
    
    btnStart.addEventListener('click', startGame);
    btnGuide.addEventListener('click', () => document.getElementById('modal-guide').classList.add('active'));
    closeGuide.addEventListener('click', () => document.getElementById('modal-guide').classList.remove('active'));
    
    btnConfig.addEventListener('click', () => document.getElementById('modal-config').classList.add('active'));
    
    if (saveAndStart) {
        saveAndStart.addEventListener('click', () => {
            updateConfigFromInputs();
            document.getElementById('modal-config').classList.remove('active');
            startGame();
        });
    }

    if (saveAndExit) {
        saveAndExit.addEventListener('click', () => {
            updateConfigFromInputs();
            document.getElementById('modal-config').classList.remove('active');
        });
    }

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
            document.querySelector('[data-level="personalizado"]').classList.add('active');
            updateConfigFromInputs();
        });
    });

    document.getElementById('btn-restart-game').addEventListener('click', () => confirmAction("Reiniciar partida?", startGame));
    document.getElementById('btn-menu-game').addEventListener('click', () => confirmAction("Voltar ao menu principal?", returnToMenu));
}

function applyLevelPreset(level) {
    if (level === 'padrao') {
        config = { pairs: 4, silhouette: true, confirmation: 'auto', soundLimit: 'unlimited', timer: 'off' };
    } else if (level === 'intermediario') {
        config = { pairs: 6, silhouette: true, confirmation: 'manual', soundLimit: '3', timer: 'off' };
    } else if (level === 'avancado') {
        config = { pairs: 8, silhouette: false, confirmation: 'manual', soundLimit: '2', timer: '10' };
    }
    updateInputsFromConfig();
}

function updateConfigFromInputs() {
    config.pairs = parseInt(document.getElementById('cfg-pairs').value);
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

function startGame() {
    updateConfigFromInputs();
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('modal-config').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    gameState.matchesFound = 0;
    gameState.firstCard = null;
    gameState.secondCard = null;
    gameState.lockBoard = false;
    gameState.soundCounts = {};

    preloadAudios();
    buildBoard();
    updateScoreBoard();
}

function preloadAudios() {

    animaisDB.forEach(animal => {
        if (!gameState.audioCache[animal.id]) {
            const audio = new Audio(animal.sound);
            audio.load();
            gameState.audioCache[animal.id] = audio;
        }
    });
}

function playSound(animalId, isRepeat = false) {
    // O LIMITE CONFIGURADO PELO CUIDADOR SÓ RESTRINGE REPETIÇÕES MANUAIS NA MESMA RODADA
    if (isRepeat && config.soundLimit !== 'unlimited') {
        gameState.soundCounts[animalId] = (gameState.soundCounts[animalId] || 0) + 1;
        const limit = parseInt(config.soundLimit);
        if (gameState.soundCounts[animalId] > limit) return;
    }

    // INTERROMPE QUALQUER ÁUDIO QUE ESTEJA TOCANDO NO MOMENTO
    if (gameState.currentAudio) {
        gameState.currentAudio.pause();
        gameState.currentAudio.currentTime = 0;
    }

    const audio = gameState.audioCache[animalId];
    if (audio) {
        audio.currentTime = 0;
        audio.play().then(() => {
            gameState.currentAudio = audio;
        }).catch(e => console.log("Áudio indisponível, usando fallback visual."));
    }
}

function playSystemSound(soundName) {
    const audio = new Audio(`assets/sounds/${soundName}.mp3`);
    audio.play().catch(e => console.log(`Áudio do sistema (${soundName}) indisponível.`));
}

function buildBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    document.getElementById('collection-area').innerHTML = '';

    const shuffledAnimals = [...animaisDB].sort(() => 0.5 - Math.random()).slice(0, config.pairs);
    const cardPairs = [...shuffledAnimals, ...shuffledAnimals]
        .sort(() => 0.5 - Math.random())
        .map((animal, index) => ({
            uniqueId: index,
            id: animal.id,
            nome: animal.nome,
            emoji: animal.emoji,
            img: animal.img
        }));

    gameState.cards = cardPairs;

    cardPairs.forEach(cardData => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.uniqueId = cardData.uniqueId;
        card.dataset.id = cardData.id;

        card.innerHTML = `
            <div class="fallback-icon">${cardData.emoji}</div>
            <img src="${cardData.img}" alt="${cardData.nome}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        `;

        card.addEventListener('click', () => handleCardClick(card, cardData));
        board.appendChild(card);
    });
}

function handleCardClick(card, cardData) {
    const isAlreadyOpen = card.classList.contains('flipped') || 
                          card.classList.contains('collected') || 
                          card.classList.contains('selected-second');

    // BLOQUEIA A ABERTURA DE NOVAS CARTAS ENQUANTO AGUARDA CONFIRMAÇÃO OU AVALIAÇÃO
    if (isAlreadyOpen) {
        playSound(cardData.id, true);
        return;
    }

    // BLOQUEIA A ABERTURA DE NOVAS CARTAS ENQUANTO AGUARDA CONFIRMAÇÃO OU AVALIAÇÃO
    if (gameState.lockBoard) return;

    if (!gameState.firstCard) {
        gameState.firstCard = { card, cardData };
        card.classList.add('flipped');
        playSound(cardData.id, false); // ABERTURA INICIAL SEMPRE TOCA O SOM
        return;
    }

    if (gameState.firstCard.card === card) {
        playSound(cardData.id, true);
        return;
    }

    gameState.secondCard = { card, cardData };
    gameState.lockBoard = true;
    card.classList.add('selected-second');
    
    if (config.silhouette) {
        card.classList.add('show-silhouette');
    } else {
        card.classList.add('flipped');
    }

    playSound(cardData.id, false); // ABERTURA INICIAL SEMPRE TOCA O SOM

    if (config.confirmation === 'auto') {
        setTimeout(() => evaluateMatch(), 1500);
    } else {
        showManualConfirmation();
    }
}

function showManualConfirmation() {
    const actionBar = document.getElementById('manual-action-bar');
    actionBar.classList.add('active');

    const btnOk = document.getElementById('btn-global-ok');
    const btnNo = document.getElementById('btn-global-no');

    const newBtnOk = btnOk.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);

    newBtnOk.addEventListener('click', () => {
        cleanupManualActions();
        evaluateMatch();
    });

    newBtnNo.addEventListener('click', () => {
        cleanupManualActions();
        resetSecondCardSelection();
    });

    if (config.timer !== 'off') {
        const timeMs = parseInt(config.timer) * 1000;
        gameState.timerInterval = setTimeout(() => {
            cleanupManualActions();
            resetSecondCardSelection();
        }, timeMs);
    }
}

function cleanupManualActions() {
    if (gameState.timerInterval) clearTimeout(gameState.timerInterval);
    document.getElementById('manual-action-bar').classList.remove('active');
}

function resetSecondCardSelection() {
    if (!gameState.secondCard) return;
    const { card } = gameState.secondCard;
    
    // REMOVE TODAS AS CLASSES DE SELEÇÃO E VISUALIZAÇÃO DA SEGUNDA CARTA, VOLTANDO A FICAR AZUL (OCULTA)
    card.classList.remove('selected-second', 'show-silhouette', 'flipped');
    
    gameState.secondCard = null;
    gameState.lockBoard = false;
}

function evaluateMatch() {
    gameState.lockBoard = true;
    const c1 = gameState.firstCard;
    const c2 = gameState.secondCard;

    if (c1.cardData.id === c2.cardData.id) {
        c2.card.classList.remove('show-silhouette');
        c2.card.classList.add('flipped');
        
        setTimeout(() => {
            c1.card.classList.add('collected');
            c2.card.classList.add('collected');
            c1.card.style.visibility = 'hidden';
            c2.card.style.visibility = 'hidden';

            addToCollection(c1.cardData);
            playSystemSound('acerto'); // Toca neste exato momento e corta o áudio do animal

            gameState.matchesFound++;
            updateScoreBoard();

            resetTurnState();

            if (gameState.matchesFound === config.pairs) {
                setTimeout(showVictoryModal, 500);
            }
        }, 1000);
    } else {
        c2.card.classList.remove('show-silhouette');
        c2.card.classList.add('flipped');

        setTimeout(() => {
            c1.card.classList.remove('flipped');
            c2.card.classList.remove('selected-second', 'show-silhouette', 'flipped');
            c1.card.onclick = () => handleCardClick(c1.card, c1.cardData);
            c2.card.onclick = () => handleCardClick(c2.card, c2.cardData);
            resetTurnState();
        }, 2000);
    }
    gameState.soundCounts = {};
}

function showVictoryModal() {
    playSystemSound('vitoria');
    const modal = document.getElementById('victory-modal');
    if (modal) modal.style.display = 'flex';
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
    item.innerHTML = cardData.emoji;
    collection.appendChild(item);
}

function showVictoryModal() {
    playSystemSound('vitoria');
    const modal = document.getElementById('victory-modal');
    if (modal) modal.style.display = 'flex';
}

function returnToMenu() {
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('main-menu').classList.add('active');
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

// Função para tocar sons do sistema (vitória e erro)
// Função para tocar sons do sistema interrompendo qualquer áudio anterior
function playSystemSound(soundName) {
    if (gameState.currentAudio) {
        gameState.currentAudio.pause();
        gameState.currentAudio.currentTime = 0;
    }

    const audio = new Audio(`assets/sounds/${soundName}.mp3`);
    audio.play().then(() => {
        gameState.currentAudio = audio;
    }).catch(e => console.log(`Áudio do sistema (${soundName}) indisponível.`));
}

// Chame esta função quando o jogador completar todos os pares do jogo
function triggerVictory() {
    playSystemSound('vitoria');
    const modal = document.getElementById('victory-modal');
    if (modal) modal.style.display = 'flex';
}

// Chame esta função dentro da sua lógica de erro (ex: após errar a tentativa de par)
function triggerErrorSound() {
    playSystemSound('erro');
}