class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.chest = 0;
        this.pocket = 0;
        this.inCave = true;
    }
    resetForRound() { this.pocket = 0; this.inCave = true; }
    bank() { this.chest += this.pocket; this.pocket = 0; this.inCave = false; }
}

class Deck {
    constructor() {
        this.treasureValues = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
        this.artifactValues = [5, 7, 8, 10, 12];
        this.trapDeck = { 'Scorpioni': 3, 'Serpenti': 3, 'Fossa di Lava': 3, 'Massi Rotolanti': 3, 'Trappole Acuminate': 3 };
        this.availableArtifacts = [];
    }
    addArtifact(val) { this.availableArtifacts.push(val); }
    draw() {
        let totalTraps = Object.values(this.trapDeck).reduce((a, b) => a + b, 0);
        let totalArtifacts = this.availableArtifacts.length;
        let totalCards = this.treasureValues.length + totalTraps + totalArtifacts;
        let rand = Math.random() * totalCards;
        if (rand < totalTraps) {
            let traps = [];
            for (let t in this.trapDeck) for(let i=0; i<this.trapDeck[t]; i++) traps.push(t);
            return { type: 'trap', name: traps[Math.floor(Math.random() * traps.length)] };
        } else if (rand < (totalTraps + totalArtifacts)) {
            let val = this.availableArtifacts[Math.floor(Math.random() * this.availableArtifacts.length)];
            return { type: 'artifact', value: val, remainder: val };
        } else {
            return { type: 'treasure', value: this.treasureValues[Math.floor(Math.random() * this.treasureValues.length)], remainder: 0 };
        }
    }
    removeTrap(name) { if (this.trapDeck[name] > 0) this.trapDeck[name]--; }
    removeArtifact(val) { this.availableArtifacts = this.availableArtifacts.filter(v => v !== val); }
}

class UIManager {
    constructor() { this.msgEl = document.getElementById('message'); }
    display(text) { this.msgEl.innerText = text; this.msgEl.focus(); }
    
    updateBoard(players, path, round, highlightId) {}

    announcePathStatus(path, round) {
        let text = `Grotta ${round} di 5\n`;
        text += (path.length === 0) ? "Percorso vuoto.\n" : "Stato Percorso:\n";
        path.forEach((c, i) => {
            let info = (c.type === 'treasure') ? `Rubini: ${c.remainder}` : (c.type === 'artifact' ? `Art (${c.remainder})` : `Pericolo: ${c.name}`);
            text += `${i+1}. ${info}\n`;
        });
        this.display(text);
    }

    announcePlayersStatus(players) {
        let text = "Stato Giocatori:\n";
        players.forEach(p => {
            let location = p.inCave ? "In Grotta" : "Al Campo";
            text += `${p.name}: Tasca ${p.pocket}, Baule ${p.chest} - ${location}\n`;
        });
        this.display(text);
    }
}

class Game {
    constructor(names) {
        this.players = names.map((n, i) => new Player(i + 1, n));
        this.deck = new Deck();
        this.ui = new UIManager();
        this.round = 1;
        this.currentPlayerIndex = 0;
        this.currentPath = [];
        this.activeTrapsInRound = [];
        this.roundDecisions = [];
        this.pendingDecision = null;
    }
    startRound() {
        if (this.round > 5) return;
        this.activeTrapsInRound = [];
        this.currentPath = [];
        this.players.forEach(p => p.resetForRound());
        this.deck.addArtifact(this.deck.artifactValues[this.round - 1]);
        document.getElementById('next-round-container').classList.add('hidden');
        document.getElementById('status-container').classList.remove('hidden');
        this.executeTurnLogic();
    }
    handleTransition() {
        document.getElementById('confirm-container').classList.add('hidden');
        document.getElementById('status-container').classList.add('hidden');
        this.ui.display("Ora passatevi il dispositivo e votate in segreto.");
        document.getElementById('pass-device-container').classList.remove('hidden');
    }
    prepareTurnChoices() {
        document.getElementById('pass-device-container').classList.add('hidden');
        document.getElementById('action-buttons').classList.remove('hidden');
        document.getElementById('status-container').classList.remove('hidden');
        this.roundDecisions = [];
        this.currentPlayerIndex = 0;
        this.findNextActivePlayer();
    }
    findNextActivePlayer() {
        while (this.currentPlayerIndex < this.players.length && !this.players[this.currentPlayerIndex].inCave) { this.currentPlayerIndex++; }
        if (this.currentPlayerIndex < this.players.length) {
            this.ui.updateBoard(this.players, this.currentPath, this.round, this.players[this.currentPlayerIndex].id);
            this.ui.display(`${this.players[this.currentPlayerIndex].name}, effettua la tua scelta:`);
        } else { this.showDecisionSummary(); }
    }
    selectAction(action, label) {
        this.pendingDecision = action;
        document.getElementById('selection-text').innerText = `Stai selezionando: "${label}"`;
        document.getElementById('btn-final-confirm').classList.remove('hidden');
    }
    confirmDecision() {
        document.getElementById('btn-final-confirm').classList.add('hidden');
        document.getElementById('selection-text').innerText = "";
        this.roundDecisions.push({ playerId: this.players[this.currentPlayerIndex].id, action: this.pendingDecision });
        this.currentPlayerIndex++;
        this.findNextActivePlayer();
    }
    showDecisionSummary() {
        document.getElementById('action-buttons').classList.add('hidden');
        let summary = "Riepilogo Scelte:\n";
        this.roundDecisions.forEach(d => {
            const p = this.players.find(pl => pl.id === d.playerId);
            summary += `${p.name}: ${d.action === 'continue' ? "VAI AVANTI" : "ESCI DALLA GROTTA"}\n`;
        });
        this.ui.display(summary);
        document.getElementById('summary-container').classList.remove('hidden');
    }
    executeTurnLogic() {
        document.getElementById('summary-container').classList.add('hidden');
        const leavers = this.players.filter(p => p.inCave && this.roundDecisions.find(d => d.playerId === p.id)?.action === 'leave');
        if (leavers.length > 0) {
            this.currentPath.forEach(card => {
                if (card.type === 'treasure' && card.remainder > 0) {
                    let share = Math.floor(card.remainder / leavers.length);
                    leavers.forEach(p => p.pocket += share);
                    card.remainder %= leavers.length;
                }
                if (card.type === 'artifact' && card.remainder > 0 && leavers.length === 1) {
                    leavers[0].pocket += card.remainder;
                    card.remainder = 0;
                }
            });
            leavers.forEach(p => p.bank());
        }
        if (this.players.every(p => !p.inCave)) return this.endRound(`Round ${this.round} concluso.`);
        const card = this.deck.draw();
        this.currentPath.push(card);
        const stayers = this.players.filter(p => p.inCave);
        if (card.type === 'treasure') {
            let share = Math.floor(card.value / stayers.length);
            card.remainder = card.value % stayers.length;
            stayers.forEach(p => p.pocket += share);
            this.ui.display(`Tesoro ${card.value}. +${share} a testa. Restano: ${card.remainder}.`);
        } else if (card.type === 'artifact') {
            this.deck.removeArtifact(card.value);
            this.ui.display(`Artefatto trovato (Valore: ${card.value}).`);
        } else {
            if (this.activeTrapsInRound.includes(card.name)) {
                this.deck.removeTrap(card.name);
                stayers.forEach(p => p.pocket = 0);
                return this.endRound(`TRAPPOLA: ${card.name}! Round finito.`);
            }
            this.activeTrapsInRound.push(card.name);
            this.ui.display(`Pericolo: ${card.name}.`);
        }
        this.ui.updateBoard(this.players, this.currentPath, this.round);
        document.getElementById('confirm-container').classList.remove('hidden');
    }
    endRound(msg) {
        this.round++;
        this.ui.updateBoard(this.players, this.currentPath, this.round - 1);
        this.ui.display(msg);
        document.querySelectorAll('#controls > div').forEach(d => d.classList.add('hidden'));
        if (this.round > 5) {
            this.players.sort((a,b) => b.chest - a.chest);
            this.ui.display(msg + `\nVince ${this.players[0].name} con ${this.players[0].chest} rubini.`);
            document.getElementById('restart-container').classList.remove('hidden');
        } else { document.getElementById('next-round-container').classList.remove('hidden'); }
    }
}

let game;
function initSetup() {
    const count = parseInt(document.getElementById('player-select').value);
    const container = document.getElementById('name-inputs');
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) { container.innerHTML += `<input type="text" id="name-p${i}" placeholder="Giocatore ${i}"><br>`; }
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('name-setup').classList.remove('hidden');
}
function startGame() {
    const names = Array.from(document.querySelectorAll('#name-inputs input')).map(i => i.value.trim() || i.placeholder);
    game = new Game(names);
    document.getElementById('name-setup').classList.add('hidden');
    document.getElementById('interaction-zone').classList.remove('hidden');
    document.getElementById('board').classList.remove('hidden');
    game.startRound();
}
