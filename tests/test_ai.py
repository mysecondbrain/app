import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.server import app

client = TestClient(app)

@patch('backend.server.requests.post')
def test_ai_success(mock_post):
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "choices": [{"message": {"content": json.dumps({
            "categories": ["Business"],
            "tags": ["sales", "marketing"],
            "summary": "Kurzfassung",
            "confidence": 0.9
        })}}]
    }
    resp = client.post('/api/ai/annotate', json={"text": "Test sales meeting"})
    assert resp.status_code == 200
    body = resp.json()
    assert 'categories' in body and 'tags' in body and 'summary' in body

@patch('backend.server.requests.post')
def test_ai_rate_limit_upstream(mock_post):
    class R:
        status_code = 429
        def raise_for_status(self):
            pass
        def json(self):
            return {}
    mock_post.return_value = R()
    resp = client.post('/api/ai/annotate', json={"text": "Test"})
    # our endpoint converts 429 upstream into fallback 200 due to retry+fallback
    assert resp.status_code in (200, 429)

@patch('backend.server.requests.post')
def test_ai_invalid_json(mock_post):
    class R:
        status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return {"choices": [{"message": {"content": "not json"}}]}
    mock_post.return_value = R()
    resp = client.post('/api/ai/annotate', json={"text": "Hello"})
    assert resp.status_code == 200
    body = resp.json()
    assert 'summary' in body