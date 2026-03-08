import pytest
from accounts.models import GeminiLog
from cyberlens.utils import log_gemini_call


@pytest.mark.django_db
class TestGeminiLog:
    def test_log_creation(self):
        log_gemini_call(
            service="threat_analysis",
            related_object_id=1,
            model_name="gemini-2.5-flash",
            prompt_summary="test prompt",
            response_summary="test response",
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            status="success",
            duration_ms=500,
        )
        assert GeminiLog.objects.count() == 1
        log = GeminiLog.objects.first()
        assert log.service == "threat_analysis"
        assert log.total_tokens == 150
        assert log.status == "success"

    def test_log_with_user(self, user_factory, user_settings_factory):
        user = user_factory()
        user_settings_factory(user)
        log_gemini_call(
            user_id=user.id,
            service="security_report",
            status="success",
        )
        log = GeminiLog.objects.first()
        assert log.user_id == user.id

    def test_log_truncation(self):
        long_text = "x" * 5000
        log_gemini_call(
            service="code_scan_single",
            prompt_summary=long_text,
            response_summary=long_text,
            status="success",
        )
        log = GeminiLog.objects.first()
        assert len(log.prompt_summary) == 2000
        assert len(log.response_summary) == 2000

    def test_log_error(self):
        log_gemini_call(
            service="security_report",
            status="error",
            error_message="API timeout",
        )
        log = GeminiLog.objects.first()
        assert log.status == "error"
        assert log.error_message == "API timeout"
