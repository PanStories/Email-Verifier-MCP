#!/usr/bin/env python3
"""Bundle the email-verifier-mcp project into a clean zip (no node_modules/dist/.git)."""
import os
import zipfile

SRC = "C:/Users/pansh/WorkBuddy/6. Ideas/email-verifier-mcp"
OUT = "C:/Users/pansh/WorkBuddy/6. Ideas/email-verifier-mcp/email-verifier-mcp-v1.0.0.zip"
ROOT = "email-verifier-mcp-v1.0.0"

EXCLUDE_DIRS = {"node_modules", "dist", ".git", ".workbuddy", "coverage", ".vitest", "__pycache__"}
EXCLUDE_FILES = {".env", ".DS_Store"}
EXCLUDE_SUFFIX = (".log",)

count = 0
size = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(SRC):
        # prune excluded dirs in place
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn in EXCLUDE_FILES or fn.endswith(EXCLUDE_SUFFIX):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SRC)
            arc = f"{ROOT}/{rel}".replace(os.sep, "/")
            zf.write(full, arc)
            count += 1
            size += os.path.getsize(full)

print(f"ZIP_READY\t{OUT}\t{count} files\t{size} bytes raw")
