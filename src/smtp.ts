/**
 * smtp.ts — optional SMTP handshake ("SMTP ping").
 *
 * Connects to the target MX on port 25, performs a minimal
 * EHLO -> MAIL FROM -> RCPT TO conversation, and reads the response code
 * WITHOUT sending any mail. This probes (a) whether the MX is reachable
 * and (b) whether the mailbox *likely* exists (250 on RCPT TO).
 *
 * IMPORTANT — compliance: many mail servers throttle or block unsolicited
 * SMTP probes, and some providers treat outbound port-25 probing as
 * "scanning". This check is OPT-IN and OFF by default. The hosted $19/mo
 * tier runs it from warmed/rotating IPs the operator controls; the OSS
 * build expects the caller to enable it only from their own infrastructure.
 */

import net from "node:net";

export interface SmtpResult {
  reachable: boolean;
  code: number | null;
  message: string;
  likelyValid: boolean | null;
}

const CONNECT_TIMEOUT = 7000;
const STEP_TIMEOUT = 5000;

function sendCommand(
  socket: net.Socket,
  command: string,
  timeoutMs: number,
): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("SMTP step timeout"));
      }
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      // SMTP replies may be multi-line; the last line has no dash after code.
      const lines = buffer.split(/\r?\n/).filter((l) => l.length > 0);
      const last = lines[lines.length - 1] ?? "";
      const m = last.match(/^(\d{3})([- ])(.*)$/);
      if (m && m[2] === " ") {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.removeListener("data", onData);
          resolve({ code: parseInt(m[1], 10), text: last.trim() });
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onErr);
    };
    const onErr = (e: Error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(e);
      }
    };

    socket.on("data", onData);
    socket.on("error", onErr);
    socket.write(command + "\r\n");
  });
}

/**
 * Probe the MX for a given recipient. Returns reachable=false on any
 * failure so the caller can degrade gracefully (DNS result still stands).
 */
export async function smtpHandshake(
  mxExchange: string,
  domain: string,
  recipientLocal: string,
): Promise<SmtpResult> {
  const fallback: SmtpResult = {
    reachable: false,
    code: null,
    message: "SMTP handshake skipped or failed",
    likelyValid: null,
  };

  const socket = net.createConnection({ host: mxExchange, port: 25, timeout: CONNECT_TIMEOUT });

  try {
    // 1) Banner
    await waitForBanner(socket);
    // 2) EHLO
    const ehlo = await sendCommand(socket, `EHLO verify.local`, STEP_TIMEOUT);
    if (ehlo.code !== 250) throw new Error(`EHLO ${ehlo.code}`);
    // 3) MAIL FROM
    const mail = await sendCommand(
      socket,
      `MAIL FROM:<probe@${domain}>`,
      STEP_TIMEOUT,
    );
    if (mail.code !== 250) throw new Error(`MAIL FROM ${mail.code}`);
    // 4) RCPT TO
    const rcpt = await sendCommand(
      socket,
      `RCPT TO:<${recipientLocal}@${domain}>`,
      STEP_TIMEOUT,
    );
    // 5) Best-effort QUIT (ignore errors)
    try {
      socket.write("QUIT\r\n");
    } catch {
      /* ignore */
    }
    const reachable = true;
    const likelyValid = rcpt.code === 250 ? true : rcpt.code === 550 || rcpt.code === 551 ? false : null;
    return {
      reachable,
      code: rcpt.code,
      message: rcpt.text,
      likelyValid,
    };
  } catch (err: any) {
    fallback.message = `SMTP handshake failed: ${err?.message ?? err}`;
    return fallback;
  } finally {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  }
}

function waitForBanner(socket: net.Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("SMTP banner timeout"));
      }
    }, CONNECT_TIMEOUT);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const m = text.match(/^(\d{3})([- ])(.*)$/);
      if (m && m[1] === "220" && m[2] === " ") {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.removeListener("data", onData);
          resolve();
        }
      }
    };
    const onErr = (e: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    };
    socket.on("data", onData);
    socket.on("error", onErr);
  });
}
