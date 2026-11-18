from fastapi.testclient import TestClient
from app.main import app


def test_health_shape_and_request_id():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200 and r.json()["api"] == "ok"
        assert "x-request-id" in r.headers


def test_404_uses_error_envelope():
    with TestClient(app) as c:
        r = c.get("/nope")
        assert r.status_code == 404 and r.json()["error"]["code"] == "http_error"
