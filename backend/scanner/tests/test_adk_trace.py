import pytest

from scanner.models import AdkTraceEvent
from scanner.services.adk_trace import next_trace_sequence, record_trace_event


@pytest.mark.django_db
class TestTraceSequenceCounter:
    def test_next_trace_sequence_respects_existing_events(self, scan_factory):
        scan = scan_factory()
        AdkTraceEvent.objects.create(
            scan=scan,
            sequence=3,
            phase="dependency_input",
            kind="stage_started",
            status="running",
            label="Started",
        )

        next_value = next_trace_sequence(scan)

        scan.refresh_from_db()
        assert next_value == 4
        assert scan.trace_sequence_counter == 4

    def test_record_trace_event_allocates_monotonic_sequences(self, scan_factory):
        scan = scan_factory()

        first = record_trace_event(
            scan,
            phase="dependency_input",
            kind="stage_started",
            label="First",
        )
        second = record_trace_event(
            scan,
            phase="dependency_input",
            kind="stage_completed",
            label="Second",
        )

        assert first.sequence == 1
        assert second.sequence == 2
