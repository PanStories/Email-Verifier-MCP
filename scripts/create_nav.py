#!/usr/bin/env python3
import subprocess, sys
LIB = "C:/Users/pansh/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/library/space_api.py"
md = open("C:/Users/pansh/AppData/Local/Temp/nav-email-verifier.md", encoding="utf-8").read()
r = subprocess.run([sys.executable, LIB, "space.importer.create-doc",
    "--space-id", "5AIqYdukawlvZknFlh6FKX", "--parent-id", "J33ARDzxQFMNGPmhnfJWEP",
    "--title", "email-verifier-mcp 说明 (v1.0.0)", "--markdown", md],
    capture_output=True, text=True)
print("STDOUT:", r.stdout[:900])
print("STDERR:", r.stderr[:400])
