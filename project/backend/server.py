from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from simulator import Simulator
import os

app = Flask(__name__, static_folder='../frontend')
CORS(app)

simulator = Simulator()

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return "Not Found", 404

@app.route('/api/simulation/init', methods=['POST'])
def init_sim():
    config = request.json or {}
    simulator.init_simulation(config)
    return jsonify({"message": "Simulation initialized", "state": simulator.get_state()})

@app.route('/api/simulation/state', methods=['GET'])
def get_state():
    return jsonify(simulator.get_state())

@app.route('/api/simulation/step', methods=['POST'])
def step_sim():
    body = request.json or {}
    batch_size = body.get('batch_size', 10)
    events = simulator.step(batch_size)
    return jsonify({
        "events": events,
        "state": simulator.get_state()
    })

@app.route('/api/simulation/reset', methods=['POST'])
def reset_sim():
    # To reset, just mark uninitialized or clear out. We can just re-init with default.
    simulator.is_initialized = False
    simulator.nodes = []
    simulator.processes = []
    return jsonify({"message": "Simulation reset"})

if __name__ == '__main__':
    print("Starting NUMA Simulator Server on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
