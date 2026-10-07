"""One genuine ipykernel per conversation, in its own Python worker.

The in-process Jupyter transport uses message queues instead of network sockets;
the worker process isolates each kernel from other conversations.
"""
import json
import os
import queue
import sys
import time
from ipykernel.inprocess.manager import InProcessKernelManager

os.chdir(sys.argv[1])
os.environ["MPLBACKEND"] = "module://matplotlib_inline.backend_inline"
km = InProcessKernelManager()
km.start_kernel()
client = km.client()
client.start_channels()
client.wait_for_ready()

def execute(code):
    msg_id = client.execute(code, stop_on_error=True)
    outputs, count = [], None
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        try:
            msg = client.get_iopub_msg(timeout=1)
        except queue.Empty:
            continue
        if msg.get("parent_header", {}).get("msg_id") != msg_id:
            continue
        kind, c = msg["header"]["msg_type"], msg["content"]
        if kind == "execute_input":
            count = c["execution_count"]
        elif kind == "stream":
            outputs.append({"output_type": kind, "name": c["name"], "text": c["text"]})
        elif kind in ("display_data", "execute_result"):
            o = {"output_type": kind, "data": c["data"], "metadata": c.get("metadata", {})}
            if kind == "execute_result":
                o["execution_count"] = c["execution_count"]
            outputs.append(o)
        elif kind == "error":
            outputs.append({"output_type": "error", "ename": c["ename"], "evalue": c["evalue"], "traceback": c["traceback"]})
        elif kind == "clear_output":
            outputs.clear()
        elif kind == "status" and c["execution_state"] == "idle":
            return {"outputs": outputs, "execution_count": count, "ok": not any(o["output_type"] == "error" for o in outputs)}
    raise TimeoutError("Cell exceeded five minutes; kernel interrupted")

print(json.dumps({"ready": True, "python": sys.version.split()[0], "pid": os.getpid()}), flush=True)
try:
    for line in sys.stdin:
        try:
            req = json.loads(line)
            result = execute(req["code"])
            print(json.dumps({"id": req["id"], **result}), flush=True)
        except Exception as e:
            print(json.dumps({"id": req.get("id"), "error": str(e)}), flush=True)
finally:
    client.stop_channels()
    km.shutdown_kernel(now=True)
