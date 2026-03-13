from rest_framework import serializers

from scanner.models import CodeMapEdge, CodeMapNode


class CodeMapNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeMapNode
        fields = ["id", "node_id", "node_type", "label", "file_path", "line_number", "http_methods", "metadata_json"]


class CodeMapEdgeSerializer(serializers.ModelSerializer):
    source_node_id = serializers.CharField(source="source_node.node_id")
    target_node_id = serializers.CharField(source="target_node.node_id")

    class Meta:
        model = CodeMapEdge
        fields = ["id", "source_node_id", "target_node_id", "edge_type", "label"]
