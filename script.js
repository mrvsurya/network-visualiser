const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('log');
const btn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const speedSlider = document.getElementById('speedSlider');

// --- Network Nodes ---
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

function resize() {
    canvas.width = window.innerWidth - 380;
    canvas.height = window.innerHeight - 80;
}
window.onresize = resize;
resize();

// --- Logging Logic ---
function log(msg, type = '') {
    const div = document.createElement('div');
    div.className = `log-entry ${type ? type + '-log' : ''}`;
    div.innerHTML = `<strong>[${type.toUpperCase() || 'INFO'}]</strong> ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight; 
}

function clearLog() {
    logEl.innerHTML = '';
}

// --- Animation Loop ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Background Links
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    links.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(nodes[l[0]].x, nodes[l[0]].y);
        ctx.lineTo(nodes[l[1]].x, nodes[l[1]].y);
        ctx.stroke();
    });

    // Draw Nodes
    for (let id in nodes) {
        const n = nodes[id];
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(12, 12, 12, 0, Math.PI * 2); // Dummy for circle
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(id, n.x - 20, n.y + 30);
    }

    // Move Packets based on Slider Speed
    const currentSpeed = parseFloat(speedSlider.value);
    
    activePackets.forEach((p, i) => {
        const target = nodes[p.targetId];
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < currentSpeed) { // Use speed as threshold to prevent "overshooting"
            p.resolve();
            activePackets.splice(i, 1);
        } else {
            p.x += (dx / dist) * currentSpeed;
            p.y += (dy / dist) * currentSpeed;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
            ctx.shadowBlur = 0;
        }
    });
    requestAnimationFrame(draw);
}

function transmit(from, to, color) {
    return new Promise(resolve => {
        activePackets.push({ x: nodes[from].x, y: nodes[from].y, targetId: to, color, resolve });
    });
}

async function routePath(path, color, label, type) {
    for (let i = 0; i < path.length - 1; i++) {
        log(`${label}: Processing at ${path[i]} → Routing to ${path[i+1]}`, type);
        await transmit(path[i], path[i+1], color);
    }
}

// --- Simulation Logic ---
async function runSimulation() {
    const url = document.getElementById('urlInput').value || 'example.com';
    const mode = document.getElementById('modeSelect').value;
    btn.disabled = true;

    // 1. DNS Resolution (Iterative)
    log(`Client: Resolving ${url}. Sending request to Local Resolver.`, 'dns');
    await transmit('Client', 'Resolver', '#00d4ff');
    
    const dnsSteps = [
        { name: 'Root', res: 'Referral to .com TLD' },
        { name: 'TLD', res: `Referral to ${url} Auth Server` },
        { name: 'Auth', res: 'A Record: 93.184.216.34' }
    ];

    for(let step of dnsSteps) {
        log(`Resolver -> ${step.name}: Recursive query for ${url}`, 'dns');
        await transmit('Resolver', step.name, '#ffea00');
        log(`${step.name} -> Resolver: ${step.res}`, 'dns');
        await transmit(step.name, 'Resolver', '#ffea00');
    }
    
    log(`Resolver -> Client: Found IP! Mapping ${url} to 93.184.216.34`, 'dns');
    await transmit('Resolver', 'Client', '#00d4ff');

    // 2. TCP Handshake
    log("TCP Layer: Handshake Sequence Initiated", "hs");
    await routePath(['Client', 'R1', 'R2', 'Server'], '#f472b6', 'SYN', 'hs');
    await routePath(['Server', 'R2', 'R1', 'Client'], '#f472b6', 'SYN-ACK', 'hs');
    await routePath(['Client', 'R1', 'R2', 'Server'], '#f472b6', 'ACK', 'hs');
    log("TCP: Connection Established (Handshake Complete)", "hs");

    // 3. Data Transfer
    log(`Commencing ${mode.toUpperCase()} data exchange...`, "tcp");
    if (mode === 'packet') {
        log("Link Layer: Breaking data into independent segments", "tcp");
        await Promise.all([
            routePath(['Client', 'R1', 'R2', 'Server'], '#4caf50', 'GET_REQ', 'tcp'),
            routePath(['Server', 'R3', 'R1', 'Client'], '#00ff00', 'HTTP_DATA', 'tcp')
        ]);
    } else {
        log("Physical Layer: Maintaining dedicated virtual circuit", "tcp");
        await routePath(['Client', 'R1', 'R2', 'Server'], '#ff5722', 'DATA_REQ', 'tcp');
        await routePath(['Server', 'R2', 'R1', 'Client'], '#ff5722', 'DATA_RES', 'tcp');
    }

    log(`Success: Resource ${url} retrieved and rendered.`, "tcp");
    btn.disabled = false;
}

// Event Listeners
btn.addEventListener('click', runSimulation);
clearBtn.addEventListener('click', clearLog);

// Start Animation
draw();
