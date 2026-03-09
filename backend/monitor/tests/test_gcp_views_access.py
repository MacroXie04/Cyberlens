class TestGcpUnauthenticated:
    def test_estate_summary(self, client):
        resp = client.get("/api/gcp-estate/summary/")
        assert resp.status_code in (401, 403)

    def test_security_events(self, client):
        resp = client.get("/api/gcp-security/events/")
        assert resp.status_code in (401, 403)
