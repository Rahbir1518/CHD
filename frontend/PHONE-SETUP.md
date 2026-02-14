# Make the app work on your phone (vibration + camera, no “Proceed anyway”)

You can use **ngrok** (easiest, no certs on the phone) or **mkcert** (LAN-only, install CA on phone).

---

## Option A: Ngrok (recommended — no phone setup)

Ngrok gives you public HTTPS URLs. The phone trusts them; no “Proceed anyway” and no certificate install.

### 1. Install ngrok

- Download from [ngrok.com](https://ngrok.com/download) or: `choco install ngrok`
- Sign up at [ngrok.com](https://ngrok.com), then add your auth token:  
  `ngrok config add-authtoken YOUR_TOKEN`

### 2. Start the app and ngrok

**Terminal 1 — Backend:**
```bash
cd c:\CHD\CHD\backend
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd c:\CHD\CHD\frontend
npm run dev
```

**Terminal 3 — Ngrok (both tunnels):**
```bash
cd c:\CHD\CHD
ngrok start --config ngrok.yml --all
```

Ngrok will show two URLs (often truncated in the terminal). To see them clearly:
- Open **http://127.0.0.1:4040** in your PC browser — the ngrok inspector shows each tunnel’s full URL and which port (3000 = frontend, 8000 = backend).
- Or check the terminal: the **first** Forwarding line is usually **frontend** (3000), the **second** is **backend** (8000).

### 3. Use the app on your phone

1. On the phone, open the **frontend** URL and go to the student page:  
   **`https://YOUR-FRONTEND-URL.ngrok-free.app/student`**  
   (Replace with the actual “frontend” URL from the ngrok terminal.)

2. In the app, set **Server Address** to the **backend** WebSocket URL:  
   **`wss://YOUR-BACKEND-URL.ngrok-free.app/ws/video`**  
   (Use the “backend” ngrok URL; no port number — ngrok uses 443.)

3. Tap **Connect**, then **Test vibration**, then **Start Camera + Mic**.  
   You should get no certificate warning and vibration should work.

**Note:** Free ngrok may show a one-time “Visit Site” interstitial the first time you open the URL in a browser; click through it.

---

## Option B: mkcert (LAN only — phone must be on same Wi‑Fi)

Follow these steps once so your phone **trusts** the dev server and the app works without certificate warnings.

### 1. Install mkcert (one-time)

- **Windows (PowerShell as Admin):**  
  `choco install mkcert`  
  or: [mkcert releases](https://github.com/FiloSottile/mkcert/releases) — download `mkcert-v*-windows-amd64.exe`, rename to `mkcert.exe`, put it in your PATH.

- Then run:  
  `mkcert -install`

### 2. Create a certificate for your PC’s LAN IP

Use your PC’s IP (the one the phone uses to reach the dev server, e.g. `10.205.95.193`).

From the repo root or from `frontend`:

```powershell
cd frontend
.\scripts\setup-https-for-phone.ps1 10.205.95.193
```

Replace `10.205.95.193` with your actual LAN IP if different. The script will:

- Create a certificate valid for that IP and `localhost`
- Put it in `frontend/certificates/` (as `localhost.pem` and `localhost-key.pem`)
- Create `frontend/certificates/rootCA-for-android.der.crt` for your phone (if OpenSSL is available)

If you don’t have OpenSSL, the script will print an alternative command; or you can copy the root CA from mkcert’s folder and convert it (see step 3).

### 3. Install the root CA on your Android phone

So the phone trusts your dev server’s HTTPS certificate:

1. Copy **`frontend/certificates/rootCA-for-android.der.crt`** to your phone (email, USB, cloud, etc.).
2. On the phone: **Settings → Security → Encryption & credentials → Install a certificate → CA certificate**.
3. Choose **Install anyway** if warned, then pick `rootCA-for-android.der.crt`.

If you don’t have `rootCA-for-android.der.crt` (no OpenSSL), get the root CA from mkcert and convert it:

- Run: `mkcert -CAROOT`  
  It prints a path, e.g. `C:\Users\You\AppData\Local\mkcert`.
- In that folder there is `rootCA.pem`. Convert it to DER and copy to the phone:
  - Git Bash or WSL:  
    `openssl x509 -inform PEM -outform DER -in "PATH_FROM_MKCERT/rootCA.pem" -out frontend/certificates/rootCA-for-android.der.crt`
  - Then copy `rootCA-for-android.der.crt` to the phone and install it as in step 2.

### 4. Run the app and open it on the phone

1. **Backend:**  
   `python main.py`  
   (from the folder where `main.py` is)

2. **Frontend:**  
   `cd frontend`  
   `npm run dev`

   The dev server listens on `0.0.0.0`, so the phone can reach it at your PC’s LAN IP.

3. **On the phone (same Wi‑Fi):**
   - Open Chrome (or another browser).
   - Go to: **`https://10.205.95.193:3000/student`**  
     (use your real LAN IP if different).
   - You should **not** see a certificate warning; the connection is trusted.
   - Tap **“Test vibration”** — the phone should vibrate.
   - Tap **“Start Camera + Mic”** — allow camera/mic when asked, then speak; you should feel vibration when you talk.

If you still get a certificate warning, the phone hasn’t trusted the CA: repeat step 3 and make sure you installed **rootCA-for-android.der.crt** (or the converted `rootCA.pem`) as a **CA certificate**, not as a normal file.
