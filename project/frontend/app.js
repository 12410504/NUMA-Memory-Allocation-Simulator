const API_URL = 'http://localhost:5000/api/simulation';

// State
let isPlaying = false;
let simulationInterval = null;
let barChart = null;
let radarChart = null;

// DOM Elements
const simNodeContainer = document.getElementById('sim-node-container');
const dashNodes = document.getElementById('dash-nodes');
const dashLatency = document.getElementById('dash-latency');
const hitRatioVal = document.getElementById('analytics-hit-ratio');
const missRatioVal = document.getElementById('analytics-miss-ratio');

const nodesInput = document.getElementById('nodes-input');
const processInput = document.getElementById('process-input');
const policySelect = document.getElementById('policy-select');

// Tab Switching Logic
function initTabs() {
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            switchTab(targetId);
        });
    });
}

function switchTab(targetId) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-target') === targetId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update active view
    document.querySelectorAll('.view-section').forEach(view => {
        if (view.id === targetId) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
    
    // Re-render charts if analytics view is opened
    if (targetId === 'analytics-view' && barChart) {
        barChart.update();
        radarChart.update();
    }
}

// Input syncing
nodesInput.addEventListener('input', (e) => {
    document.getElementById('nodes-val-display').textContent = e.target.value;
});
processInput.addEventListener('input', (e) => {
    document.getElementById('process-val-display').textContent = e.target.value;
});

// Chart.js Initialization (Mock data for UI showcase)
function initCharts() {
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';

    // Bar Chart
    const ctxBar = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Latency', 'Throughput', 'Local Access', 'CPU Usage'],
            datasets: [
                {
                    label: 'First-Touch',
                    data: [18, 85, 92, 45],
                    backgroundColor: 'rgba(0, 240, 255, 0.8)',
                },
                {
                    label: 'Interleaved',
                    data: [35, 95, 25, 60],
                    backgroundColor: 'rgba(179, 0, 255, 0.8)',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Radar Chart
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Local Access', 'Remote Access', 'Cache Hit', 'Memory BW', 'Efficiency'],
            datasets: [
                {
                    label: 'First-Touch',
                    data: [90, 10, 85, 60, 88],
                    backgroundColor: 'rgba(0, 240, 255, 0.2)',
                    borderColor: 'rgba(0, 240, 255, 1)',
                    pointBackgroundColor: 'rgba(0, 240, 255, 1)'
                },
                {
                    label: 'Interleaved',
                    data: [25, 75, 40, 95, 65],
                    backgroundColor: 'rgba(179, 0, 255, 0.2)',
                    borderColor: 'rgba(179, 0, 255, 1)',
                    pointBackgroundColor: 'rgba(179, 0, 255, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#8b949e' },
                    ticks: { display: false }
                }
            }
        }
    });
}

// Simulation Logic
async function initSimulation() {
    const config = {
        nodes: parseInt(nodesInput.value),
        node_capacity: 1000,
        processes: parseInt(processInput.value),
        pages_per_process: 50,
        policy: policySelect.value,
        latencies: { local: 10, remote: 50 }
    };

    try {
        const res = await fetch(`${API_URL}/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const data = await res.json();
        updateUI(data.state);
        
        // Ensure buttons state
        document.getElementById('play-btn').disabled = false;
        
    } catch (err) {
        console.error("Failed to initialize:", err);
    }
}

async function fetchStep() {
    try {
        const res = await fetch(`${API_URL}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_size: 5 })
        });
        const data = await res.json();
        updateUI(data.state, data.events);
    } catch (err) {
        console.error("Failed to fetch step:", err);
        togglePlay(false);
    }
}

async function resetSimulation() {
    try {
        await fetch(`${API_URL}/reset`, { method: 'POST' });
        togglePlay(false);
        simNodeContainer.innerHTML = '';
        dashNodes.textContent = '0';
        dashLatency.textContent = '--ns';
        hitRatioVal.textContent = '--%';
        missRatioVal.textContent = '--%';
        
        // Re-init with current controls
        initSimulation();
    } catch (err) {
        console.error("Failed to reset:", err);
    }
}

function updateUI(state, newEvents = []) {
    if (!state.initialized) return;

    // Update Dashboard Metrics
    dashNodes.textContent = state.nodes.length;
    dashLatency.textContent = state.stats.average_latency.toFixed(1) + 'ns';
    
    let hitRatio = 0;
    if (state.stats.total_accesses > 0) {
        hitRatio = (state.stats.local_accesses / state.stats.total_accesses) * 100;
    }
    hitRatioVal.textContent = `${hitRatio.toFixed(1)}%`;
    missRatioVal.textContent = `${(100 - hitRatio).toFixed(1)}%`;

    // Render Nodes Grid (Simulation View)
    renderNodes(state.nodes, newEvents);
    
    // Render Architecture View
    renderArchitecture(state.nodes, newEvents);
}

function renderArchitecture(nodes, events) {
    // Update Timeline Playback node utilizations
    nodes.forEach(node => {
        // Timeline dot active state and text
        const timelineDot = document.getElementById(`timeline-dot-${node.id}`);
        const timelineSub = document.getElementById(`timeline-sub-${node.id}`);
        if (timelineSub) {
            timelineSub.textContent = `${node.utilization}% utilized`;
            if (node.utilization > 0 && timelineDot) {
                timelineDot.classList.add('active');
            } else if (timelineDot) {
                timelineDot.classList.remove('active');
            }
        }
    });

    // Handle Architecture Access Animations
    events.forEach(ev => {
        // Flash the target node in the architecture grid
        const archNodeEl = document.getElementById(`arch-node-${ev.target_node}`);
        if (archNodeEl) {
            archNodeEl.classList.remove('pulse-local', 'pulse-remote');
            void archNodeEl.offsetWidth; // trigger reflow
            if (ev.is_local) {
                archNodeEl.classList.add('pulse-local');
            } else {
                archNodeEl.classList.add('pulse-remote');
            }
        }

        // If it's a remote access, flash the data flow line and base line
        if (!ev.is_local) {
            const minNode = Math.min(ev.cpu_node, ev.target_node);
            const maxNode = Math.max(ev.cpu_node, ev.target_node);
            
            // Still blink the base line lightly
            const baseLineId = `line-${minNode}-${maxNode}`;
            const baseLineEl = document.getElementById(baseLineId);
            if (baseLineEl) {
                baseLineEl.classList.remove('pulse-line');
                void baseLineEl.offsetWidth; // trigger reflow
                baseLineEl.classList.add('pulse-line');
            }

            // Animate directional data flow
            const flowLineId = `flow-${minNode}-${maxNode}`;
            const flowLineEl = document.getElementById(flowLineId);
            if (flowLineEl) {
                flowLineEl.classList.remove('animate-flow-fwd', 'animate-flow-bwd');
                void flowLineEl.offsetWidth; // trigger reflow
                
                // Determine direction
                let isForward = false;
                if (minNode === 2 && maxNode === 3) {
                    // special case: flow-2-3 is drawn from Node 3 to Node 2 (x1=25%, x2=75%)
                    isForward = (ev.cpu_node === 3); 
                } else {
                    // all other lines are drawn min -> max
                    isForward = (ev.cpu_node < ev.target_node);
                }
                
                if (isForward) {
                    flowLineEl.classList.add('animate-flow-fwd');
                } else {
                    flowLineEl.classList.add('animate-flow-bwd');
                }
            }
        }
    });
}

function renderNodes(nodes, events) {
    nodes.forEach(node => {
        let nodeEl = document.getElementById(`sim-node-${node.id}`);
        
        if (!nodeEl) {
            nodeEl = document.createElement('div');
            nodeEl.className = 'sim-node-card';
            nodeEl.id = `sim-node-${node.id}`;
            nodeEl.innerHTML = `
                <div class="sim-node-circle" id="circle-${node.id}">
                    <i data-lucide="cpu"></i>
                </div>
                <div class="sim-node-title">Node ${node.id}</div>
                <div class="sim-node-sub">32GB Memory</div>
                <div class="sim-bars">
                    <div class="sim-bar-bg"><div class="sim-bar-fill fill-cyan" id="bar1-${node.id}" style="width: 0%"></div></div>
                    <div class="sim-bar-bg"><div class="sim-bar-fill fill-purple" id="bar2-${node.id}" style="width: 0%"></div></div>
                    <div class="sim-bar-bg"><div class="sim-bar-fill fill-green" id="bar3-${node.id}" style="width: 0%"></div></div>
                </div>
            `;
            simNodeContainer.appendChild(nodeEl);
            lucide.createIcons({ root: nodeEl }); // Re-init icons for new elements
        }

        // Update the main memory bar
        document.getElementById(`bar1-${node.id}`).style.width = `${node.utilization}%`;
        
        // Mock variations for the other bars to look like the screenshots
        document.getElementById(`bar2-${node.id}`).style.width = `${Math.min(100, node.utilization * 1.2)}%`;
        document.getElementById(`bar3-${node.id}`).style.width = `${Math.min(100, node.utilization * 0.8)}%`;
    });

    // Handle Access Animations
    events.forEach(ev => {
        const circleEl = document.getElementById(`circle-${ev.target_node}`);
        if (circleEl) {
            circleEl.classList.remove('pulse-local', 'pulse-remote');
            void circleEl.offsetWidth; // trigger reflow
            
            if (ev.is_local) {
                circleEl.classList.add('pulse-local');
            } else {
                circleEl.classList.add('pulse-remote');
            }
        }
    });
}

function togglePlay(forcePlay) {
    if (forcePlay !== undefined) {
        isPlaying = forcePlay;
    } else {
        isPlaying = !isPlaying;
    }

    const btn = document.getElementById('play-btn');
    const text = document.getElementById('play-btn-text');
    const timelineBtn = document.getElementById('timeline-play-btn');
    
    // Always clear the existing interval to prevent duplicates
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }

    if (isPlaying) {
        if (text) text.textContent = 'Pause Simulation';
        if (btn) btn.className = 'btn btn-outline w-100';
        if (timelineBtn) {
            // Use SVG directly to avoid lucide.js dependency errors dynamically
            timelineBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
            timelineBtn.style.boxShadow = '0 0 25px rgba(0, 240, 255, 0.6)';
        }
        simulationInterval = setInterval(fetchStep, 500);
    } else {
        if (text) text.textContent = 'Run Simulation';
        if (btn) btn.className = 'btn btn-glow-cyan w-100';
        if (timelineBtn) {
            // Use SVG directly
            timelineBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            timelineBtn.style.boxShadow = '';
        }
    }
}

// Event Listeners
document.getElementById('play-btn').addEventListener('click', () => togglePlay());
document.getElementById('timeline-play-btn').addEventListener('click', () => togglePlay());
document.getElementById('reset-btn').addEventListener('click', resetSimulation);
// Re-init simulation if controls change
policySelect.addEventListener('change', () => { togglePlay(false); initSimulation(); });
nodesInput.addEventListener('change', () => { togglePlay(false); initSimulation(); });
processInput.addEventListener('change', () => { togglePlay(false); initSimulation(); });

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCharts();
    initSimulation(); // Auto-init on load
});
