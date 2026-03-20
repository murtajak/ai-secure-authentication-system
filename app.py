from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import requests
import json
import urllib.parse
import os
import re
import openai

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Use env vars (do NOT hardcode keys)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
HIBP_API_KEY = os.getenv("HIBP_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2")

AI_PROVIDER = "openai"
HIBP_API_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/"
HIBP_USER_AGENT = "Password-Security-Validator"

# --- HELPER: Statistics Tracker ---
def track_total_attempt():
    try:
        r.incr("stats:total")
    except Exception as e:
        print(f"Stats Total Error: {e}")

def track_stat(stat_type, extra_data=None):
    """
    Increments counters in Redis for the dashboard.
    Supports breach leaderboards for passwords (redis Bloom filters), emails, and phones.
    """
    try:
        r.incr(f"stats:{stat_type}")

        if stat_type == "blocked_redis" and extra_data:
            for breach_name in extra_data:
                r.zincrby("stats:breach_leaderboard", 1, breach_name)

        if stat_type == "emails_breached" and extra_data:
            for breach_name in extra_data:
                r.zincrby("stats:email_breach_leaderboard", 1, breach_name)

        if stat_type == "phones_breached" and extra_data:
            for breach_name in extra_data:
                r.zincrby("stats:phone_breach_leaderboard", 1, breach_name)

    except Exception as e:
        print(f"Stats Error: {e}")

# --- LAYER 1: Redis Breach Check (Password) ---
def check_redis_databases(password):
    found_in_breaches = []
    try:
        breach_keys = []
        for key in r.scan_iter("leak:*"):
            breach_keys.append(key)

        for db_key in breach_keys:
            if r.execute_command("BF.EXISTS", db_key, password) == 1:
                found_in_breaches.append(db_key.replace("leak:", ""))

        return found_in_breaches
    except Exception as e:
        print(f"Redis Error: {e}")
        return []

# --- HIBP HELPERS (Email + Phone use same endpoint) ---
def _hibp_headers():
    return {
        "hibp-api-key": HIBP_API_KEY,
        "User-Agent": HIBP_USER_AGENT
    }

def normalize_phone(raw_phone: str) -> str:
    """
    Turn "(555) 123-4567" -> "15551234567" (assume US if 10 digits)
    Keep country-code style digits for international.
    NOTE: HIBP's most common usage is email/username; phone matches may or may not exist.
    """
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", raw_phone)

    # If user typed just 10 digits, assume North America country code "1"
    if len(digits) == 10:
        return "1" + digits

    return digits

def check_account_breaches(account: str):
    """
    Generic HIBP breach check for email OR phone (or usernames).
    Returns: (breach_count, breach_list, error_message)
    """
    try:
        account = (account or "").strip()
        if not account:
            return 0, [], None

        if not HIBP_API_KEY:
            return None, [], "HIBP API key missing on server (set HIBP_API_KEY)."

        encoded = urllib.parse.quote(account, safe="")  # URL-encode
        response = requests.get(
            f"{HIBP_API_URL}{encoded}",
            headers=_hibp_headers(),
            timeout=6
        )

        if response.status_code == 200:
            breaches = response.json()
            breach_names = [b.get("Name") for b in breaches if b.get("Name")]
            return len(breach_names), breach_names, None

        if response.status_code == 404:
            return 0, [], None

        if response.status_code == 429:
            retry_after = response.headers.get("retry-after") or response.headers.get("Retry-After")
            if retry_after:
                return None, [], f"Rate limit exceeded. Try again in ~{retry_after}s."
            return None, [], "Rate limit exceeded. Please try again in a moment."

        if response.status_code in (401, 403):
            return None, [], "HIBP auth failed (check API key + User-Agent)."

        return None, [], f"HIBP API error: {response.status_code}"

    except requests.exceptions.Timeout:
        return None, [], "HIBP API timeout"
    except Exception as e:
        print(f"HIBP Error: {e}")
        return None, [], "HIBP service temporarily unavailable"

# --- LAYER 2: AI Logic ---
def get_ai_verdict(profile, password):
    system_prompt = """
You are an expert Social Engineering Penetration Tester.
Analyze if the password is predictable based on the user's PII.
Rules: Check for names, dates, leetspeak, and patterns.
Return JSON: {"risky": boolean, "reason": "string"}
"""
    user_prompt = f"User Profile: {json.dumps(profile)}\nTarget Password: '{password}'\nIs this risky?"

    try:
        if AI_PROVIDER == "openai":
            if not OPENAI_API_KEY:
                return False, "AI Unavailable (missing OPENAI_API_KEY)"

            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return bool(result.get("risky", False)), result.get("reason", "Predictable pattern detected")

    except Exception as e:
        print(f"AI Error: {e}")
        return False, "AI Unavailable"

    return False, "Safe"

def get_ai_passphrase_suggestions(profile, blocked_password, count=5, min_length=15):
    """
    Ask the AI to generate strong passphrases.
    Returns: list[str]
    """
    system_prompt = f"""
You generate secure passphrases for users.

Requirements:
- Return ONLY valid JSON: {{"suggestions": ["...", "..."]}}
- Generate exactly {count} unique passphrases.
- Each must be length >= {min_length}.
- Format: 3-5 words separated by hyphens, then add a number and a symbol at the end.
  Example: "orbit-cobalt-vector-29!"
- Do NOT use any words from the user's profile (names, colors, dates, etc).
- Do NOT include the blocked password or anything too similar.
- Avoid common weak phrases like "password", "qwerty", "letmein".
"""
    user_prompt = f"""
User profile (do NOT use these words): {json.dumps(profile)}
Blocked password (do NOT use or mimic): {blocked_password}
Generate suggestions now.
"""

    try:
        if AI_PROVIDER == "openai":
            if not OPENAI_API_KEY:
                return []

            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            data = json.loads(response.choices[0].message.content)
            suggestions = data.get("suggestions", [])

            clean = []
            seen = set()
            for s in suggestions:
                if isinstance(s, str):
                    s2 = s.strip()
                    if len(s2) >= min_length and s2 not in seen:
                        clean.append(s2)
                        seen.add(s2)
            return clean[:count]

    except Exception as e:
        print(f"AI Suggestion Error: {e}")
        return []

    return []

# --- API: SIGNUP (Main Logic) ---
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json or {}
    pw = (data.get("password", "") or "").strip()
    email = (data.get("email", "") or "").strip()
    phone_raw = (data.get("phone", "") or "").strip()
    phone = normalize_phone(phone_raw)

    # Count attempt once
    track_total_attempt()

    # Build PII profile once
    user_profile = {
        "First Name": data.get("fname"),
        "Last Name": data.get("lname"),
        "Mother": data.get("mother_name"),
        "Son": data.get("eldest_son"),
        "Favorite Color": data.get("favorite_color"),
        "Birth Year": data.get("dob")
    }
    user_profile = {k: v for k, v in user_profile.items() if v}

    # 1) REDIS CHECK
    breaches = check_redis_databases(pw)
    if breaches:
        track_stat("blocked_redis", extra_data=breaches)
        suggestions = get_ai_passphrase_suggestions(user_profile, pw, count=5, min_length=15)
        breach_str = ", ".join(breaches)

        return jsonify({
            "valid": False,
            "error": f"⚠️ Found in data breaches: {breach_str}",
            "suggestions": suggestions
        }), 400

    # 2) AI CHECK
    is_risky, reason = get_ai_verdict(user_profile, pw)
    if is_risky:
        track_stat("blocked_ai")
        suggestions = get_ai_passphrase_suggestions(user_profile, pw, count=5, min_length=15)

        return jsonify({
            "valid": False,
            "error": f"🤖 Weak Password Detected: {reason}",
            "suggestions": suggestions
        }), 400

    # 3) EMAIL HIBP CHECK (non-blocking)
    email_breach_count, email_breaches, email_error = (0, [], None)
    if email:
        track_stat("emails_checked")
        email_breach_count, email_breaches, email_error = check_account_breaches(email)
        if email_breach_count is not None and email_breach_count > 0:
            track_stat("emails_breached", extra_data=email_breaches)

    # 4) PHONE HIBP CHECK (non-blocking)
    phone_breach_count, phone_breaches, phone_error = (0, [], None)
    if phone:
        track_stat("phones_checked")
        phone_breach_count, phone_breaches, phone_error = check_account_breaches(phone)
        if phone_breach_count is not None and phone_breach_count > 0:
            track_stat("phones_breached", extra_data=phone_breaches)

    # 5) SUCCESS
    track_stat("success")

    return jsonify({
        "valid": True,
        "message": "Account created securely!",
        "email_breach_info": {
            "breach_count": email_breach_count if email_breach_count is not None else 0,
            "breaches": (email_breaches or [])[:10],
            "error": email_error
        },
        "phone_breach_info": {
            "breach_count": phone_breach_count if phone_breach_count is not None else 0,
            "breaches": (phone_breaches or [])[:10],
            "error": phone_error,
            "normalized_phone": phone
        }
    })

# --- API: DASHBOARD STATS ---
@app.route("/api/stats", methods=["GET"])
def get_stats():
    try:
        total = int(r.get("stats:total") or 0)
        blocked_redis = int(r.get("stats:blocked_redis") or 0)
        blocked_ai = int(r.get("stats:blocked_ai") or 0)
        success = int(r.get("stats:success") or 0)

        emails_checked = int(r.get("stats:emails_checked") or 0)
        emails_breached = int(r.get("stats:emails_breached") or 0)

        phones_checked = int(r.get("stats:phones_checked") or 0)
        phones_breached = int(r.get("stats:phones_breached") or 0)

        top_breaches = r.zrevrange("stats:breach_leaderboard", 0, 4, withscores=True)
        leaderboard = [{"name": name, "count": int(score)} for name, score in top_breaches]

        top_email_breaches = r.zrevrange("stats:email_breach_leaderboard", 0, 4, withscores=True)
        email_leaderboard = [{"name": name, "count": int(score)} for name, score in top_email_breaches]

        top_phone_breaches = r.zrevrange("stats:phone_breach_leaderboard", 0, 4, withscores=True)
        phone_leaderboard = [{"name": name, "count": int(score)} for name, score in top_phone_breaches]

        return jsonify({
            "total": total,
            "breakdown": {
                "redis": blocked_redis,
                "ai": blocked_ai,
                "success": success,
                "emails_checked": emails_checked,
                "emails_breached": emails_breached,
                "phones_checked": phones_checked,
                "phones_breached": phones_breached
            },
            "leaderboard": leaderboard,
            "email_leaderboard": email_leaderboard,
            "phone_leaderboard": phone_leaderboard
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)

