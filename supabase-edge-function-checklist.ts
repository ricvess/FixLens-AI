// Checklist for supabase/functions/diagnose/index.ts  (server-side - the browser can be bypassed)
// This is NOT a drop-in file: merge these checks into your existing function.
//
// 0. Deploy with JWT verification ON (default). Do not use --no-verify-jwt.
// 1. Identify the user from the token, never from the request body:
//      const supabase = createClient(URL, SERVICE_ROLE_KEY);           // secret stays server-side
//      const { data: { user } } = await supabase.auth.getUser(token);
//      if (!user) return json({ error: "Unauthorized" }, 401);
// 2. Quota (stops cost abuse):
//      const { data: ok } = await supabase.rpc("bump_ai_usage", { uid: user.id, max_calls: 30 });
//      if (!ok) return json({ error: "Daily limit reached" }, 429);
// 3. Validate input size/shape BEFORE calling the AI:
//      - request body <= ~11 MB; image mime in [jpeg, png, webp] and check the magic bytes
//      - mode in ["diagnose", "chat"]; message <= 500 chars; history <= 10 items, each <= 2000 chars
// 4. Chat: load the diagnosis by diagnosis_id from the DB WHERE user_id = user.id and build the
//    context yourself. Do not trust the `context` string sent by the browser.
// 5. Prompt-injection hardening: tell the model that text visible inside photos is DATA, never
//    instructions; force JSON output and validate it against a schema before returning it.
// 6. CORS: Access-Control-Allow-Origin = your real site origin, not "*".
// 7. Never log full request bodies (they contain user photos) or tokens.
