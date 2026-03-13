from rest_framework import status
from rest_framework.response import Response

from scanner.models import GitHubScan
from scanner.serializers import CodeMapEdgeSerializer, CodeMapNodeSerializer


def code_map_response(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    nodes = CodeMapNodeSerializer(github_scan.code_map_nodes.all(), many=True).data
    edges = CodeMapEdgeSerializer(
        github_scan.code_map_edges.select_related("source_node", "target_node").all(),
        many=True,
    ).data
    return Response({"nodes": nodes, "edges": edges})
