const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('log');
const btn = document.getElementById('startBtn');

// --- Configuration ---
const nodes = {
    'Client': { x: 80, y: 300, color: '#fff' },
    'Resolver': { x: 220, y: 150, color: '#00d4ff' },
    'Root': { x: 380, y: 80, color: '#ffea00' },
    'TLD': { x: 520, y: 80, color: '#ffea00' },
    'Auth': { x: 660, y: 150, color: '#ffea00' },
    'R1': { x: 250, y: 400, color: '#777' },
    'R2': { x: 450, y: 320, color: '#777' },
    'R3': { x: 450, y: 480, color: '#777' },
    'Server': { x: 700, y: 400, color: '#4caf50' }
};

const links = [
    ['Client', 'Resolver'], ['Resolver', 'Root'], ['Resolver', 'TLD'], ['Resolver', 'Auth'],
    ['Client', 'R1'], ['R1', 'R2'], ['R1', 'R3'], ['R2', 'Server'], ['R3', 'Server'], ['R2', 'R3']
];

let activePackets = [];

// --- Setup ---
function resize() {
    canvas.width = window.innerWidth - 350;
    canvas.height = window.innerHeight - 80;
}
window.onresize = resize;
resize();

function log(msg, type = '') {
    const div = document.createElement('div');
    div.className = `log-entry ${type ? type + '-log' : ''}`;
    div.innerHTML = `<strong>[${type.toUpperCase() || 'INFO'}]</strong> ${msg}`;
    logEl.prepend(div);
}

// --- Animation Engine ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    links.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(nodes[l[0]].x, nodes[l[0]].y);
        ctx.lineTo(nodes[l[1]].x, nodes[l[1]].y);
        ctx.stroke();
    });

    for (let id in nodes) {
        const n = nodes[id];
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(id, n.x - 20, n.y + 30);
    }

    activePackets.forEach((p, i) => {
        const target = nodes[p.targetId];
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < 5) {
            p.resolve();
            activePackets.splice(i, 1);
        } else {
            p.x += (dx / dist) * 6;
            p.y += (dy / dist) * 6;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
        }
    });
    requestAnimationFrame(draw);
}

function transmit(from, to, color) {
    return new Promise(resolve => {
        activePackets.push({ x: nodes[from].x, y: nodes[from].y, targetId: to, color, resolve });
    });
}

async function routePath(path, color, label) {
    for (let i = 0; i < path.length - 1; i++) {
        log(`${label}: Processing at ${path[i]} (Network Layer Check)`, 'tcp');
        await transmit(path[i], path[i+1], color);
    }
}

// --- Main Simulation ---
async function runSimulation() {
    const url = document.getElementById('urlInput').value || 'example.com';
    const mode = document.getElementById('modeSelect').value;
    btn.disabled = true;
    logEl.innerHTML = '';

    // 1. DNS
    log(`Client: Resolving ${url}`, 'dns');
    await transmit('Client', 'Resolver', '#00d4ff');
    for(let s of ['Root', 'TLD', 'Auth']) {
        await transmit('Resolver', s, '#ffea00');
        await transmit(s, 'Resolver', '#ffea00');
    }
    await transmit('Resolver', 'Client', '#00d4ff');

    // 2. HANDSHAKE
    log("TCP: 3-Way Handshake START", "hs");
    await routePath(['Client', 'R1', 'R2', 'Server'], '#f472b6', 'SYN');
    await routePath(['Server', 'R2', 'R1', 'Client'], '#f472b6', 'SYN-ACK');
    await routePath(['Client', 'R1', 'R2', 'Server'], '#f472b6', 'ACK');

    // 3. DATA REQUEST
    log("Application: Sending HTTP GET Request", "tcp");
    if (mode === 'packet') {
        await Promise.all([
            routePath(['Client', 'R1', 'R2', 'Server'], '#4caf50', 'GET_P1'),
            routePath(['Client', 'R1', 'R3', 'Server'], '#4caf50', 'GET_P2')
        ]);
    } else {
        await routePath(['Client', 'R1', 'R2', 'Server'], '#ff5722', 'GET_STREAM');
    }

    // 4. SERVER RESPONSE (New Phase)
    log("Server: Processing Request... Sending HTML Data", "tcp");
    await new Promise(r => setTimeout(r, 500)); // Simulating processing time
    
    if (mode === 'packet') {
        // Response packets coming back potentially different paths
        await Promise.all([
            routePath(['Server', 'R2', 'R1', 'Client'], '#00ff00', 'RES_P1'),
            routePath(['Server', 'R3', 'R1', 'Client'], '#00ff00', 'RES_P2'),
            routePath(['Server', 'R2', 'R3', 'R1', 'Client'], '#00ff00', 'RES_P3')
        ]);
    } else {
        await routePath(['Server', 'R2', 'R1', 'Client'], '#ff5722', 'RES_STREAM');
    }

    log("Application: Rendered page from " + url, "tcp");
    btn.disabled = false;
}

btn.addEventListener('click', runSimulation);
draw();
