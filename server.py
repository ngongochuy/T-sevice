import hashlib
import hmac
import html
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from http.cookies import CookieError, SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, quote
from wsgiref.simple_server import make_server


ROOT = Path(__file__).resolve().parent
DEV = os.getenv("TD_LOCAL_DEMO") == "1"
EMAIL = os.getenv("TD_ADMIN_EMAIL", "admin@tdservice.vn")
PASSWORD = os.getenv("TD_ADMIN_PASSWORD", "")
DB_PATH = Path(os.getenv("TD_DB_PATH", str(ROOT / ".data" / "support.sqlite3")))
COOKIE = "td_admin"
SESSION_TTL = 8 * 3600
EQUIPMENT = {"Thang máy", "Biến tần", "Điện mặt trời", "Khác"}
STATUS = {"new": "Mới", "working": "Đang xử lý", "done": "Đã xử lý"}
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
DOCUMENT_SIGNATURES = {
    ".pdf": b"%PDF-", ".docx": b"PK\x03\x04",
    ".xlsx": b"PK\x03\x04", ".pptx": b"PK\x03\x04",
}


def open_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(open_db()) as db, db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY, created TEXT NOT NULL, customer TEXT NOT NULL,
                phone TEXT NOT NULL, equipment TEXT NOT NULL, description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new'
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY, filename TEXT NOT NULL, content BLOB NOT NULL
            );
        """)


def respond(start, status, body="", content_type="text/html; charset=utf-8", headers=()):
    if isinstance(body, str):
        body = body.encode("utf-8")
    start(status, [
        ("Content-Type", content_type), ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff"),
        ("Referrer-Policy", "same-origin"), ("X-Frame-Options", "DENY"),
        *headers,
    ])
    return [body]


def json_response(start, status, ok):
    return respond(start, status, json.dumps({"ok": ok}), "application/json")


def read_form(env):
    if env.get("CONTENT_TYPE", "").split(";")[0] != "application/x-www-form-urlencoded":
        raise ValueError("Unsupported form")
    length = int(env.get("CONTENT_LENGTH") or 0)
    if not 0 < length <= 8192:
        raise ValueError("Invalid form length")
    data = env["wsgi.input"].read(length).decode("utf-8")
    return {key: values[0].strip() for key, values in
            parse_qs(data, keep_blank_values=True, max_num_fields=12).items()}


def save_request(env, start):
    try:
        form = read_form(env)
    except ValueError:
        return json_response(start, "400 Bad Request", False)
    name, phone, equipment, description = (
        form.get(key, "") for key in ("customer", "callback", "equipment", "description")
    )
    if (not 1 <= len(name) <= 80 or not 1 <= len(description) <= 500
            or not re.fullmatch(r"0(?:[35789]\d{8}|2\d{9})", phone, re.ASCII)
            or equipment not in EQUIPMENT):
        return json_response(start, "400 Bad Request", False)
    with closing(open_db()) as db, db:
        db.execute(
            "INSERT INTO requests (created, customer, phone, equipment, description) VALUES (?,?,?,?,?)",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"), name, phone, equipment, description),
        )
    return json_response(start, "201 Created", True)


def cookie(value, age):
    secure = "" if DEV else "; Secure"
    return f"{COOKIE}={value}; Path=/admin; Max-Age={age}; HttpOnly; SameSite=Strict{secure}"


def digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_session(env, db):
    cookies = SimpleCookie()
    try:
        cookies.load(env.get("HTTP_COOKIE", ""))
    except CookieError:
        return None
    if COOKIE not in cookies:
        return None
    return db.execute(
        "SELECT * FROM sessions WHERE token=? AND expires>?",
        (digest(cookies[COOKIE].value), int(time.time())),
    ).fetchone()


def redirect(start, location="/admin", headers=()):
    return respond(start, "303 See Other", headers=[("Location", location), *headers])


def page(body, wide=False):
    width = "1050px" if wide else "460px"
    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Quản trị admin | TĐ Technical Service</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#f4f7fa;color:#142235;font:16px/1.55 system-ui,sans-serif}}
header{{background:#102938;color:#fff;padding:18px max(5vw,16px);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}}
header a{{color:inherit}}main{{max-width:{width};margin:32px auto;padding:0 16px}}
section,article{{background:#fff;border:1px solid #dbe5ee;border-radius:14px;padding:20px;margin:12px 0}}
h1,h2,p{{margin:0 0 12px}}h2{{font-size:19px}}label{{display:block;margin:12px 0}}
input,select,button{{font:inherit;padding:8px 11px;border:1px solid #aabac8;border-radius:8px}}
input{{width:100%}}button{{background:#1769aa;color:white;border-color:#1769aa;cursor:pointer}}
small{{color:#4c6070}}.note{{white-space:pre-wrap;overflow-wrap:anywhere}}.error{{color:#932a18}}
</style></head><body><header><strong>TĐ TECHNICAL SERVICE</strong>
<a href="/">Về website</a></header><main>{body}</main></body></html>"""


def login_page(start, failed=False):
    error = '<p class="error" role="alert">Email hoặc mật khẩu chưa đúng.</p>' if failed else ""
    return respond(start, "401 Unauthorized" if failed else "200 OK", page(f"""
        <section><h1>Quản trị admin</h1>{error}
        <form method="post" action="/admin/login">
        <label>Email <input name="email" type="email" autocomplete="username" required></label>
        <label>Mật khẩu <input name="password" type="password" autocomplete="current-password" required></label>
        <button>Đăng nhập</button></form></section>"""))


def login(start, db, form):
    email_ok = hmac.compare_digest(form.get("email", "").encode(), EMAIL.encode())
    password_ok = hmac.compare_digest(form.get("password", "").encode(), PASSWORD.encode())
    if not (email_ok and password_ok):
        return login_page(start, failed=True)
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE expires<=?", (now,))
    db.execute("INSERT INTO sessions VALUES (?,?,?)",
               (digest(token), secrets.token_urlsafe(32), now + SESSION_TTL))
    db.commit()
    return redirect(start, headers=[("Set-Cookie", cookie(token, SESSION_TTL))])


def dashboard(env, start, db, session):
    query = parse_qs(env.get("QUERY_STRING", ""))
    before = query.get("before", [""])[0]
    max_id = int(before) if re.fullmatch(r"[0-9]{1,18}", before) else 2**63 - 1
    rows = db.execute("SELECT * FROM requests WHERE id<? ORDER BY id DESC LIMIT 51", (max_id,)).fetchall()
    entries = []
    for row in rows[:50]:
        request_id = row["id"]
        options = "".join(
            f'<option value="{key}" {"selected" if key == row["status"] else ""}>{label}</option>'
            for key, label in STATUS.items()
        )
        entries.append(f"""
          <article><small>#{request_id} · {html.escape(row['created'])}</small>
          <h2>{html.escape(row['customer'])} · {html.escape(row['equipment'])}</h2>
          <p><a href="tel:{html.escape(row['phone'])}">{html.escape(row['phone'])}</a></p>
          <p class="note">{html.escape(row['description'])}</p>
          <form method="post" action="/admin/status">
          <input type="hidden" name="csrf" value="{session['csrf']}">
          <input type="hidden" name="id" value="{request_id}">
          <label>Trạng thái <select name="status">{options}</select></label>
          <button>Lưu trạng thái</button></form></article>""")
    listing = "".join(entries) or "<p>Chưa có yêu cầu hỗ trợ.</p>"
    more = f'<a href="/admin?before={rows[49]["id"]}">Yêu cầu cũ hơn →</a>' if len(rows) > 50 else ""
    first = '<p><a href="/admin">Về danh sách mới nhất</a></p>' if before else ""
    return respond(start, "200 OK", page(f"""
        <h1>Yêu cầu hỗ trợ</h1><p><a href="/admin/documents">Quản lý tài liệu</a></p>
        <form method="post" action="/admin/logout">
        <input type="hidden" name="csrf" value="{session['csrf']}">
        <button>Đăng xuất</button></form>{first}{listing}{more}""", wide=True))


def documents_page(env, start, db, session, error="", status="200 OK"):
    before = parse_qs(env.get("QUERY_STRING", "")).get("before", [""])[0]
    max_id = int(before) if re.fullmatch(r"[0-9]{1,18}", before) else 2**63 - 1
    rows = db.execute(
        "SELECT id, filename FROM documents WHERE id<? ORDER BY id DESC LIMIT 51", (max_id,)
    ).fetchall()
    entries = "".join(
        f'<li><a href="/admin/documents/{row["id"]}">{html.escape(row["filename"])}</a></li>'
        for row in rows[:50]
    )
    listing = f"<ul>{entries}</ul>" if entries else "<p>Chưa có tài liệu.</p>"
    more = (f'<a href="/admin/documents?before={rows[49]["id"]}">Tài liệu cũ hơn →</a>'
            if len(rows) > 50 else "")
    alert = f'<p class="error" role="alert">{html.escape(error)}</p>' if error else ""
    return respond(start, status, page(f"""
        <p><a href="/admin">Về trang quản trị</a></p>
        <h1>Quản lý tài liệu</h1>
        <section><h2>Thêm tài liệu</h2>{alert}
        <form method="post" action="/admin/documents" enctype="multipart/form-data">
        <input type="hidden" name="csrf" value="{session['csrf']}">
        <label>Tệp PDF, DOCX, XLSX hoặc PPTX (tối đa 20 MB)
        <input type="file" name="document" accept=".pdf,.docx,.xlsx,.pptx" required></label>
        <button>Tải lên</button></form></section>
        <section><h2>Tài liệu đã lưu</h2>{listing}{more}</section>""", wide=True))


def upload_document(env, start, db, session):
    content_type = env.get("CONTENT_TYPE", "")
    try:
        length = int(env.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length > MAX_DOCUMENT_BYTES + 8192:
        return documents_page(env, start, db, session, "Tệp vượt quá 20 MB.", "413 Payload Too Large")
    if not length or length < 0 or not content_type.startswith("multipart/form-data;"):
        return respond(start, "400 Bad Request")
    if not content_type.isascii() or "\r" in content_type or "\n" in content_type:
        return respond(start, "400 Bad Request")

    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\n\r\n".encode("ascii") + env["wsgi.input"].read(length)
    )
    if not message.is_multipart() or message.defects:
        return respond(start, "400 Bad Request")
    parts = {part.get_param("name", header="content-disposition"): part for part in message.iter_parts()}
    csrf = parts.get("csrf")
    if csrf is None or not hmac.compare_digest(csrf.get_payload(decode=True) or b"", session["csrf"].encode()):
        return respond(start, "403 Forbidden")

    document = parts.get("document")
    filename = re.split(r"[/\\]", document.get_filename() or "")[-1].strip() if document else ""
    content = document.get_payload(decode=True) if document else None
    signature = DOCUMENT_SIGNATURES.get(Path(filename).suffix.lower())
    if (not 1 <= len(filename) <= 180 or re.search(r"[\x00-\x1f\x7f]", filename)
            or not content or not signature or not content.startswith(signature)):
        return documents_page(env, start, db, session, "Vui lòng chọn tệp đúng định dạng.", "400 Bad Request")
    if len(content) > MAX_DOCUMENT_BYTES:
        return documents_page(env, start, db, session, "Tệp vượt quá 20 MB.", "413 Payload Too Large")
    db.execute("INSERT INTO documents (filename, content) VALUES (?,?)", (filename, content))
    db.commit()
    return redirect(start, "/admin/documents")


def download_document(start, db, document_id):
    document = db.execute("SELECT filename, content FROM documents WHERE id=?", (document_id,)).fetchone()
    if not document:
        return respond(start, "404 Not Found")
    disposition = "attachment; filename*=UTF-8''" + quote(document["filename"], safe="")
    return respond(start, "200 OK", document["content"], "application/octet-stream",
                   [("Content-Disposition", disposition)])


def admin(env, start, path, method):
    if not DEV and len(PASSWORD) < 16:
        return respond(start, "503 Service Unavailable", page("<h1>Quản trị chưa được cấu hình</h1>"))
    if method == "POST" and env.get("HTTP_SEC_FETCH_SITE") not in (None, "same-origin"):
        return respond(start, "403 Forbidden")
    with closing(open_db()) as db, db:
        session = get_session(env, db)
        if method == "GET" and path == "/admin":
            return dashboard(env, start, db, session) if session else login_page(start)
        if path == "/admin/documents" and method in {"GET", "POST"}:
            if not session:
                return redirect(start) if method == "GET" else respond(start, "403 Forbidden")
            if method == "POST":
                return upload_document(env, start, db, session)
            return documents_page(env, start, db, session)
        download = re.fullmatch(r"/admin/documents/([0-9]{1,18})", path)
        if method == "GET" and download:
            if not session:
                return respond(start, "403 Forbidden")
            return download_document(start, db, int(download[1]))
        if method != "POST" or path not in {"/admin/login", "/admin/logout", "/admin/status"}:
            return respond(start, "404 Not Found")
        if path != "/admin/login" and not session:
            return respond(start, "403 Forbidden")
        try:
            form = read_form(env)
        except ValueError:
            return respond(start, "400 Bad Request")
        if path == "/admin/login":
            return redirect(start) if session else login(start, db, form)
        if not hmac.compare_digest(form.get("csrf", "").encode(), session["csrf"].encode()):
            return respond(start, "403 Forbidden")
        if path == "/admin/logout":
            db.execute("DELETE FROM sessions WHERE token=?", (session["token"],))
            db.commit()
            return redirect(start, headers=[("Set-Cookie", cookie("", 0))])
        request_id, status = form.get("id", ""), form.get("status", "")
        if not re.fullmatch(r"[0-9]{1,18}", request_id) or status not in STATUS:
            return respond(start, "400 Bad Request")
        db.execute("UPDATE requests SET status=? WHERE id=?", (status, int(request_id)))
        db.commit()
        return redirect(start)


def static_file(start, path):
    if path in {"/", "/index.html", "/main.js", "/style.css"}:
        file = ROOT / ("index.html" if path == "/" else path[1:])
    elif re.fullmatch(r"/images/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)", path):
        file = ROOT / path[1:]
    else:
        return respond(start, "404 Not Found")
    if not file.is_file():
        return respond(start, "404 Not Found")
    return respond(start, "200 OK", file.read_bytes(), mimetypes.guess_type(file.name)[0])


def application(env, start):
    path, method = env["PATH_INFO"], env["REQUEST_METHOD"]
    if path == "/api/support":
        if method != "POST":
            return respond(start, "405 Method Not Allowed", headers=[("Allow", "POST")])
        if not DEV and len(PASSWORD) < 16:
            return json_response(start, "503 Service Unavailable", False)
        return save_request(env, start)
    if path == "/admin" or path.startswith("/admin/"):
        return admin(env, start, path, method)
    if method == "GET":
        return static_file(start, path)
    return respond(start, "404 Not Found")


initialize()

if __name__ == "__main__":
    if not DEV or not PASSWORD:
        raise SystemExit("Set TD_LOCAL_DEMO=1 and TD_ADMIN_PASSWORD for localhost.")
    with make_server("127.0.0.1", 5502, application) as server:
        print("http://127.0.0.1:5502")
        server.serve_forever()
