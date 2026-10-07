import { totp } from "otplib";
import base32Encode from "base32-encode";
import { net } from "electron";
import Logger from "../library/logger.js";


// Your server time method (kept as-is)
async function getServerTime() {
  const response = await net.fetch("https://open.spotify.com");
  const html = await response.text();

  const match = html.match(/<script id="appServerConfig" type="text\/plain">([^<]+)<\/script>/);
  if (!match) throw new Error("Server config not found");

  const config = JSON.parse(Buffer.from(match[1], "base64").toString());
  return config.serverTime; // seconds
}

// Spotube-style ciphered bytes
function getSecretCipherBytes() {
  const original = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54];
  return original.map((e, t) => e ^ ((t % 33) + 9));
}

// Convert bytes to base32
function getBase32Secret() {
  const bytes = Uint8Array.from(getSecretCipherBytes());
  return base32Encode(bytes, "RFC4648", { padding: false });
}

// Final TOTP generator
export async function generateTotp() {
  const serverTime = await getServerTime();
  const secret = getBase32Secret();

  Logger.log("TOTP", "server time", serverTime)
  totp.options = {
    step: 30,
    digits: 6,
    epoch: serverTime * 1000, // serverTime is in seconds
  };

  return totp.generate(secret);
}
