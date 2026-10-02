#!/usr/bin/env python3
"""Get COS upload credential and PUT the zip to COS, then stash confirmKey/taskId."""
import subprocess, json, sys, os, urllib.request

SPACE_API = "C:/Users/pansh/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library/space_api.py"
SPACE_ID = "5AIqYdukawlvZknFlh6FKX"
FOLDER_ID = "J33ARDzxQFMNGPmhnfJWEP"
ZIP = "C:/Users/pansh/AppData/Local/Temp/email-verifier-mcp-v1.0.0.zip"
FNAME = "email-verifier-mcp-v1.0.0.zip"

zsize = os.path.getsize(ZIP)
proc = subprocess.run([sys.executable, SPACE_API, "space.importer.get-upload-credential",
    "--file-name", FNAME, "--file-size", str(zsize), "--parent-id", FOLDER_ID],
    capture_output=True, text=True)
if proc.returncode != 0:
    print("CRED_ERR:", proc.stderr[:800]); sys.exit(1)
cred = json.loads(proc.stdout)
data = cred["data"]
upload_url = data["uploadUrl"]
headers = dict(data["headers"])
confirm_key = data["confirmKey"]
task_id = data["taskId"]
print("GOT_CREDENTIAL taskId=", task_id)

# match COS signature header list (host;x-cos-acl;x-cos-storage-class)
headers["Content-Type"] = "application/octet-stream"

with open(ZIP, "rb") as f:
    body = f.read()

req = urllib.request.Request(upload_url, data=body, method="PUT")
for k, v in headers.items():
    req.add_header(k, v)

try:
    resp = urllib.request.urlopen(req, timeout=90)
    print("PUT_STATUS:", resp.status, "BODY:", resp.read()[:120])
except urllib.error.HTTPError as e:
    print("PUT_HTTP_ERROR:", e.code, e.read()[:500]); sys.exit(1)
except Exception as e:
    print("PUT_ERR:", repr(e)); sys.exit(1)

meta = {"confirmKey": confirm_key, "taskId": task_id, "spaceId": SPACE_ID,
        "parentId": FOLDER_ID, "fileName": FNAME, "title": "email-verifier-mcp v1.0.0"}
with open("C:/Users/pansh/AppData/Local/Temp/upload_meta.json", "w", encoding="utf-8") as mf:
    json.dump(meta, mf, ensure_ascii=False)
print("META_WRITTEN")
