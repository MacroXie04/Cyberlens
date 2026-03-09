from rest_framework import serializers

from scanner.models import AdkTraceEvent, CodeScanCandidate, CodeScanChunk, CodeScanFileIndex

from .core import CodeFindingSerializer


class AdkTraceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdkTraceEvent
        fields = [
            "id",
            "scan",
            "sequence",
            "phase",
            "kind",
            "status",
            "label",
            "parent_key",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "duration_ms",
            "text_preview",
            "payload_json",
            "started_at",
            "ended_at",
            "created_at",
        ]


class CodeScanFileIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeScanFileIndex
        fields = [
            "id",
            "scan",
            "path",
            "language",
            "content_hash",
            "imports_json",
            "role_flags_json",
            "inventory_status",
            "created_at",
        ]


class CodeScanChunkSerializer(serializers.ModelSerializer):
    file_index = CodeScanFileIndexSerializer(read_only=True)

    class Meta:
        model = CodeScanChunk
        fields = [
            "id",
            "file_index",
            "chunk_key",
            "chunk_kind",
            "start_line",
            "end_line",
            "summary_json",
            "signals_json",
            "summary_status",
            "created_at",
        ]


class CodeScanCandidateSerializer(serializers.ModelSerializer):
    verified_finding = CodeFindingSerializer(read_only=True)

    class Meta:
        model = CodeScanCandidate
        fields = [
            "id",
            "scan",
            "category",
            "label",
            "score",
            "severity_hint",
            "chunk_refs_json",
            "rationale",
            "status",
            "verified_finding",
            "created_at",
        ]
