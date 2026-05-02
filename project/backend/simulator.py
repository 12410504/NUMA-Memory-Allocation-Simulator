import random

class Node:
    def __init__(self, node_id, capacity):
        self.id = node_id
        self.capacity = capacity
        self.used = 0

    def allocate(self):
        if self.used < self.capacity:
            self.used += 1
            return True
        return False

    def to_dict(self):
        return {
            "id": self.id,
            "capacity": self.capacity,
            "used": self.used,
            "utilization": round((self.used / self.capacity) * 100, 2) if self.capacity > 0 else 0
        }

class Process:
    def __init__(self, pid, cpu_node):
        self.id = pid
        self.cpu_node = cpu_node
        self.pages = [] # List of node IDs where pages are stored

    def to_dict(self):
        return {
            "id": self.id,
            "cpu_node": self.cpu_node,
            "pages_count": len(self.pages)
        }

class Simulator:
    def __init__(self):
        self.nodes = []
        self.processes = []
        self.policy = "local"
        self.latencies = {"local": 10, "remote": 50}
        self.stats = {
            "total_accesses": 0,
            "total_latency": 0,
            "local_accesses": 0,
            "remote_accesses": 0
        }
        self.is_initialized = False

    def init_simulation(self, config):
        node_count = config.get("nodes", 4)
        node_capacity = config.get("node_capacity", 1000)
        process_count = config.get("processes", 10)
        pages_per_process = config.get("pages_per_process", 100)
        
        self.policy = config.get("policy", "local")
        self.latencies = config.get("latencies", {"local": 10, "remote": 50})
        
        # Reset state
        self.nodes = [Node(i, node_capacity) for i in range(node_count)]
        self.processes = []
        self.stats = {
            "total_accesses": 0,
            "total_latency": 0,
            "local_accesses": 0,
            "remote_accesses": 0
        }

        # Create processes and allocate memory
        for pid in range(process_count):
            cpu_node = random.randint(0, node_count - 1)
            process = Process(pid, cpu_node)
            
            # Allocate pages based on policy
            for i in range(pages_per_process):
                target_node = -1
                
                if self.policy == "local":
                    # Try local first
                    if self.nodes[cpu_node].allocate():
                        target_node = cpu_node
                    else:
                        # Fallback to random with available capacity
                        available = [n for n in self.nodes if n.used < n.capacity]
                        if available:
                            n = random.choice(available)
                            n.allocate()
                            target_node = n.id
                            
                elif self.policy == "random":
                    available = [n for n in self.nodes if n.used < n.capacity]
                    if available:
                        n = random.choice(available)
                        n.allocate()
                        target_node = n.id
                        
                elif self.policy == "interleaved":
                    # Round robin across nodes
                    idx = i % node_count
                    if self.nodes[idx].allocate():
                        target_node = idx
                    else:
                        # Fallback to random
                        available = [n for n in self.nodes if n.used < n.capacity]
                        if available:
                            n = random.choice(available)
                            n.allocate()
                            target_node = n.id

                if target_node != -1:
                    process.pages.append(target_node)
            
            self.processes.append(process)

        self.is_initialized = True

    def get_state(self):
        avg_latency = 0
        if self.stats["total_accesses"] > 0:
            avg_latency = self.stats["total_latency"] / self.stats["total_accesses"]
            
        return {
            "initialized": self.is_initialized,
            "nodes": [n.to_dict() for n in self.nodes],
            "stats": {
                **self.stats,
                "average_latency": round(avg_latency, 2)
            },
            "config": {
                "policy": self.policy,
                "latencies": self.latencies
            }
        }

    def step(self, batch_size=10):
        if not self.is_initialized or not self.processes:
            return []

        events = []
        for _ in range(batch_size):
            # Pick a random process
            process = random.choice(self.processes)
            if not process.pages:
                continue
                
            # Pick a random page from its allocated pages
            target_node = random.choice(process.pages)
            
            # Determine latency
            is_local = (target_node == process.cpu_node)
            latency = self.latencies["local"] if is_local else self.latencies["remote"]
            
            # Update stats
            self.stats["total_accesses"] += 1
            self.stats["total_latency"] += latency
            if is_local:
                self.stats["local_accesses"] += 1
            else:
                self.stats["remote_accesses"] += 1
                
            events.append({
                "process_id": process.id,
                "cpu_node": process.cpu_node,
                "target_node": target_node,
                "is_local": is_local,
                "latency": latency
            })
            
        return events
