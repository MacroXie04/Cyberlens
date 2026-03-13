from django.db import models

from .scan import GitHubScan


class CodeMapNode(models.Model):
    class NodeType(models.TextChoices):
        ENDPOINT = "endpoint", "Endpoint"
        VIEW = "view", "View"
        SERVICE = "service", "Service"
        MODEL = "model", "Model"
        COMPONENT = "component", "Component"
        FRONTEND_ROUTE = "frontend_route", "Frontend Route"
        MIDDLEWARE = "middleware", "Middleware"
        UTILITY = "utility", "Utility"

    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="code_map_nodes"
    )
    node_id = models.CharField(max_length=500)
    node_type = models.CharField(max_length=20, choices=NodeType.choices)
    label = models.CharField(max_length=300)
    file_path = models.CharField(max_length=500, blank=True, default="")
    line_number = models.IntegerField(default=0)
    http_methods = models.JSONField(default=list)
    metadata_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scan", "node_id"], name="unique_node_per_scan"
            )
        ]

    def __str__(self):
        return f"{self.label} ({self.node_type})"


class CodeMapEdge(models.Model):
    class EdgeType(models.TextChoices):
        ROUTES_TO = "routes_to", "Routes To"
        CALLS = "calls", "Calls"
        IMPORTS = "imports", "Imports"
        RENDERS = "renders", "Renders"

    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="code_map_edges"
    )
    source_node = models.ForeignKey(
        CodeMapNode, on_delete=models.CASCADE, related_name="outgoing_edges"
    )
    target_node = models.ForeignKey(
        CodeMapNode, on_delete=models.CASCADE, related_name="incoming_edges"
    )
    edge_type = models.CharField(max_length=20, choices=EdgeType.choices)
    label = models.CharField(max_length=300, blank=True, default="")
    metadata_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source_node.label} → {self.target_node.label} ({self.edge_type})"
