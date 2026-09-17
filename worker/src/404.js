// ── Custom 404 page ────────────────────────────────────────────

export function notFoundPage(env) {
  const telegramUrl = 'https://t.me/shortul';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link not found — ShorTul</title>
<meta name="robots" content="noindex">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);
    color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;
    text-align:center;padding:1rem}
  .container{max-width:480px}
  .logo{font-size:2rem;font-weight:800;background:linear-gradient(135deg,#f59e0b,#ef4444,#ec4899);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
  .code{font-size:6rem;font-weight:900;line-height:1;
    background:linear-gradient(135deg,#f59e0b,#ec4899);-webkit-background-clip:text;
    -webkit-text-fill-color:transparent;margin-bottom:0.5rem}
  .msg{font-size:1.1rem;color:#94a3b8;margin-bottom:2rem}
  .btn{display:inline-block;padding:0.875rem 2rem;font-size:1rem;font-weight:600;
    background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;border:none;
    border-radius:12px;text-decoration:none;cursor:pointer;transition:transform .2s}
  .btn:hover{transform:translateY(-2px)}
  .home{margin-top:1.5rem;display:block;color:#60a5fa;text-decoration:none}
</style>
</head>
<body>
  <div class="container">
    <div class="logo">ShorTul</div>
    <div class="code">404</div>
    <p class="msg">This short link doesn't exist or has expired.</p>
    <a href="${telegramUrl}" class="btn" rel="noopener noreferrer">Visit ShorTul on Telegram</a>
    <a href="/" class="home">← Go to ShorTul</a>
  </div>
</body>
</html>`;
}
