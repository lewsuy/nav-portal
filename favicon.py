import os
import hashlib
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.packages.urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

ICON_DIR = os.path.join(os.path.dirname(__file__), "static", "icons")
TIMEOUT = 4
HEADERS = {"User-Agent": "Mozilla/5.0 (nav-portal icon fetcher)"}


def _save(content, url):
    os.makedirs(ICON_DIR, exist_ok=True)
    ext = ".png"
    lower = url.lower()
    for candidate in (".ico", ".png", ".svg", ".jpg", ".jpeg", ".gif"):
        if candidate in lower:
            ext = candidate
            break
    filename = hashlib.md5(url.encode("utf-8")).hexdigest() + ext
    path = os.path.join(ICON_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    return f"icons/{filename}"


def _try_download(icon_url):
    try:
        resp = requests.get(icon_url, timeout=TIMEOUT, headers=HEADERS, verify=False)
        if resp.status_code == 200 and resp.content and len(resp.content) > 32:
            return _save(resp.content, icon_url)
    except requests.RequestException:
        pass
    return None


def fetch_favicon(site_url):
    """Best-effort favicon fetch. Returns a relative static path
    (e.g. 'icons/abcd1234.png') on success, or None if nothing could
    be found — the frontend falls back to a letter avatar in that case."""
    if not site_url:
        return None
    if not site_url.startswith(("http://", "https://")):
        site_url = "http://" + site_url

    parsed = urlparse(site_url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    # 1) Try to parse the page HTML for an explicit <link rel="icon"> tag.
    try:
        resp = requests.get(site_url, timeout=TIMEOUT, headers=HEADERS, verify=False)
        soup = BeautifulSoup(resp.text, "html.parser")
        for rel in ("icon", "shortcut icon", "apple-touch-icon"):
            tag = soup.find("link", rel=lambda v: v and rel in v.lower())
            if tag and tag.get("href"):
                icon_url = urljoin(site_url, tag["href"])
                result = _try_download(icon_url)
                if result:
                    return result
    except requests.RequestException:
        pass

    # 2) Fall back to the conventional /favicon.ico path.
    result = _try_download(urljoin(root, "/favicon.ico"))
    if result:
        return result

    return None
