import math

class DiagramDetector:
    def __init__(self):
        pass

    def detect_diagram_structure(self, slide):
        title = slide.get("title", "")
        text = slide.get("text_content", "")
        shapes = slide.get("shapes", [])

        # 1. Analyze shape positions & vertical levels
        y_levels = []
        for s in shapes:
            if s.get("text"):
                bbox = s.get("bbox", {})
                y_levels.append({
                    "id": s["id"],
                    "text": s["text"],
                    "bbox": bbox,
                    "color": s.get("color", "#3b82f6"),
                    "y_center": bbox.get("y", 0) + (bbox.get("h", 0) / 2),
                    "x_center": bbox.get("x", 0) + (bbox.get("w", 0) / 2)
                })

        # Sort by vertical level (top to bottom)
        y_levels.sort(key=lambda item: item["y_center"])

        # 2. Check for Hierarchy Tree pattern
        # Multiple distinct Y levels with branching X levels
        text_lower = text.lower()
        title_lower = title.lower()

        is_tree = any(k in title_lower or k in text_lower for k in ["hierarchy", "tree", "classification", "taxonomy", "family", "class", "order", "genus", "species", "binary search", "ancestor"])
        is_flowchart = any(k in title_lower or k in text_lower for k in ["flowchart", "algorithm", "decision", "process", "workflow", "start", "end", "mid index"])
        is_process = any(k in title_lower or k in text_lower for k in ["supply chain", "lifecycle", "step 1", "step 2", "stage", "fulfillment"])
        is_chart = any(k in title_lower or k in text_lower for k in ["graph", "chart", "velocity", "kinematics", "axis", "data", "formula", "trend"])

        if is_tree or len(y_levels) >= 4:
            diagram_type = "HIERARCHY_TREE"
            confidence = 0.94
            topology = self._build_tree_topology(y_levels)
        elif is_flowchart:
            diagram_type = "FLOWCHART"
            confidence = 0.91
            topology = self._build_flowchart_topology(y_levels)
        elif is_process:
            diagram_type = "LINEAR_PROCESS"
            confidence = 0.96
            topology = self._build_process_topology(y_levels)
        elif is_chart:
            diagram_type = "DATA_CHART"
            confidence = 0.89
            topology = self._build_chart_topology(y_levels)
        else:
            diagram_type = "GENERAL_DIAGRAM"
            confidence = 0.82
            topology = self._build_general_topology(y_levels)

        return {
            "diagram_type": diagram_type,
            "confidence": confidence,
            "element_count": len(y_levels),
            "topology": topology
        }

    def _build_tree_topology(self, nodes):
        # Group into horizontal bands (vertical hierarchy levels)
        levels = []
        band_threshold = 8.0 # % height tolerance

        for n in nodes:
            placed = False
            for band in levels:
                if abs(band["y_avg"] - n["y_center"]) < band_threshold:
                    band["nodes"].append(n)
                    # recalculate avg
                    band["y_avg"] = sum(item["y_center"] for item in band["nodes"]) / len(band["nodes"])
                    placed = True
                    break
            if not placed:
                levels.append({
                    "y_avg": n["y_center"],
                    "nodes": [n]
                })

        # Sort levels top to bottom
        levels.sort(key=lambda item: item["y_avg"])

        structured_levels = []
        for depth, level in enumerate(levels):
            # sort nodes in each level left to right
            level["nodes"].sort(key=lambda item: item["x_center"])
            structured_levels.append({
                "depth": depth + 1,
                "nodes": [
                    {
                        "id": n["id"],
                        "text": n["text"],
                        "bbox": n["bbox"],
                        "color": n["color"]
                    } for n in level["nodes"]
                ]
            })

        return {
            "root": structured_levels[0]["nodes"][0] if structured_levels and structured_levels[0]["nodes"] else None,
            "hierarchy_levels": structured_levels,
            "description": f"Tree structure containing {len(structured_levels)} vertical hierarchical levels and {len(nodes)} distinct nodes."
        }

    def _build_flowchart_topology(self, nodes):
        # Sort nodes horizontally or by sequence
        nodes_sorted = sorted(nodes, key=lambda item: (item["y_center"] // 15, item["x_center"]))
        return {
            "sequence": [
                {
                    "step": idx + 1,
                    "id": n["id"],
                    "text": n["text"],
                    "bbox": n["bbox"]
                } for idx, n in enumerate(nodes_sorted)
            ],
            "description": f"Flowchart algorithm process containing {len(nodes_sorted)} sequential operational nodes."
        }

    def _build_process_topology(self, nodes):
        nodes_sorted = sorted(nodes, key=lambda item: item["x_center"])
        return {
            "stages": [
                {
                    "stage_num": idx + 1,
                    "id": n["id"],
                    "text": n["text"],
                    "bbox": n["bbox"]
                } for idx, n in enumerate(nodes_sorted)
            ],
            "description": f"Sequential process lifecycle with {len(nodes_sorted)} left-to-right milestone stages."
        }

    def _build_chart_topology(self, nodes):
        return {
            "components": [
                {"id": n["id"], "text": n["text"], "bbox": n["bbox"]} for n in nodes
            ],
            "description": f"Data visual chart and mathematical expression with {len(nodes)} identified key metrics."
        }

    def _build_general_topology(self, nodes):
        return {
            "elements": [
                {"id": n["id"], "text": n["text"], "bbox": n["bbox"]} for n in nodes
            ],
            "description": f"Structured graphical diagram layout with {len(nodes)} visual elements."
        }
